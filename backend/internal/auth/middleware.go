package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

type ctxKey string

const userIDKey ctxKey = "user_id"

// RequireAuth returns a middleware that rejects requests lacking a valid
// access-type Bearer token. On success, it injects the user id into the
// request context, where handlers can retrieve it via UserIDFromContext.
func RequireAuth(issuer *Issuer) func(http.Handler) http.Handler {
	return requireAuth(issuer, false)
}

// RequireAuthWithQueryFallback behaves like RequireAuth, but also accepts
// `?token=<jwt>` as a fallback when the Authorization header is missing.
// React Native's EventSource shims can't always set headers reliably, so
// the SSE route needs this escape hatch. Never use on non-streaming
// routes — query strings leak into logs.
func RequireAuthWithQueryFallback(issuer *Issuer) func(http.Handler) http.Handler {
	return requireAuth(issuer, true)
}

func requireAuth(issuer *Issuer, queryFallback bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var tokenString string
			h := r.Header.Get("Authorization")
			if strings.HasPrefix(h, "Bearer ") {
				tokenString = strings.TrimPrefix(h, "Bearer ")
			} else if queryFallback {
				tokenString = r.URL.Query().Get("token")
			}
			if tokenString == "" {
				httpx.WriteError(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			claims, err := issuer.Parse(tokenString)
			if err != nil {
				httpx.WriteError(w, http.StatusUnauthorized, "invalid token")
				return
			}
			if err := ExpectType(claims, TypeAccess); err != nil {
				httpx.WriteError(w, http.StatusUnauthorized, "wrong token type")
				return
			}
			ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext extracts the authenticated user id from a context.
func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey).(string)
	return v, ok
}

// UserIDFromRequest is a convenience for handlers that have the *http.Request.
func UserIDFromRequest(r *http.Request) (string, bool) {
	return UserIDFromContext(r.Context())
}
