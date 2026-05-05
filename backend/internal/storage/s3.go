// Package storage centralizes S3 access for the records-audio pipeline.
// The backend never proxies bytes — it issues short-lived presigned PUT
// URLs so the device uploads directly. All credential plumbing happens
// here, behind a single Client surface, so handlers can stay agnostic of
// AWS specifics.
//
// Credential strategy:
//
//   AWS_ASSUME_ROLE_ARN set
//     → STS AssumeRole via stscreds.AssumeRoleProvider on top of the
//       ambient credential chain. Production target: the pod ships
//       static bootstrap credentials (an IAM user scoped to a single
//       sts:AssumeRole call) and the assumed role then carries the
//       S3 permissions.
//
//   AWS_ASSUME_ROLE_ARN unset
//     → use the ambient chain directly. Local development / docker-compose
//       with a static AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY hits this
//       path, as does CI against MinIO (no STS endpoint there).
//
// The bucket and key prefix are mandatory env vars; the prefix may be
// empty but cannot be unset. We normalise its trailing slash so callers
// can write the key builder without thinking about it.
package storage

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

// Defaults for presign / contract enforcement. Constants live here, not
// in callers, so a single change ripples everywhere.
const (
	// DefaultPresignTTL is the lifetime we hand to clients on presigned
	// PUT URLs. 5 min is enough for slow mobile uploads of a 60s recording
	// without leaving usable URLs around if a phone is compromised.
	DefaultPresignTTL = 5 * time.Minute

	// MaxAudioBytes caps the size the presigned URL will accept. This is
	// enforced via Content-Length on the PUT and matches the client-side
	// recorder's hard cap; it is NOT a billing safeguard — IAM is.
	MaxAudioBytes int64 = 25 * 1024 * 1024 // 25 MiB

	// MaxChildPhotoBytes caps the size of a child profile photo upload.
	// Onboarding photos are small (one per child) — 10 MiB is generous
	// enough to swallow a HEIC straight from the camera roll without
	// re-encoding.
	MaxChildPhotoBytes int64 = 10 * 1024 * 1024 // 10 MiB

	// AudioContentType is the historical default Content-Type the
	// presigned URL allowed before WAV support was added. Kept as a
	// backwards-compat alias for AudioFormatM4A.ContentType() — new
	// code should go through AudioFormat to stay format-aware.
	AudioContentType = "audio/mp4"
)

// AudioFormat enumerates the audio container formats the records
// pipeline accepts. Each format pins both an S3 key extension and an
// HTTP Content-Type — drift between the two would make S3 SigV4
// validation fail (Content-Type is part of the signed headers).
//
// Android records AAC-in-MP4 (m4a), iOS records 16 kHz mono linear-PCM
// (wav). Both are first-class on the server side; the client picks
// based on Platform.OS at upload-url request time.
type AudioFormat string

const (
	AudioFormatM4A AudioFormat = "m4a"
	AudioFormatWAV AudioFormat = "wav"
)

// ParseAudioFormat normalises a wire-form value (the JSON `format`
// field on POST /records/{id}/audio/upload-url). An empty string maps
// to the historical default (m4a) so older clients keep working
// without sending the new field; any other unknown value is rejected.
func ParseAudioFormat(s string) (AudioFormat, bool) {
	switch s {
	case "":
		return AudioFormatM4A, true
	case string(AudioFormatM4A):
		return AudioFormatM4A, true
	case string(AudioFormatWAV):
		return AudioFormatWAV, true
	}
	return "", false
}

// Extension returns the leading-dot file extension for the format.
// Used as the S3 key suffix and (cosmetically) as the on-disk
// extension in the device archive.
func (f AudioFormat) Extension() string {
	switch f {
	case AudioFormatWAV:
		return ".wav"
	default:
		return ".m4a"
	}
}

// ContentType returns the HTTP Content-Type the presigned URL will
// accept for this format. Must match exactly what the client sends or
// S3 returns SignatureDoesNotMatch.
func (f AudioFormat) ContentType() string {
	switch f {
	case AudioFormatWAV:
		return "audio/wav"
	default:
		return "audio/mp4"
	}
}

