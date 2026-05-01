package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds all runtime configuration loaded from the environment.
// Auth-related fields (JWT secret, Google audiences) are loaded but their
// absence only fails later, inside the auth handlers, so that /health still
// works in environments like CI that do not set them.
type Config struct {
	Port            string
	DatabaseURL     string
	JWTSecret       []byte
	JWTAccessTTL    time.Duration
	JWTRefreshTTL   time.Duration
	GoogleAudiences []string
	// Apple holds the credentials needed to exchange an Apple authorization
	// code for an id_token. All four values are required for Apple sign-in
	// to work; if any is empty, POST /auth/apple returns 503 and the rest
	// of the service still functions (Google sign-in, /me, etc).
	Apple AppleConfig
	// TestAuthEnabled, when true, causes the router to mount the
	// POST /auth/test-login endpoint used by the Maestro E2E flow. It must
	// NEVER be enabled in production — the endpoint issues a valid JWT
	// session for any requested email without OAuth verification. Set via
	// the TEST_AUTH_ENABLED env var ("1" or "true").
	TestAuthEnabled bool
	// RedisURL points at the shared queue/broker. Required: app boot
	// fails if unset.
	RedisURL string

	// AWS holds the S3 settings used by the records-audio pipeline.
	// Validated at boot — Load() returns an error if any required field
	// is missing, so a misconfigured deploy never silently degrades to
	// "audio routes disabled".
	AWS AWSConfig
}

// AppleConfig holds the credentials Sign in with Apple needs to verify
// an authorization code: the Apple Developer Team ID, the bundle ID
// (`aud` on the id_token Apple returns), the 10-character Key ID, and
// the PEM-encoded contents of the .p8 private key downloaded from the
// developer portal. Fields are loaded from env at boot and validated
// lazily inside the auth handler so a deploy without Apple credentials
// still serves the rest of the API.
type AppleConfig struct {
	TeamID     string
	ClientID   string
	KeyID      string
	PrivateKey string
}

// AWSConfig groups the S3 settings the records-audio pipeline reads.
// Mirrors storage.Config so app/router.go can pass it through verbatim.
//
// Bootstrap credentials (whatever the SDK uses to call sts:AssumeRole)
// are NOT modelled here — the SDK discovers them on its own from the
// IRSA web-identity token in prod, or from the AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY env vars in CI. Either way we don't validate
// them at boot, only the two fields we know cannot be derived: region
// and bucket.
type AWSConfig struct {
	Region         string
	AssumeRoleARN  string // optional; unset in CI/local dev (no STS endpoint)
	Bucket         string
	KeyPrefix      string // optional
	ForcePathStyle bool   // optional, only for MinIO/LocalStack
	EndpointURL    string // optional override; AWS_ENDPOINT_URL_S3 (MinIO/LocalStack)
}

// Load reads the environment and returns a populated Config. It never fails
// on missing optional values; callers that need auth must call
// RequireAuthEnv separately.
func Load() (*Config, error) {
	cfg := &Config{
		Port:        getenv("PORT", "8080"),
		DatabaseURL: getenv("DATABASE_URL", "file:./dear-baby.db?_pragma=foreign_keys(1)&_pragma=journal_mode(wal)"),
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Dev fallback — insecure, but lets the binary boot so /health works
		// in environments that never hit the auth endpoints.
		secret = "dev-insecure-do-not-use-in-prod"
	}
	cfg.JWTSecret = []byte(secret)

	cfg.JWTAccessTTL = parseDuration("JWT_ACCESS_TTL", 15*time.Minute)
	cfg.JWTRefreshTTL = parseDuration("JWT_REFRESH_TTL", 30*24*time.Hour)

	if auds := os.Getenv("GOOGLE_ALLOWED_AUDIENCES"); auds != "" {
		for _, a := range strings.Split(auds, ",") {
			if s := strings.TrimSpace(a); s != "" {
				cfg.GoogleAudiences = append(cfg.GoogleAudiences, s)
			}
		}
	}

	cfg.Apple = AppleConfig{
		TeamID:     strings.TrimSpace(os.Getenv("APPLE_TEAM_ID")),
		ClientID:   strings.TrimSpace(os.Getenv("APPLE_CLIENT_ID")),
		KeyID:      strings.TrimSpace(os.Getenv("APPLE_KEY_ID")),
		PrivateKey: appleKeyFromEnv(),
	}

	switch strings.ToLower(strings.TrimSpace(os.Getenv("TEST_AUTH_ENABLED"))) {
	case "1", "true", "yes", "on":
		cfg.TestAuthEnabled = true
	}

	cfg.RedisURL = os.Getenv("REDIS_URL")

	cfg.AWS = AWSConfig{
		Region:         os.Getenv("AWS_REGION"),
		AssumeRoleARN:  os.Getenv("AWS_ASSUME_ROLE_ARN"),
		Bucket:         os.Getenv("AWS_S3_BUCKET"),
		KeyPrefix:      os.Getenv("AWS_S3_KEY_PREFIX"),
		ForcePathStyle: parseBoolean(os.Getenv("AWS_S3_FORCE_PATH_STYLE")),
		EndpointURL:    strings.TrimSpace(os.Getenv("AWS_ENDPOINT_URL_S3")),
	}
	if err := validateAWSEnv(cfg.AWS); err != nil {
		return nil, err
	}

	return cfg, nil
}

