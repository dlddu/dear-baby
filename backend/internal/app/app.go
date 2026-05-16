package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/dlddu/dear-baby/backend/internal/auth"
	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/db"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
)

// Run loads config, opens the DB, applies migrations, starts the HTTP server,
// and blocks until SIGINT/SIGTERM. Returns any fatal error.
func Run() error {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	sqlDB, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer sqlDB.Close()

	if err := db.RunMigrations(sqlDB); err != nil {
		return err
	}

	// Seed (or refresh) the password-backed test user. Returns nil
	// creds when TEST_USER_EMAIL or TEST_USER_PASSWORD is unset, in
	// which case /auth/password-login stays mounted but every
	// request gets 401. Hash lives only in memory — the env var is
	// the source of truth so secret rotation just needs a pod
	// restart.
	seedCtx, cancelSeed := context.WithTimeout(context.Background(), 10*time.Second)
	testUserCreds, err := auth.SeedTestUser(
		seedCtx,
		sqlDB,
		&onboarding.Store{DB: sqlDB},
		logger,
		auth.TestUserSeed{
			Email:    cfg.TestUser.Email,
			Password: cfg.TestUser.Password,
			Name:     cfg.TestUser.Name,
		},
	)
	cancelSeed()
	if err != nil {
		return fmt.Errorf("seed test user: %w", err)
	}

	if cfg.RedisURL == "" {
		return fmt.Errorf("REDIS_URL must be set")
	}
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return err
	}
	redisClient := redis.NewClient(opt)
	defer redisClient.Close()

	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := redisClient.Ping(pingCtx).Err(); err != nil {
		cancel()
		return err
	}
	cancel()

	// Hub keeps the pub/sub plumbing wired up so future task workloads
	// can register processors here without re-introducing the
	// initialization choreography.
	hub := &tasks.Hub{Redis: redisClient, Logger: logger}
	hubCtx, cancelHub := context.WithCancel(context.Background())
	defer cancelHub()
	if err := hub.Start(hubCtx); err != nil {
		return err
	}
	defer hub.Stop()

	r, err := newRouter(cfg, sqlDB, logger, redisClient, hub, testUserCreds)
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("dear-baby backend starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case <-quit:
		logger.Info("shutting down")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Shutdown(ctx)
	}
}