// Config carries the settings needed to construct a Client. Loaded from
// the environment by Load(), but accepted as a struct so tests can inject
// without setenv.
type Config struct {
	Region        string
	AssumeRoleARN string // optional; empty falls back to ambient chain
	Bucket        string
	KeyPrefix     string // already normalised — no leading slash, ends with "/" iff non-empty
	// ForcePathStyle switches the S3 client off virtual-hosted-style and
	// onto path-style URLs (https://endpoint/bucket/key). Required when
	// targeting MinIO or LocalStack from inside a Kubernetes cluster,
	// since `bucket.minio:9000` doesn't resolve. AWS itself supports
	// either style.
	ForcePathStyle bool
	// EndpointURL overrides the SDK's default S3 endpoint. The SDK
	// honours AWS_ENDPOINT_URL_S3 automatically only when configured
	// to use the new endpoint resolver in profile-loaded paths; we
	// pass it explicitly via s3.Options.BaseEndpoint so MinIO works
	// regardless of how the SDK was constructed.
	EndpointURL string
}

// Validate returns an error if required fields are missing. KeyPrefix is
// allowed to be empty; the "users/..." key is then absolute.
func (c Config) Validate() error {
	if c.Region == "" {
		return errors.New("AWS_REGION is required")
	}
	if c.Bucket == "" {
		return errors.New("AWS_S3_BUCKET is required")
	}
	return nil
}

// LoadConfig reads the four env vars the records-audio pipeline depends
// on and returns a normalised Config. Returns an error only on missing
// REGION or BUCKET — both AWS_ASSUME_ROLE_ARN and AWS_S3_KEY_PREFIX may
// be empty.
func LoadConfig() (Config, error) {
	cfg := Config{
		Region:         os.Getenv("AWS_REGION"),
		AssumeRoleARN:  os.Getenv("AWS_ASSUME_ROLE_ARN"),
		Bucket:         os.Getenv("AWS_S3_BUCKET"),
		KeyPrefix:      normalisePrefix(os.Getenv("AWS_S3_KEY_PREFIX")),
		ForcePathStyle: parseBool(os.Getenv("AWS_S3_FORCE_PATH_STYLE")),
		EndpointURL:    strings.TrimSpace(os.Getenv("AWS_ENDPOINT_URL_S3")),
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func parseBool(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}

// normalisePrefix strips a leading slash (S3 keys are not absolute paths)
// and ensures a trailing slash if the prefix is non-empty. "" stays "".
func normalisePrefix(p string) string {
	p = strings.TrimSpace(p)
	p = strings.TrimPrefix(p, "/")
	if p == "" {
		return ""
	}
	if !strings.HasSuffix(p, "/") {
		p += "/"
	}
	return p
}

// Client is the surface handlers use. It holds the configured S3 client
// and a presigner. Both reuse the same underlying credential cache, so
// a single AssumeRole call serves both presigning and HeadObject calls.
type Client struct {
	Config    Config
	S3        *s3.Client
	Presigner *s3.PresignClient
}

// NewClient builds a Client from a Config. With an AssumeRoleARN it
// wraps the ambient credentials chain in stscreds.AssumeRoleProvider,
// which auto-refreshes credentials before they expire.
func NewClient(ctx context.Context, cfg Config) (*Client, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.Region))
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	if cfg.AssumeRoleARN != "" {
		stsClient := sts.NewFromConfig(awsCfg)
		provider := stscreds.NewAssumeRoleProvider(stsClient, cfg.AssumeRoleARN, func(o *stscreds.AssumeRoleOptions) {
			o.RoleSessionName = "dear-baby-records"
			// Default duration (15 min minimum, 1h here) keeps the
			// credential chain warm between bursts of uploads without
			// hitting STS on every request.
			o.Duration = time.Hour
		})
		awsCfg.Credentials = aws.NewCredentialsCache(provider)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.ForcePathStyle {
			o.UsePathStyle = true
		}
		if cfg.EndpointURL != "" {
			o.BaseEndpoint = aws.String(cfg.EndpointURL)
		}
		// aws-sdk-go-v2 1.30+ adds `x-amz-sdk-checksum-algorithm` and
		// `x-amz-checksum-...` headers to PutObject by default. They
		// become part of the SigV4 SignedHeaders, which means a
		// presigned PUT can only be consumed by a client that ALSO
		// computes and sends the matching checksum. curl / RN's
		// fetch don't, so we'd get 403 SignatureDoesNotMatch. Pin
		// both directions to "when required" so the SDK only adds
		// checksum behavior on operations that actually need it.
		o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		o.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
	})
	return &Client{
		Config:    cfg,
		S3:        s3Client,
		Presigner: s3.NewPresignClient(s3Client),
	}, nil
}

