package app

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/db"
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

	// Redis + pubsub hub are optional: local dev without Redis skips
	// wiring the AI-preview routes so /health and auth still work.
	var redisClient *redis.Client
	var hub *tasks.Hub
	if cfg.RedisURL != "" {
		opt, err := redis.ParseURL(cfg.RedisURL)
		if err != nil {
			return err
		}
		redisClient = redis.NewClient(opt)
		defer redisClient.Close()

		pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := redisClient.Ping(pingCtx).Err(); err != nil {
			cancel()
			return err
		}
		cancel()

		hub = &tasks.Hub{Redis: redisClient, Logger: logger}
		hubCtx, cancelHub := context.WithCancel(context.Background())
		defer cancelHub()
		if err := hub.Start(hubCtx); err != nil {
			return err
		}
		defer hub.Stop()
	} else {
		logger.Warn("REDIS_URL not set — AI-preview routes disabled")
	}

	r := newRouter(cfg, sqlDB, logger, redisClient, hub)

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
