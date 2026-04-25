package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

// integrationConfig reads MinIO connection info from the environment.
// Returns ok=false (with no error) when the env is not set, signaling
// the test should skip — that lets `go test ./...` work in dev without
// a live S3-compatible service. CI provides these via the docker
// service in integration.yml.
//
// Required env:
//
//	MINIO_ENDPOINT     — e.g. "http://127.0.0.1:9000"
//	MINIO_ACCESS_KEY   — root user
//	MINIO_SECRET_KEY   — root password
//	MINIO_BUCKET       — pre-created bucket the test will write to
type integrationConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
}

func loadIntegrationConfig(t *testing.T) (integrationConfig, bool) {
	t.Helper()
	c := integrationConfig{
		Endpoint:  os.Getenv("MINIO_ENDPOINT"),
		AccessKey: os.Getenv("MINIO_ACCESS_KEY"),
		SecretKey: os.Getenv("MINIO_SECRET_KEY"),
		Bucket:    os.Getenv("MINIO_BUCKET"),
	}
	if c.Endpoint == "" || c.AccessKey == "" || c.SecretKey == "" || c.Bucket == "" {
		return integrationConfig{}, false
	}
	// The default AWS credential chain reads these env vars. Setting
	// them once for the whole test process is fine — we never run
	// multiple integration tests against different MinIO instances.
	t.Setenv("AWS_ACCESS_KEY_ID", c.AccessKey)
	t.Setenv("AWS_SECRET_ACCESS_KEY", c.SecretKey)
	return c, true
}

// TestIntegration_S3Roundtrip exercises the full presign → PUT → HEAD
// path against a real S3-compatible service (MinIO in CI). It is the
// thing that catches signature/region/endpoint bugs that unit tests
// inherently can't.
//
// Skipped when MINIO_* env vars are absent.
func TestIntegration_S3Roundtrip(t *testing.T) {
	intCfg, ok := loadIntegrationConfig(t)
	if !ok {
		t.Skip("MINIO_* env vars not set; skipping integration test")
	}

	cfg := S3Config{
		Region:       "us-east-1", // MinIO ignores this but the SDK requires it
		Bucket:       intCfg.Bucket,
		Prefix:       "integration-test",
		Endpoint:     intCfg.Endpoint,
		UsePathStyle: true,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := NewClient(ctx, cfg)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	key := cfg.BuildRecordAudioKey("u-int-test", "r-int-test")
	wantPath := "integration-test/users/u-int-test/records/r-int-test.m4a"
	if key != wantPath {
		t.Fatalf("key layout drift: got %q want %q", key, wantPath)
	}

	// 1) Presign a short-lived PUT URL.
	url, expiresAt, err := client.PresignPutAudio(ctx, key, 5*time.Minute)
	if err != nil {
		t.Fatalf("PresignPutAudio: %v", err)
	}
	if url == "" {
		t.Fatal("presigned url is empty")
	}
	if !expiresAt.After(time.Now()) {
		t.Fatalf("expiresAt should be in the future: %v", expiresAt)
	}

	// 2) Upload the canned payload as if we were the app.
	body := []byte("integration audio payload")
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	req.Header.Set("Content-Type", "audio/m4a")
	req.ContentLength = int64(len(body))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("PUT non-2xx: %d body=%s", resp.StatusCode, respBody)
	}

	// 3) HEAD via the storage client — this is what the PATCH handler
	// calls to refuse persisting an audio_s3_key the user never
	// actually uploaded.
	if err := client.HeadAudio(ctx, key); err != nil {
		t.Fatalf("HeadAudio after upload: %v", err)
	}

	// 4) HEAD on a non-existent key returns ErrAudioNotFound (not a
	// generic error). The PATCH handler depends on this to map to a
	// 400 instead of a 500.
	missingKey := cfg.BuildRecordAudioKey("u-int-test", "r-does-not-exist")
	err = client.HeadAudio(ctx, missingKey)
	if !errors.Is(err, ErrAudioNotFound) {
		t.Fatalf("HeadAudio on missing: got %v, want ErrAudioNotFound", err)
	}
}

// TestIntegration_PresignWithoutAssumeRole verifies the AssumeRole
// branch is bypassed when a custom endpoint is set — MinIO has no STS,
// and the test would hang without the bypass.
func TestIntegration_PresignWithoutAssumeRole(t *testing.T) {
	intCfg, ok := loadIntegrationConfig(t)
	if !ok {
		t.Skip("MINIO_* env vars not set; skipping integration test")
	}

	cfg := S3Config{
		Region:        "us-east-1",
		Bucket:        intCfg.Bucket,
		Endpoint:      intCfg.Endpoint,
		UsePathStyle:  true,
		// Setting a fake ARN that would explode if AssumeRole actually
		// ran. The Endpoint guard in NewClient should skip the STS step.
		AssumeRoleARN: "arn:aws:iam::000000000000:role/intentionally-fake",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := NewClient(ctx, cfg)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	url, _, err := client.PresignPutAudio(ctx, cfg.BuildRecordAudioKey("u", "r"), time.Minute)
	if err != nil {
		t.Fatalf("PresignPutAudio: %v", err)
	}
	if url == "" {
		t.Fatal("presigned url is empty")
	}
}