// BuildRecordAudioKey returns the canonical S3 key for a record's audio
// blob. The structure is stable across environments — only the prefix
// (dev/staging/prod) and the file extension (per format) vary — so a
// key string is meaningful in logs:
//
//	{prefix}users/{user_id}/records/{record_id}{.m4a|.wav}
//
// Callers MUST go through this function; constructing keys by hand
// elsewhere defeats the prefix-validation invariant in PATCH /records.
func (c *Client) BuildRecordAudioKey(userID, recordID string, format AudioFormat) string {
	return fmt.Sprintf("%susers/%s/records/%s%s", c.Config.KeyPrefix, userID, recordID, format.Extension())
}

// IsValidRecordAudioKey returns true when key matches the canonical
// format for the given user and record in any supported audio format.
// PATCH /records uses this to reject keys that point outside the
// calling user's record namespace — the client never gets to choose
// its own key. Either extension (.m4a or .wav) is accepted; which one
// the client uses is signalled by the format field on the upload-url
// request and verified later by the HEAD check (a key the device
// didn't actually upload to has no object to find).
func (c *Client) IsValidRecordAudioKey(userID, recordID, key string) bool {
	if key == "" {
		return false
	}
	return key == c.BuildRecordAudioKey(userID, recordID, AudioFormatM4A) ||
		key == c.BuildRecordAudioKey(userID, recordID, AudioFormatWAV)
}

// PresignPut issues a presigned PUT URL for the given key, locked to
// the supplied format's Content-Type. The URL is valid for
// DefaultPresignTTL.
//
// We deliberately don't include Content-Length in the signed input.
// SigV4 would then require the client's PUT to send EXACTLY the same
// number of bytes — but the recorder doesn't know its output size up
// front and even if it did, signing the exact number gives no upside
// over IAM-side limits. MaxAudioBytes is enforced as a client-side
// recorder cap, not a server-side signature constraint.
func (c *Client) PresignPut(ctx context.Context, key string, format AudioFormat) (PresignedPut, error) {
	contentType := format.ContentType()
	req, err := c.Presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.Config.Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, func(o *s3.PresignOptions) {
		o.Expires = DefaultPresignTTL
	})
	if err != nil {
		return PresignedPut{}, fmt.Errorf("presign put: %w", err)
	}
	if _, perr := url.Parse(req.URL); perr != nil {
		return PresignedPut{}, fmt.Errorf("presigned url malformed: %w", perr)
	}
	return PresignedPut{
		URL:         req.URL,
		Method:      req.Method,
		ExpiresAt:   time.Now().UTC().Add(DefaultPresignTTL),
		ContentType: contentType,
		MaxBytes:    MaxAudioBytes,
	}, nil
}

// PresignedPut bundles every piece of info the client needs to perform
// the PUT — including the headers that must match what we presigned, or
// S3 will reject the upload with a SignatureDoesNotMatch.
type PresignedPut struct {
	URL         string    `json:"upload_url"`
	Method      string    `json:"method"`
	ExpiresAt   time.Time `json:"expires_at"`
	ContentType string    `json:"content_type"`
	MaxBytes    int64     `json:"max_bytes"`
}

