package app

import (
	"context"
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
	"github.com/dlddu/dear-baby/backend/internal/storage"
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

	// Wire S3 only when configured. A failure here logs but does not
	// kill the binary — text records and /health stay up so partial
	// outages of AWS don't take the whole app offline.
	if cfg.AWS.AudioEnabled() {
		s3Client, err := storage.NewClient(context.Background(), storage.Config{
			Region:         cfg.AWS.Region,
			AssumeRoleARN:  cfg.AWS.AssumeRoleARN,
			Bucket:         cfg.AWS.Bucket,
			KeyPrefix:      cfg.AWS.KeyPrefix,
			ForcePathStyle: cfg.AWS.ForcePathStyle,
		})
		if err != nil {
			logger.Error("storage init failed; audio routes disabled", "err", err)
		} else {
			recordsHandlers.Audio = s3Client
			logger.Info("records-audio routes enabled",
				"region", cfg.AWS.Region,
				"bucket", cfg.AWS.Bucket,
				// Prefix masked since some teams encode tenant/user
				// hints in it. Length is informative enough.
				"prefix_len", len(cfg.AWS.KeyPrefix),
				"assume_role", cfg.AWS.AssumeRoleARN != "",
			)
		}
	} else {
		logger.Info("records-audio routes disabled (AWS_REGION or AWS_S3_BUCKET unset)")
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
		// Audio attachment routes are only meaningful when S3 is
		// wired, but mounting them unconditionally keeps the URL
		// surface predictable — handlers return 503 if Audio is nil.
		pr.Post("/records/{id}/audio/upload-url", recordsHandlers.CreateAudioUploadURL)
		pr.Patch("/records/{id}", recordsHandlers.Patch)
	})

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

	return r
}
