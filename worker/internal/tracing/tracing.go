// Package tracing wires an OpenTelemetry trace pipeline that ships spans
// to Langfuse via its OTLP/HTTP endpoint. We deliberately stay on
// upstream OTel here — Langfuse accepts vanilla OTLP, so the
// langfuse-specific SDK from the Node worker would only add weight.
package tracing

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// langfuseOTLPPath is appended to LANGFUSE_BASE_URL to reach the OTLP
// HTTP receiver. Langfuse documents this exact prefix for both their
// US and EU regions.
const langfuseOTLPPath = "/api/public/otel/v1/traces"

// ServiceName is what shows up as `service.name` on every span. Kept as
// a constant so dashboards have a stable key to filter on.
const ServiceName = "worker"

// Handle is what the rest of the worker holds. Flush is called
// synchronously after each LLM span so short-lived workers (CI,
// per-job pods) get their data out before the kernel reaps them.
//
// Methods never return errors: tracing is best-effort. A flush failure
// would otherwise mark the preview as failed whenever Langfuse ingestion
// is degraded, which we explicitly don't want.
type Handle struct {
	tp     *sdktrace.TracerProvider
	logger *slog.Logger
}

// Flush blocks until every queued span has been exported (or the
// underlying transport gives up). Safe to call on a nil receiver.
func (h *Handle) Flush(ctx context.Context) {
	if h == nil || h.tp == nil {
		return
	}
	if err := h.tp.ForceFlush(ctx); err != nil {
		h.logger.Warn("tracing flush failed", "err", err.Error())
	}
}

// Shutdown flushes once more and tears the provider down. Used during
// SIGTERM/SIGINT so we don't drop the last-second span.
func (h *Handle) Shutdown(ctx context.Context) {
	if h == nil || h.tp == nil {
		return
	}
	if err := h.tp.ForceFlush(ctx); err != nil {
		h.logger.Warn("tracing shutdown-flush failed", "err", err.Error())
	}
	if err := h.tp.Shutdown(ctx); err != nil {
		h.logger.Warn("tracing shutdown failed", "err", err.Error())
	}
}

// Bootstrap wires LangfuseSpanProcessor's Go equivalent: an OTLP/HTTP
// exporter pointed at LANGFUSE_BASE_URL with the public/secret key pair
// supplied as HTTP Basic auth. Returns nil when credentials are absent
// so dev/test runs work without tracing config.
//
// We use the simple span processor (one export per span end) rather than
// the batch processor: the Node worker had to set exportMode "immediate"
// for the same reason — we'd lose spans whenever a job pod is killed
// shortly after the LLM call returns.
func Bootstrap(ctx context.Context, logger *slog.Logger) (*Handle, error) {
	publicKey := strings.TrimSpace(os.Getenv("LANGFUSE_PUBLIC_KEY"))
	secretKey := strings.TrimSpace(os.Getenv("LANGFUSE_SECRET_KEY"))
	if publicKey == "" || secretKey == "" {
		logger.Info("langfuse tracing disabled — LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set")
		return nil, nil
	}

	baseURL := strings.TrimSpace(os.Getenv("LANGFUSE_BASE_URL"))
	if baseURL == "" {
		return nil, errors.New("LANGFUSE_BASE_URL must be set when langfuse credentials are present")
	}
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("parse LANGFUSE_BASE_URL: %w", err)
	}
	if parsed.Host == "" {
		return nil, fmt.Errorf("LANGFUSE_BASE_URL %q has no host", baseURL)
	}

	auth := base64.StdEncoding.EncodeToString([]byte(publicKey + ":" + secretKey))
	httpOpts := []otlptracehttp.Option{
		otlptracehttp.WithEndpoint(parsed.Host),
		otlptracehttp.WithURLPath(langfuseOTLPPath),
		otlptracehttp.WithHeaders(map[string]string{
			"Authorization": "Basic " + auth,
		}),
	}
	if parsed.Scheme != "https" {
		httpOpts = append(httpOpts, otlptracehttp.WithInsecure())
	}

	exporter, err := otlptrace.New(ctx, otlptracehttp.NewClient(httpOpts...))
	if err != nil {
		return nil, fmt.Errorf("otlptrace exporter: %w", err)
	}

	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			"",
			attribute.String("service.name", ServiceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("resource merge: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)

	logger.Info("langfuse tracing enabled", "base_url", baseURL)
	return &Handle{tp: tp, logger: logger}, nil
}