// ImageFormat enumerates the photo container formats the onboarding
// child-photo upload accepts. JPEG/PNG cover Android cameras; HEIC is
// the iOS default and is uploaded as-is so we don't need a server-side
// transcoder. Each format pins both an S3 key extension and an HTTP
// Content-Type — drift would make S3 SigV4 reject the PUT.
type ImageFormat string

const (
	ImageFormatJPEG ImageFormat = "jpeg"
	ImageFormatPNG  ImageFormat = "png"
	ImageFormatHEIC ImageFormat = "heic"
)

// ParseImageFormat normalises a wire-form format value. Empty strings
// default to JPEG (the safest cross-platform pick).
func ParseImageFormat(s string) (ImageFormat, bool) {
	switch s {
	case "":
		return ImageFormatJPEG, true
	case string(ImageFormatJPEG), "jpg":
		return ImageFormatJPEG, true
	case string(ImageFormatPNG):
		return ImageFormatPNG, true
	case string(ImageFormatHEIC), "heif":
		return ImageFormatHEIC, true
	}
	return "", false
}

// Extension returns the leading-dot file extension for the format.
func (f ImageFormat) Extension() string {
	switch f {
	case ImageFormatPNG:
		return ".png"
	case ImageFormatHEIC:
		return ".heic"
	default:
		return ".jpg"
	}
}

// ContentType returns the HTTP Content-Type the presigned URL will
// accept for this format.
func (f ImageFormat) ContentType() string {
	switch f {
	case ImageFormatPNG:
		return "image/png"
	case ImageFormatHEIC:
		return "image/heic"
	default:
		return "image/jpeg"
	}
}

// BuildChildPhotoTmpKey returns the S3 key the device uploads to during
// onboarding before a child row exists. The UUID is generated server-side
// so the client cannot forge keys for other users.
//
//	{prefix}users/{user_id}/onboarding-tmp/{uuid}{.jpg|.png|.heic}
func (c *Client) BuildChildPhotoTmpKey(userID, uuid string, format ImageFormat) string {
	return fmt.Sprintf("%susers/%s/onboarding-tmp/%s%s", c.Config.KeyPrefix, userID, uuid, format.Extension())
}

// BuildChildPhotoKey returns the permanent S3 key for a child's profile
// photo. POST /onboarding/case rotates the tmp key into this layout once
// the child row is committed.
//
//	{prefix}users/{user_id}/children/{child_id}/photo{.jpg|.png|.heic}
func (c *Client) BuildChildPhotoKey(userID, childID string, format ImageFormat) string {
	return fmt.Sprintf("%susers/%s/children/%s/photo%s", c.Config.KeyPrefix, userID, childID, format.Extension())
}

// IsValidChildPhotoTmpKey checks that key sits inside the calling user's
// onboarding-tmp namespace and ends in one of the accepted extensions.
// POST /onboarding/case rejects mismatched keys before HeadObject so
// clients can't redirect us to other users' objects.
func (c *Client) IsValidChildPhotoTmpKey(userID, key string) bool {
	if key == "" {
		return false
	}
	prefix := fmt.Sprintf("%susers/%s/onboarding-tmp/", c.Config.KeyPrefix, userID)
	if !strings.HasPrefix(key, prefix) {
		return false
	}
	rest := key[len(prefix):]
	if rest == "" || strings.ContainsAny(rest, "/") {
		return false
	}
	for _, ext := range []string{".jpg", ".jpeg", ".png", ".heic", ".heif"} {
		if strings.HasSuffix(strings.ToLower(rest), ext) {
			return true
		}
	}
	return false
}

// ImageFormatFromKey infers the ImageFormat of a given key by inspecting
// the extension. Used by POST /onboarding/case to derive the destination
// format when copying a tmp key onto the permanent layout.
func ImageFormatFromKey(key string) (ImageFormat, bool) {
	low := strings.ToLower(key)
	switch {
	case strings.HasSuffix(low, ".png"):
		return ImageFormatPNG, true
	case strings.HasSuffix(low, ".heic"), strings.HasSuffix(low, ".heif"):
		return ImageFormatHEIC, true
	case strings.HasSuffix(low, ".jpg"), strings.HasSuffix(low, ".jpeg"):
		return ImageFormatJPEG, true
	}
	return "", false
}

