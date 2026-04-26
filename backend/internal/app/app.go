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

	if cfg.RedisURL == "" {
		return errors.New("REDIS_URL must be set")
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

	hub := &tasks.Hub{Redis: redisClient, Logger: logger}
	// Register per-task result processors before Start: they run
	// before fanout, turning the hub from a dumb pubsub relay into
	// the backend-side orchestrator that owns DB writes and retries.
	onboardingStore := &onboarding.Store{DB: sqlDB}
	tasksClient := &tasks.Client{Redis: redisClient}
	hub.RegisterProcessor("ai_preview",
		onboarding.AIPreviewProcessor(onboardingStore, tasksClient, logger))

	hubCtx, cancelHub := context.WithCancel(context.Background())
	defer cancelHub()
	if err := hub.Start(hubCtx); err != nil {
		return err
	}
	defer hub.Stop()

	// Boot-time sync: re-enqueue any user whose preview was never
	// persisted. Covers Redis restarts and missed pub/sub messages
	// without the worker needing to probe backend state.
	syncCtx, cancelSync := context.WithTimeout(context.Background(), 10*time.Second)
	onboarding.SyncPendingAIPreviews(syncCtx, onboardingStore, tasksClient, logger)
	cancelSync()

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
