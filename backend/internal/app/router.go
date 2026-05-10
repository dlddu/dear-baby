package app

import (
	"context"
	"database/sql"
	"fmt"
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
//
// Returns an error if S3 wiring fails — the records-audio pipeline is
// a first-class feature, so a misconfigured AWS env should kill the
// boot rather than silently disabling the routes.
func newRouter(cfg *config.Config, db *sql.DB, logger *slog.Logger, redisClient *redis.Client, hub *tasks.Hub, testUserCreds *auth.TestUserCreds) (http.Handler, error) {
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(httpx.Recoverer(logger))
	r.Use(httpx.Logger(logger))
	r.Use(httpx.CORS())
	r.Use(httpx.APIVersionResponse())

	usersStore := &users.Store{DB: db}
	onboardingStore := &onboarding.Store{DB: db}
	refreshStore := &auth.RefreshStore{DB: db}
	issuer := &auth.Issuer{
		Secret:     cfg.JWTSecret,
		AccessTTL:  cfg.JWTAccessTTL,
		RefreshTTL: cfg.JWTRefreshTTL,
	}
	verifier := &auth.GoogleVerifier{Audiences: cfg.GoogleAudiences}
	appleVerifier := &auth.AppleVerifier{Cfg: auth.AppleConfig{
		TeamID:     cfg.Apple.TeamID,
		ClientID:   cfg.Apple.ClientID,
		KeyID:      cfg.Apple.KeyID,
		PrivateKey: cfg.Apple.PrivateKey,
	}}
	authService := &auth.Service{
		Verifier:      verifier,
		AppleVerifier: appleVerifier,
		Users:         usersStore,
		Onboarding:    onboardingStore,
		Refresh:       refreshStore,
		Issuer:        issuer,
		TestUser:      testUserCreds,
	}
	authHandlers := &auth.Handlers{
		Cfg:     cfg,
		Service: authService,
	}
	usersHandlers := &users.Handlers{
		Store:                 usersStore,
		Onboarding:            &onboardingAdapter{store: onboardingStore},
		OnboardingErrNotFound: onboarding.ErrNotFound,
		UserIDFromCtxFn:       auth.UserIDFromRequest,
	}
	recordsStore := &records.Store{DB: db}
	recordsHandlers := &records.Handlers{
		Store:           recordsStore,
		Users:           usersStore,
		UserIDFromCtxFn: auth.UserIDFromRequest,
	}

	// Wire S3. config.Load() already validated the required env vars,
	// so a failure here is a real AWS-SDK problem (bad endpoint URL,
	// AssumeRole-on-boot rejected, etc.) and we let it bubble up.
	s3Client, err := storage.NewClient(context.Background(), storage.Config{
		Region:         cfg.AWS.Region,
		AssumeRoleARN:  cfg.AWS.AssumeRoleARN,
		Bucket:         cfg.AWS.Bucket,
		KeyPrefix:      cfg.AWS.KeyPrefix,
		ForcePathStyle: cfg.AWS.ForcePathStyle,
		EndpointURL:    cfg.AWS.EndpointURL,
	})
	if err != nil {
		return nil, fmt.Errorf("storage init: %w", err)
	}
	recordsHandlers.Audio = s3Client
	logger.Info("records-audio routes enabled",
		"region", cfg.AWS.Region,
		"bucket", cfg.AWS.Bucket,
		// Prefix masked since some teams encode tenant/user
		// hints in it. Length is informative enough.
		"prefix_len", len(cfg.AWS.KeyPrefix),
		"assume_role", cfg.AWS.AssumeRoleARN != "",
	)

	// Health endpoint — response shape must stay byte-equivalent to the
	// pre-scaffold backend/main.go so the existing Maestro E2E flow and the
	// CI curl smoke test keep working. Health is intentionally kept
	// unversioned: k8s liveness/readiness probes and the landing-screen
	// smoke check should keep working unchanged across API version bumps.
	r.Get("/health", httpx.Health)

	tasksClient := &tasks.Client{Redis: redisClient}
	onbHandlers := &onboarding.Handlers{
		Store:           onboardingStore,
		Tasks:           tasksClient,
		Hub:             hub,
		UserIDFromCtxFn: auth.UserIDFromRequest,
	}

	// All product API routes live under /v1. Bumping the version is a
	// single edit (httpx.APIVersionPrefix) plus a new chi.Route block;
	// the v1 surface stays parallel-mountable next to /v2 when the time
	// comes, and clients pin themselves via apiFetch's base path.
	r.Route(httpx.APIVersionPrefix, func(v chi.Router) {
		v.Post("/auth/google", authHandlers.Google)
		v.Post("/auth/apple", authHandlers.Apple)
		v.Post("/auth/refresh", authHandlers.Refresh)
		v.Post("/auth/logout", authHandlers.Logout)
		// Password sign-in backs the seeded test account that Apple
		// beta reviewers and the Maestro E2E flow use to enter the
		// app. The route is mounted unconditionally and runs in
		// production too — the gate is the seeded password (only
		// known to the App Store reviewer and CI), plus the secret
		// tap pattern that gates the modal in the client.
		v.Post("/auth/password-login", authHandlers.PasswordLogin)

		v.Group(func(pr chi.Router) {
			pr.Use(auth.RequireAuth(issuer))
			pr.Get("/me", usersHandlers.Me)
			pr.Patch("/me", usersHandlers.PatchMe)
			pr.Post("/me/onboarding/case-a", usersHandlers.PostOnboardingCaseA)
			pr.Post("/me/onboarding/case-c", usersHandlers.PostOnboardingCaseC)
			pr.Post("/records", recordsHandlers.Create)
			// Audio attachment routes are only meaningful when S3
			// is wired, but mounting them unconditionally keeps
			// the URL surface predictable — handlers return 503
			// if Audio is nil.
			pr.Post("/records/{id}/audio/upload-url", recordsHandlers.CreateAudioUploadURL)
			pr.Patch("/records/{id}", recordsHandlers.Patch)
		})

		// Authenticated onboarding routes. The SSE route permits
		// query token fallback because some RN EventSource shims
		// cannot set headers reliably.
		v.Group(func(pr chi.Router) {
			pr.Use(auth.RequireAuth(issuer))
			pr.Post("/onboarding/ai-preview", onbHandlers.RequestAIPreview)
		})
		v.Group(func(pr chi.Router) {
			pr.Use(auth.RequireAuthWithQueryFallback(issuer))
			pr.Get("/onboarding/ai-preview/events", onbHandlers.AIPreviewEvents)
		})
	})

	return r, nil
}

// onboardingAdapter satisfies users.OnboardingUpdater by translating the
// users-package wire shapes (OnboardingFetus/OnboardingChild) into the
// onboarding-package types and forwarding to the concrete store. The
// indirection keeps users from importing onboarding directly.
type onboardingAdapter struct {
	store *onboarding.Store
}

func (a *onboardingAdapter) UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error {
	return a.store.UpdateDueDateAndOnboardedAt(ctx, userID, dueDate)
}

func (a *onboardingAdapter) DismissVoiceCoachmark(ctx context.Context, userID string) error {
	return a.store.DismissVoiceCoachmark(ctx, userID)
}

func (a *onboardingAdapter) UpsertCaseA(ctx context.Context, userID string, dueDate *string, fetuses []users.OnboardingFetus) error {
	out := make([]onboarding.Fetus, len(fetuses))
	for i, f := range fetuses {
		out[i] = onboarding.Fetus{
			Nickname:      f.Nickname,
			Gender:        f.Gender,
			PregnancyWeek: f.PregnancyWeek,
			DueDate:       f.DueDate,
			Purposes:      f.Purposes,
		}
	}
	return a.store.UpsertCaseA(ctx, userID, dueDate, out)
}

func (a *onboardingAdapter) UpsertCaseC(ctx context.Context, userID string, children []users.OnboardingChild) error {
	out := make([]onboarding.Child, len(children))
	for i, c := range children {
		out[i] = onboarding.Child{
			Name:      c.Name,
			Gender:    c.Gender,
			BirthDate: c.BirthDate,
			Bio:       c.Bio,
			Purposes:  c.Purposes,
		}
	}
	return a.store.UpsertCaseC(ctx, userID, out)
}
