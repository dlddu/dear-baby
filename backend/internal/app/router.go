package app

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"

	"github.com/dlddu/dear-baby/backend/internal/auth"
	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
	"github.com/dlddu/dear-baby/backend/internal/records"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// newRouter builds the chi router, wires middleware and handlers, and
// returns an http.Handler ready for the http.Server. redisClient + hub
// are optional — when nil, AI-preview routes are skipped so /health and
// auth continue to work without Redis (local dev / smoke tests).
func newRouter(cfg *config.Config, db *sql.DB, logger *slog.Logger, redisClient *redis.Client, hub *tasks.Hub) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(httpx.Recoverer(logger))
	r.Use(httpx.Logger(logger))
	r.Use(httpx.CORS())

	usersStore := &users.Store{DB: db}
	onboardingStore := &onboarding.Store{DB: db}
	refreshStore := &auth.RefreshStore{DB: db}
	issuer := &auth.Issuer{
		Secret:     cfg.JWTSecret,
		AccessTTL:  cfg.JWTAccessTTL,
		RefreshTTL: cfg.JWTRefreshTTL,
	}
	verifier := &auth.GoogleVerifier{Audiences: cfg.GoogleAudiences}
	authService := &auth.Service{
		Verifier:   verifier,
		Users:      usersStore,
		Onboarding: onboardingStore,
		Refresh:    refreshStore,
		Issuer:     issuer,
	}
	authHandlers := &auth.Handlers{
		Cfg:        cfg,
		Service:    authService,
		Onboarding: onboardingStore,
	}
	usersHandlers := &users.Handlers{
		Store:                 usersStore,
		Onboarding:            onboardingStore,
		OnboardingErrNotFound: onboarding.ErrNotFound,
		UserIDFromCtxFn:       auth.UserIDFromRequest,
	}
	recordsStore := &records.Store{DB: db}
	recordsHandlers := &records.Handlers{
		Store:           recordsStore,
		Users:           usersStore,
		UserIDFromCtxFn: auth.UserIDFromRequest,
	}

	// Health endpoint — response shape must stay byte-equivalent to the
	// pre-scaffold backend/main.go so the existing Maestro E2E flow and the
	// CI curl smoke test keep working.
	r.Get("/health", httpx.Health)

	r.Post("/auth/google", authHandlers.Google)
	r.Post("/auth/refresh", authHandlers.Refresh)
	r.Post("/auth/logout", authHandlers.Logout)

	if cfg.TestAuthEnabled {
		// This endpoint bypasses Google OAuth and issues a session for any
		// requested email. It exists solely for the Maestro E2E flow and must
		// never be reachable in production. The warning log is a tripwire —
		// if it shows up in production logs, rotate the deploy.
		logger.Warn("mounting POST /auth/test-login — CI/dev only, do not enable in production")
		r.Post("/auth/test-login", authHandlers.TestLogin)
	}

	r.Group(func(pr chi.Router) {
		pr.Use(auth.RequireAuth(issuer))
		pr.Get("/me", usersHandlers.Me)
		pr.Patch("/me", usersHandlers.PatchMe)
		pr.Post("/records", recordsHandlers.Create)
	})

	if redisClient != nil && hub != nil {
		tasksClient := &tasks.Client{Redis: redisClient}
		onbHandlers := &onboarding.Handlers{
			Store:           onboardingStore,
			Tasks:           tasksClient,
			Hub:             hub,
			UserIDFromCtxFn: auth.UserIDFromRequest,
		}

		// Authenticated onboarding routes. The SSE route permits query
		// token fallback because some RN EventSource shims cannot set
		// headers reliably.
		r.Group(func(pr chi.Router) {
			pr.Use(auth.RequireAuth(issuer))
			pr.Post("/onboarding/ai-preview", onbHandlers.RequestAIPreview)
		})
		r.Group(func(pr chi.Router) {
			pr.Use(auth.RequireAuthWithQueryFallback(issuer))
			pr.Get("/onboarding/ai-preview/events", onbHandlers.AIPreviewEvents)
		})
	}

	return r
}
