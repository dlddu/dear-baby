// Command worker is the dear-baby task worker. It reads jobs off Redis,
// calls OpenRouter, publishes results, and ships traces to Langfuse via
// OTLP. See README.md for environment variables.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/dlddu/dear-baby/worker/internal/framework"
	"github.com/dlddu/dear-baby/worker/internal/openrouter"
	"github.com/dlddu/dear-baby/worker/internal/tasks/aipreview"
	"github.com/dlddu/dear-baby/worker/internal/tracing"
)

func main() {
	logger := newLogger()

	if err := run(logger); err != nil {
		logger.Error("fatal", "err", err.Error())
		os.Exit(1)
	}
}

// run is split out so the deferred cleanup runs before os.Exit. main's
// only job is to wire stderr logging and translate a returned error into
// the right exit code.
func run(logger *slog.Logger) error {
	redisURL, err := requireEnv("REDIS_URL")
	if err != nil {
		return err
	}
	apiKey, err := requireEnv("OPENROUTER_API_KEY")
	if err != nil {
		return err
	}
	model, err := requireEnv("OPENROUTER_MODEL")
	if err != nil {
		return err
	}
	// Optional: when set, redirects the OpenRouter client to a local
	// mock so CI integration runs don't burn credits.
	//
	// mock-exception: MB-4 — MB-4 치환의 주입 지점. 비어 있으면 실 OpenRouter 로
	// 나가므로 프로덕션 동작은 바뀌지 않는다.
	openrouterBaseURL := os.Getenv("OPENROUTER_BASE_URL")

	bootCtx, bootCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer bootCancel()

	tracingHandle, err := tracing.Bootstrap(bootCtx, logger)
	if err != nil {
		// Tracing bootstrap failure is non-fatal — log and continue with
		// no traces rather than refuse to start.
		logger.Error("tracing bootstrap failed", "err", err.Error())
		tracingHandle = nil
	}

	redisOpts, err := redis.ParseURL(redisURL)
	if err != nil {
		return fmt.Errorf("parse REDIS_URL: %w", err)
	}
	// MaxRetries -1 mirrors the Node side's `maxRetriesPerRequest: null`
	// — go-redis does its own retries internally and BRPOP's blocking
	// behaviour interacts badly with the default exponential backoff.
	redisOpts.MaxRetries = -1
	redisClient := redis.NewClient(redisOpts)
	defer redisClient.Close()

	if err := redisClient.Ping(bootCtx).Err(); err != nil {
		// Don't bail — Redis may come up after the worker. Log so the
		// operator sees the bootstrap state, and let BRPOP's own retry
		// loop in the framework pick up once the connection works.
		logger.Warn("initial redis ping failed; continuing", "err", err.Error())
	}

	orClient := openrouter.New(apiKey, openrouterBaseURL)
	if openrouterBaseURL != "" {
		logger.Info("OPENROUTER_BASE_URL override active", "base_url", openrouterBaseURL)
	}

	preview := aipreview.New(aipreview.Deps{
		Redis:   redisPublisher{client: redisClient},
		Chat:    orClient,
		Model:   model,
		Logger:  logger,
		Tracing: tracingHandle,
	})

	registry := framework.NewRegistry()
	registry.MustRegister(preview)

	logger.Info("worker starting", "tasks", registry.Types())

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	worker := framework.RunWorker(framework.WorkerOptions{
		Registry: registry,
		Redis:    redisClient,
		Logger:   logger,
	})
	go worker.Run(ctx)

	<-ctx.Done()
	// signal.NotifyContext may set a cause (the signal); fall back to the
	// raw context error when nothing was attached so we never crash on a
	// nil pointer mid-shutdown.
	cause := context.Cause(ctx)
	if cause == nil {
		cause = ctx.Err()
	}
	logger.Info("shutdown requested", "cause", cause)

	worker.Wait()

	// Best-effort tracing flush + shutdown. We give it 5s — short enough
	// to stay under the kubelet's terminationGracePeriodSeconds default
	// of 30s with plenty of headroom.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if tracingHandle != nil {
		tracingHandle.Shutdown(shutdownCtx)
	}
	return nil
}

func newLogger() *slog.Logger {
	level := parseLevel(os.Getenv("LOG_LEVEL"))
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})
	return slog.New(handler).With("service", "worker")
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	case "info", "":
		return slog.LevelInfo
	default:
		return slog.LevelInfo
	}
}

func requireEnv(name string) (string, error) {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return "", fmt.Errorf("missing required env: %s", name)
	}
	return v, nil
}

// redisPublisher adapts *redis.Client to aipreview.Publisher. The thin
// wrapper keeps the task's interface free of go-redis types so the
// task's tests stay light.
type redisPublisher struct {
	client *redis.Client
}

func (p redisPublisher) Publish(ctx context.Context, channel, message string) error {
	if err := p.client.Publish(ctx, channel, message).Err(); err != nil {
		// Treat ctx cancellation during shutdown as a normal exit, not a
		// publish error — saves a misleading log line in pod logs.
		if errors.Is(err, context.Canceled) {
			return nil
		}
		return err
	}
	return nil
}
