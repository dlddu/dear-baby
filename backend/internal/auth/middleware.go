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
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				httpx.WriteError(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			tokenString := strings.TrimPrefix(h, "Bearer ")
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
