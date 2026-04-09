package app

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/dlddu/dear-baby/backend/internal/auth"
	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// newRouter builds the chi router, wires middleware and handlers, and
// returns an http.Handler ready for the http.Server.
func newRouter(cfg *config.Config, db *sql.DB, logger *slog.Logger) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(httpx.Recoverer(logger))
	r.Use(httpx.Logger(logger))
	r.Use(httpx.CORS())

	usersStore := &users.Store{DB: db}
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
	authHandlers := &auth.Handlers{Cfg: cfg, Service: authService}
	usersHandlers := &users.Handlers{
		Store:           usersStore,
		UserIDFromCtxFn: auth.UserIDFromRequest,
	}

	// Health endpoint — response shape must stay byte-equivalent to the
	// pre-scaffold backend/main.go so the existing Maestro E2E flow and the
	// CI curl smoke test keep working.
	r.Get("/health", httpx.Health)

	r.Post("/auth/google", authHandlers.Google)
	r.Post("/auth/refresh", authHandlers.Refresh)
	r.Post("/auth/logout", authHandlers.Logout)

	r.Group(func(pr chi.Router) {
		pr.Use(auth.RequireAuth(issuer))
		pr.Get("/me", usersHandlers.Me)
	})

	return r
}
