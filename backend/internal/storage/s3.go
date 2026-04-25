// Package storage owns the backend's S3 client for record audio.
//
// Why a wrapper: the Stage 2 voice flow needs presigned PUT URLs that the
// app uploads original audio to, plus an existence check (HEAD) the
// PATCH /records/{id} handler runs before persisting an audio_s3_key.
// Both share the same client, the same bucket, and the same key
// convention. Centralizing them here keeps the S3-specific imports out of
// the records handler and makes "where do audio objects live?" a single
// search hit.
//
// Credentials: production assumes a role via STS (AWS_ASSUME_ROLE_ARN);
// the SDK refreshes credentials before they expire. For local dev the
// role ARN may be empty, in which case the default credential chain is
// used (env vars, ~/.aws/credentials, IRSA, etc.).
//
// Key convention: BuildRecordAudioKey is the only sanctioned way to
// construct an audio key. Clients never assemble keys themselves — the
// upload-url endpoint returns the key it generated, and PATCH validates
// the round-trip matches. This prevents prefix tampering across tenants.
package storage

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/smithy-go"
)

// S3Config is the env-driven configuration for the audio bucket.
//
// AWS_S3_KEY_PREFIX is intentionally optional; an empty prefix means
// "objects live at users/{user}/records/{record}.m4a from the bucket
// root." NormalizePrefix() folds away any user-supplied trailing slash so
// downstream key building does not double-slash.
//
// Endpoint + UsePathStyle are escape hatches for S3-compatible services:
// MinIO in tests, LocalStack in CI, etc. They have no effect when
// pointed at AWS proper.
type S3Config struct {
	Region        string
	AssumeRoleARN string
	Bucket        string
	Prefix        string
	// Endpoint overrides the SDK's default endpoint resolution. Non-empty
	// values are used verbatim (e.g. "http://minio:9000").
	Endpoint string
	// UsePathStyle forces `https://endpoint/bucket/key` URLs instead of
	// `https://bucket.endpoint/key`. MinIO needs this; AWS works either
	// way but virtual-host style is the default.
	UsePathStyle bool
}

// LoadS3ConfigFromEnv reads the AWS_* env vars. It returns the raw
// values without validating them — Validate() is the explicit step the
// server's main wires in so missing values surface as a startup failure
// rather than as silent runtime breakage on the first upload.
func LoadS3ConfigFromEnv() S3Config {
	return S3Config{
		Region:        os.Getenv("AWS_REGION"),
		AssumeRoleARN: os.Getenv("AWS_ASSUME_ROLE_ARN"),
		Bucket:        os.Getenv("AWS_S3_BUCKET"),
		Prefix:        NormalizePrefix(os.Getenv("AWS_S3_KEY_PREFIX")),
		Endpoint:      os.Getenv("AWS_S3_ENDPOINT"),
		UsePathStyle:  isTrue(os.Getenv("AWS_S3_USE_PATH_STYLE")),
	}
}

func isTrue(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}

// Validate enforces that bucket + region are present. Role ARN is
// optional (default credential chain handles local dev). Prefix is
// optional (empty means root).
func (c S3Config) Validate() error {
	if c.Region == "" {
		return errors.New("AWS_REGION must be set")
	}
	if c.Bucket == "" {
		return errors.New("AWS_S3_BUCKET must be set")
	}
	return nil
}

// NormalizePrefix trims a single trailing slash so callers can mix and
// match `prod/`, `prod`, or `` and get the same key layout. Multiple
// trailing slashes are collapsed too — defensive against operator typos.
func NormalizePrefix(p string) string {
	return strings.TrimRight(p, "/")
}

// BuildRecordAudioKey is the canonical key layout for one record's
// audio. Independent of the S3 client so handlers can validate the
// client-supplied key by recomputing it.
//
// Layout: `{prefix}/users/{userID}/records/{recordID}.m4a` (the leading
// slash is omitted when prefix is empty).
func (c S3Config) BuildRecordAudioKey(userID, recordID string) string {
	tail := fmt.Sprintf("users/%s/records/%s.m4a", userID, recordID)
	if c.Prefix == "" {
		return tail
	}
	return c.Prefix + "/" + tail
}

// Client wraps an *s3.Client plus its presign client and the validated
// config. Construct via NewClient.
type Client struct {
	cfg     S3Config
	s3      *s3.Client
	presign *s3.PresignClient
}

// NewClient assumes the configured role (when set) and constructs an S3
// client. AssumeRoleProvider auto-refreshes near expiry, so callers can
// reuse this client for the lifetime of the process.
//
// When cfg.Endpoint is non-empty (MinIO/LocalStack), AssumeRole is
// skipped — those services don't speak STS, and the static credentials
// from the default chain (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env
// vars) are what they expect.
func NewClient(ctx context.Context, cfg S3Config) (*Client, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.Region))
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}
	if cfg.Endpoint == "" && cfg.AssumeRoleARN != "" {
		stsClient := sts.NewFromConfig(awsCfg)
		provider := stscreds.NewAssumeRoleProvider(stsClient, cfg.AssumeRoleARN, func(o *stscreds.AssumeRoleOptions) {
			o.RoleSessionName = "dear-baby-backend"
		})
		awsCfg.Credentials = aws.NewCredentialsCache(provider)
	}
	s3c := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
		if cfg.UsePathStyle {
			o.UsePathStyle = true
		}
	})
	return &Client{cfg: cfg, s3: s3c, presign: s3.NewPresignClient(s3c)}, nil
}

// Config returns the loaded config so handlers can use BuildRecordAudioKey
// without holding their own copy.
func (c *Client) Config() S3Config { return c.cfg }

// PresignPutAudio returns a one-shot URL the app uses to PUT the m4a
// file directly to S3. The 5-minute TTL bounds the window in which a
// leaked URL could be replayed; the orchestrator on the client requests
// a fresh URL when retrying after expiry.
func (c *Client) PresignPutAudio(ctx context.Context, key string, ttl time.Duration) (url string, expiresAt time.Time, err error) {
	req, err := c.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.cfg.Bucket),
		Key:         aws.String(key),
		ContentType: aws.String("audio/m4a"),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("presign put: %w", err)
	}
	return req.URL, time.Now().Add(ttl), nil
}

// HeadAudio probes for the presence of an uploaded object. Returns
// ErrAudioNotFound if the object is missing — used by the PATCH handler
// to refuse persisting an audio_s3_key the client never actually
// uploaded.
func (c *Client) HeadAudio(ctx context.Context, key string) error {
	_, err := c.s3.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(c.cfg.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NotFound" || apiErr.ErrorCode() == "NoSuchKey") {
			return ErrAudioNotFound
		}
		return fmt.Errorf("head audio: %w", err)
	}
	return nil
}

// ErrAudioNotFound is the sentinel returned by HeadAudio when the
// requested key is absent. PATCH handlers translate it to HTTP 400.
var ErrAudioNotFound = errors.New("audio object not found")
