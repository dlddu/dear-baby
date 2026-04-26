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

	// AudioContentType is the only Content-Type the presigned URL allows.
	// Locking this matches the recorder's expo-av output and prevents the
	// client from uploading something other than the audio they recorded.
	AudioContentType = "audio/mp4"
)

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
	})
	return &Client{
		Config:    cfg,
		S3:        s3Client,
		Presigner: s3.NewPresignClient(s3Client),
	}, nil
}

// BuildRecordAudioKey returns the canonical S3 key for a record's audio
// blob. The format is stable across environments — only the prefix
// differs (dev/staging/prod) — so a key string is meaningful in logs:
//
//	{prefix}users/{user_id}/records/{record_id}.m4a
//
// Callers MUST go through this function; constructing keys by hand
// elsewhere defeats the prefix-validation invariant in PATCH /records.
func (c *Client) BuildRecordAudioKey(userID, recordID string) string {
	return fmt.Sprintf("%susers/%s/records/%s.m4a", c.Config.KeyPrefix, userID, recordID)
}

// IsValidRecordAudioKey returns true when key matches the canonical
// format for the given user and record. PATCH /records uses this to
// reject keys that point outside the calling user's record namespace —
// the client never gets to choose its own key.
func (c *Client) IsValidRecordAudioKey(userID, recordID, key string) bool {
	return key != "" && key == c.BuildRecordAudioKey(userID, recordID)
}

// PresignPut issues a presigned PUT URL for the given key. The URL is
// valid for DefaultPresignTTL and is locked to AudioContentType + a
// MaxAudioBytes Content-Length. Returning the URL and a wallclock
// expiry lets the client display "URL expires in ..." if it wants.
func (c *Client) PresignPut(ctx context.Context, key string) (PresignedPut, error) {
	req, err := c.Presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.Config.Bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(AudioContentType),
		ContentLength: aws.Int64(MaxAudioBytes),
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
		ContentType: AudioContentType,
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
