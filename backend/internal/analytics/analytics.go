// Package analytics is a thin wrapper around posthog-go that lets the
// rest of the backend emit product-analytics events without caring
// whether PostHog is configured. When POSTHOG_API_KEY is unset (CI,
// local dev) New returns a no-op client so callers can capture
// unconditionally.
package analytics

import (
	"log/slog"
	"time"

	"github.com/posthog/posthog-go"
)

// Client is the surface the rest of the backend depends on. Keeping it
// small (just Capture + Close) means tests can substitute a fake
// without dragging in the SDK.
type Client interface {
	Capture(distinctID, event string, properties map[string]any)
	Close() error
}

// New constructs a Client. An empty apiKey returns the no-op client —
// the backend boots fine without analytics credentials. host may be
// empty; when set it overrides the default PostHog endpoint (used to
// point self-hosted EU instances at app.posthog.com / eu.i.posthog.com).
func New(apiKey, host string, logger *slog.Logger) Client {
	if apiKey == "" {
		return noop{}
	}
	cfg := posthog.Config{}
	if host != "" {
		cfg.Endpoint = host
	}
	c, err := posthog.NewWithConfig(apiKey, cfg)
	if err != nil {
		// Misconfiguration shouldn't crash the API server — analytics
		// is auxiliary. Log and fall back to no-op.
		logger.Error("posthog init failed, analytics disabled", "err", err)
		return noop{}
	}
	return &phClient{inner: c, logger: logger}
}

type phClient struct {
	inner  posthog.Client
	logger *slog.Logger
}

func (c *phClient) Capture(distinctID, event string, properties map[string]any) {
	if distinctID == "" {
		// posthog-go rejects empty DistinctId in Validate. Drop the
		// event rather than failing — the caller always has SOMETHING
		// it could pass, but for unauthenticated paths we'd rather
		// skip than crash.
		return
	}
	props := posthog.NewProperties()
	for k, v := range properties {
		props.Set(k, v)
	}
	if err := c.inner.Enqueue(posthog.Capture{
		DistinctId: distinctID,
		Event:      event,
		Timestamp:  time.Now().UTC(),
		Properties: props,
	}); err != nil {
		c.logger.Warn("posthog enqueue failed", "err", err, "event", event)
	}
}

func (c *phClient) Close() error {
	return c.inner.Close()
}

type noop struct{}

func (noop) Capture(string, string, map[string]any) {}
func (noop) Close() error                           { return nil }
