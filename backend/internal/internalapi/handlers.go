// Package internalapi exposes endpoints the worker calls back into the
// backend through. Everything here is guarded by a shared-secret token
// in the `X-Internal-Token` header and is intended only for in-cluster
// traffic — never for the public internet.
package internalapi

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
)

// Handlers wires the internal endpoints to the onboarding store. Held
// together as a small struct so the router can construct one instance
// and register every route on it.
type Handlers struct {
	Onboarding *onboarding.Store
	Token      string
}

// RequireToken is the middleware that gates the /internal/ subtree. It
// rejects missing or mismatched tokens with 401; drift between the
// backend and worker secret surfaces here immediately on boot.
func (h *Handlers) RequireToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h.Token == "" {
			// Safety: never allow the internal API to run without a token.
			// A mis-configured deploy would be unauthenticated — refuse.
			httpx.WriteError(w, http.StatusInternalServerError, "internal token not configured")
			return
		}
		got := r.Header.Get("X-Internal-Token")
		if subtle.ConstantTimeCompare([]byte(got), []byte(h.Token)) != 1 {
			httpx.WriteError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// pendingItem is the JSON shape the worker expects from
// GET /internal/tasks/ai-preview/pending.
type pendingItem struct {
	UserID   string `json:"user_id"`
	RecordID string `json:"record_id"`
	Content  string `json:"content"`
}

// ListPendingAIPreviews returns up to `limit` users with a first record
// but no AI preview yet, each paired with the id/content of their oldest
// record. Used by the worker's ai_preview.sync() on boot.
func (h *Handlers) ListPendingAIPreviews(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Onboarding.ListPendingAIPreviews(r.Context(), 100)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	out := make([]pendingItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, pendingItem{UserID: r.UserID, RecordID: r.RecordID, Content: r.Content})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// saveAIPreviewBody is the JSON body for POST /internal/onboarding/ai-preview.
type saveAIPreviewBody struct {
	UserID  string `json:"user_id"`
	Preview string `json:"preview"`
}

// SaveAIPreview stores the LLM-edited preview text for the given user.
// The worker calls this after a successful generation; idempotent
// semantics — callers may overwrite on retry.
func (h *Handlers) SaveAIPreview(w http.ResponseWriter, r *http.Request) {
	var body saveAIPreviewBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.UserID == "" || body.Preview == "" {
		httpx.WriteError(w, http.StatusBadRequest, "user_id and preview required")
		return
	}
	if err := h.Onboarding.UpdateAIPreview(r.Context(), body.UserID, body.Preview); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
