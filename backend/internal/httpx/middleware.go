package httpx

import (
	"log/slog"
	"net/http"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// CORS allows any origin with the methods and headers used by the app.
// It short-circuits OPTIONS requests with 200 to match the pre-scaffold
// behavior of the original health handler.
func CORS() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-PostHog-Session-Id, X-PostHog-Distinct-Id")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Logger emits one slog record per request with method, path, status, and
// duration. Health-check requests (GET /health) are silently skipped to
// reduce log noise from load-balancer probes. Responses with 4xx status
// are logged at WARN level and 5xx at ERROR level.
func Logger(l *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet && r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)

			attrs := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"status", sw.status,
				"dur_ms", time.Since(start).Milliseconds(),
			}
			if reqID := chimw.GetReqID(r.Context()); reqID != "" {
				attrs = append(attrs, "request_id", reqID)
			}
			// PostHog correlation IDs forwarded by the app. Logging them
			// makes it possible to jump from a backend log line into the
			// matching PostHog session replay.
			if sid := r.Header.Get("X-PostHog-Session-Id"); sid != "" {
				attrs = append(attrs, "ph_session_id", sid)
			}
			if did := r.Header.Get("X-PostHog-Distinct-Id"); did != "" {
				attrs = append(attrs, "ph_distinct_id", did)
			}
			if sw.errMsg != "" {
				attrs = append(attrs, "error", sw.errMsg)
			}

			switch {
			case sw.status >= 500:
				l.Error("http", attrs...)
			case sw.status >= 400:
				l.Warn("http", attrs...)
			default:
				l.Info("http", attrs...)
			}
		})
	}
}

// Recoverer logs panics and returns a generic 500 JSON error.
func Recoverer(l *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					l.Error("panic recovered", "err", rec, "path", r.URL.Path)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte(`{"error":"internal"}`))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
	errMsg string
}

// SetErrorMsg records a human-readable error message on the response writer
// so that the Logger middleware can include it in the log entry. It is a
// no-op if w is not the middleware's internal writer.
func SetErrorMsg(w http.ResponseWriter, msg string) {
	if sw, ok := w.(*statusWriter); ok {
		sw.errMsg = msg
	}
}

func (s *statusWriter) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// Flush forwards to the wrapped writer's Flusher implementation when
// present. Required for SSE handlers — without this, the type assertion
// `w.(http.Flusher)` inside the handler fails because Go does not
// auto-promote interface methods from the embedded ResponseWriter.
func (s *statusWriter) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
