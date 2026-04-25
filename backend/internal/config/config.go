package config

import (
	"errors"
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
	// TestAuthEnabled, when true, causes the router to mount the
	// POST /auth/test-login endpoint used by the Maestro E2E flow. It must
	// NEVER be enabled in production — the endpoint issues a valid JWT
	// session for any requested email without OAuth verification. Set via
	// the TEST_AUTH_ENABLED env var ("1" or "true").
	TestAuthEnabled bool
	// RedisURL points at the shared queue/broker. Empty disables
	// AI-preview features entirely; the router skips wiring Redis-backed
	// routes so /health and auth still work without Redis.
	RedisURL string
	// AWS_* fields drive the optional record-audio S3 storage. When the
	// bucket is unset the audio upload routes return 503; the rest of
	// the API keeps working so local dev does not require AWS creds.
	AWSRegion        string
	AWSAssumeRoleARN string
	AWSS3Bucket      string
	AWSS3KeyPrefix   string
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

	switch strings.ToLower(strings.TrimSpace(os.Getenv("TEST_AUTH_ENABLED"))) {
	case "1", "true", "yes", "on":
		cfg.TestAuthEnabled = true
	}

	cfg.RedisURL = os.Getenv("REDIS_URL")

	cfg.AWSRegion = os.Getenv("AWS_REGION")
	cfg.AWSAssumeRoleARN = os.Getenv("AWS_ASSUME_ROLE_ARN")
	cfg.AWSS3Bucket = os.Getenv("AWS_S3_BUCKET")
	cfg.AWSS3KeyPrefix = strings.TrimRight(os.Getenv("AWS_S3_KEY_PREFIX"), "/")

	return cfg, nil
}

// AudioUploadsEnabled is true when the bucket is configured. The router
// uses this as a feature flag — when false, the audio upload routes are
// still mounted (so missing config surfaces as a 503, not a 404) but the
// records handler short-circuits to a service-unavailable error.
func (c *Config) AudioUploadsEnabled() bool {
	return c.AWSS3Bucket != "" && c.AWSRegion != ""
}

// RequireAuthEnv returns an error if the config is missing values that are
// mandatory for Google sign-in. Called lazily inside the auth handler.
func (c *Config) RequireAuthEnv() error {
	if len(c.GoogleAudiences) == 0 {
		return errors.New("GOOGLE_ALLOWED_AUDIENCES must be set")
	}
	return nil
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
