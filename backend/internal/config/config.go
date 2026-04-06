package config

import "os"

type Config struct {
	Port           string
	DBPath         string
	JWTSecret      string
	AuthMode       string // "test" or "production"
	GoogleClientID string
}

func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "8080"),
		DBPath:         getEnv("DB_PATH", "./data/dearbaby.db"),
		JWTSecret:      getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		AuthMode:       getEnv("AUTH_MODE", "production"),
		GoogleClientID: getEnv("GOOGLE_CLIENT_ID", ""),
	}
}

func (c *Config) IsTestMode() bool {
	return c.AuthMode == "test"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