// PresignImagePut issues a presigned PUT URL bound to the supplied
// image format's Content-Type. The URL is valid for DefaultPresignTTL.
func (c *Client) PresignImagePut(ctx context.Context, key string, format ImageFormat) (PresignedPut, error) {
	contentType := format.ContentType()
	req, err := c.Presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.Config.Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, func(o *s3.PresignOptions) {
		o.Expires = DefaultPresignTTL
	})
	if err != nil {
		return PresignedPut{}, fmt.Errorf("presign image put: %w", err)
	}
	if _, perr := url.Parse(req.URL); perr != nil {
		return PresignedPut{}, fmt.Errorf("presigned url malformed: %w", perr)
	}
	return PresignedPut{
		URL:         req.URL,
		Method:      req.Method,
		ExpiresAt:   time.Now().UTC().Add(DefaultPresignTTL),
		ContentType: contentType,
		MaxBytes:    MaxChildPhotoBytes,
	}, nil
}

// CopyObject duplicates an existing object inside the same bucket.
// Used by POST /onboarding/case to rotate an onboarding-tmp key onto
// its permanent layout. CopySource must be `{bucket}/{key}` with the
// key URL-escaped per S3's rules.
func (c *Client) CopyObject(ctx context.Context, srcKey, dstKey string) error {
	source := c.Config.Bucket + "/" + url.PathEscape(srcKey)
	if _, err := c.S3.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(c.Config.Bucket),
		Key:        aws.String(dstKey),
		CopySource: aws.String(source),
	}); err != nil {
		return fmt.Errorf("copy object: %w", err)
	}
	return nil
}

// DeleteObject removes an object by key. Used after CopyObject during
// the onboarding-tmp → children rename so we don't leave the source
// behind.
func (c *Client) DeleteObject(ctx context.Context, key string) error {
	if _, err := c.S3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.Config.Bucket),
		Key:    aws.String(key),
	}); err != nil {
		return fmt.Errorf("delete object: %w", err)
	}
	return nil
}

// DeletePrefix removes every object under the given key prefix. Used
// by reset-onboarding to clear tmp uploads + children/* between test
// runs. Implemented as a paged ListObjectsV2 followed by per-page
// DeleteObjects calls — both ListObjectsV2 and DeleteObjects are
// supported on MinIO so dev/CI behaves like production.
func (c *Client) DeletePrefix(ctx context.Context, prefix string) error {
	for {
		out, err := c.S3.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket: aws.String(c.Config.Bucket),
			Prefix: aws.String(prefix),
		})
		if err != nil {
			return fmt.Errorf("list prefix: %w", err)
		}
		if len(out.Contents) == 0 {
			return nil
		}
		for _, o := range out.Contents {
			if o.Key == nil {
				continue
			}
			if _, err := c.S3.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket: aws.String(c.Config.Bucket),
				Key:    o.Key,
			}); err != nil {
				return fmt.Errorf("delete %s: %w", *o.Key, err)
			}
		}
		if out.IsTruncated == nil || !*out.IsTruncated {
			return nil
		}
	}
}

// HeadObject returns true when the key exists. Used by PATCH /records to
// confirm the device actually uploaded the audio before we mark the row
// as having an audio blob — there's no other way to verify, since the
// device "told us so" is not enough.
func (c *Client) HeadObject(ctx context.Context, key string) (bool, error) {
	_, err := c.S3.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(c.Config.Bucket),
		Key:    aws.String(key),
	})
	if err == nil {
		return true, nil
	}
	// The SDK distinguishes 404 from other failures via response
	// metadata, but for our purposes any "not present" is the same
	// outcome — we want the boolean signal, plus the error for logging
	// when it's a real failure.
	var notFound interface {
		ErrorCode() string
	}
	if errors.As(err, &notFound) {
		switch notFound.ErrorCode() {
		case "NotFound", "NoSuchKey":
			return false, nil
		}
	}
	return false, err
}