// validateAWSEnv enforces that the records-audio pipeline has the env
// it needs to function. Boot fails fast on missing values so a
// misconfigured deploy is a deploy-time error, not a 503 the user sees
// when they tap "음성 기록".
//
// Only AWS_REGION and AWS_S3_BUCKET are validated here. Bootstrap
// credentials are intentionally not checked: in prod the SDK pulls them
// from the IRSA web-identity token (no env var present), so requiring
// AWS_ACCESS_KEY_ID would break the prod path.
func validateAWSEnv(a AWSConfig) error {
	missing := []string{}
	if a.Region == "" {
		missing = append(missing, "AWS_REGION")
	}
	if a.Bucket == "" {
		missing = append(missing, "AWS_S3_BUCKET")
	}
	if len(missing) == 0 {
		return nil
	}
	return fmt.Errorf("records-audio env missing: %s", strings.Join(missing, ", "))
}

// RequireAuthEnv returns an error if the config is missing values that are
// mandatory for Google sign-in. Called lazily inside the auth handler.
func (c *Config) RequireAuthEnv() error {
	if len(c.GoogleAudiences) == 0 {
		return errors.New("GOOGLE_ALLOWED_AUDIENCES must be set")
	}
	return nil
}

// RequireAppleEnv returns an error if any of the Apple credentials are
// missing. Called lazily inside the Apple sign-in handler so a deploy
// without Apple credentials still serves the rest of the API.
func (c *Config) RequireAppleEnv() error {
	missing := []string{}
	if c.Apple.TeamID == "" {
		missing = append(missing, "APPLE_TEAM_ID")
	}
	if c.Apple.ClientID == "" {
		missing = append(missing, "APPLE_CLIENT_ID")
	}
	if c.Apple.KeyID == "" {
		missing = append(missing, "APPLE_KEY_ID")
	}
	if c.Apple.PrivateKey == "" {
		missing = append(missing, "APPLE_PRIVATE_KEY")
	}
	if len(missing) == 0 {
		return nil
	}
	return fmt.Errorf("apple sign-in env missing: %s", strings.Join(missing, ", "))
}

// appleKeyFromEnv reads the Apple .p8 private key from one of two env
// vars: APPLE_PRIVATE_KEY (PEM contents inline) or APPLE_PRIVATE_KEY_PATH
// (path to the .p8 file). Inline keys may use literal "\n" sequences in
// place of real newlines, which is the only way to round-trip a multi-line
// secret through some secret stores (k8s Secret string-data, GitHub
// Actions secrets) — we normalize them back to real newlines so the PEM
// decoder accepts the value.
func appleKeyFromEnv() string {
	if raw := os.Getenv("APPLE_PRIVATE_KEY"); raw != "" {
		return strings.ReplaceAll(raw, `\n`, "\n")
	}
	if path := os.Getenv("APPLE_PRIVATE_KEY_PATH"); path != "" {
		b, err := os.ReadFile(path)
		if err == nil {
			return string(b)
		}
	}
	return ""
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func parseDuration(k string, def time.Duration) time.Duration {
	if v := os.Getenv(k); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func parseBoolean(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}
