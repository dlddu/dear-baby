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
	"github.com/dlddu/dear-baby/backend/internal/internalapi"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
	"github.com/dlddu/dear-baby/backend/internal/records"
	"github.com/dlddu/dear-baby/backend/internal/tasks"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// newRouter builds the chi router, wires middleware and handlers, and
// returns an http.Handler ready for the http.Server.
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
		Verifier: verifier,
		Users:    usersStore,
		Refresh:  refreshStore,
		Issuer:   issuer,
	}
	authHandlers := &auth.Handlers{
		Cfg:        cfg,
		Service:    authService,
		Onboarding: onboardingStore,
	}
	usersHandlers := &users.Handlers{
		Store:           usersStore,
		Onboarding:      onboardingStore,
		UserIDFromCtxFn: auth.UserIDFromRequest,
	}
	recordsStore := &records.Store{DB: db}
	recordsHandlers := &records.Handlers{
		Store:           recordsStore,
		Users:           usersStore,
		UserIDFromCtxFn: auth.UserIDFromRequest,
	}

	var tasksClient *tasks.Client
	if redisClient != nil {
		tasksClient = &tasks.Client{Redis: redisClient}
	}
	var onboardingHandlers *onboarding.Handlers
	if tasksClient != nil && hub != nil {
		onboardingHandlers = &onboarding.Handlers{
			Store:           onboardingStore,
			Tasks:           tasksClient,
			Hub:             hub,
			UserIDFromCtxFn: auth.UserIDFromRequest,
		}
	}
	internalHandlers := &internalapi.Handlers{Onboarding: onboardingStore}

	r.Get("/health", httpx.Health)

	r.Post("/auth/google", authHandlers.Google)
	r.Post("/auth/refresh", authHandlers.Refresh)
	r.Post("/auth/logout", authHandlers.Logout)

	if cfg.TestAuthEnabled {
		logger.Warn("mounting POST /auth/test-login — CI/dev only, do not enable in production")
		r.Post("/auth/test-login", authHandlers.TestLogin)
	}

	r.Group(func(pr chi.Router) {
		pr.Use(auth.RequireAuth(issuer))
		pr.Get("/me", usersHandlers.Me)
		pr.Patch("/me", usersHandlers.PatchMe)
		pr.Post("/records", recordsHandlers.Create)
		if onboardingHandlers != nil {
			pr.Post("/onboarding/ai-preview", onboardingHandlers.CreateAIPreview)
			pr.Get("/onboarding/ai-preview/events", onboardingHandlers.AIPreviewEvents)
		}
	})

	// Internal API: accessible only with X-Internal-Token. Workers call into
	// these endpoints to read pending jobs and persist results.
	if cfg.InternalAPIToken != "" {
		r.Group(func(pr chi.Router) {
			pr.Use(internalapi.TokenAuth(cfg.InternalAPIToken))
			pr.Get("/internal/tasks/ai-preview/pending", internalHandlers.PendingAIPreviews)
			pr.Post("/internal/onboarding/ai-preview", internalHandlers.SaveAIPreview)
		})
	}

	return r
}
