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

	return cfg, nil
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
