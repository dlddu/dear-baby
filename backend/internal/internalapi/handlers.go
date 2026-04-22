package internalapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
)

// Handlers exposes the `/internal/*` endpoints consumed by the worker
// service. Authenticated by a shared token (see TokenAuth middleware).
type Handlers struct {
	Onboarding *onboarding.Store
}

// TokenAuth rejects requests missing `X-Internal-Token: <expected>`. The
// token is a shared secret between backend and worker; deployments put it
// in a dedicated k8s Secret (`internal-auth-secret`).
func TokenAuth(expected string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got := r.Header.Get("X-Internal-Token")
			if expected == "" || got == "" || got != expected {
				httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type pendingAIPreviewItem struct {
	UserID   string `json:"user_id"`
	RecordID string `json:"record_id"`
	Content  string `json:"content"`
}

// PendingAIPreviews handles GET /internal/tasks/ai-preview/pending. Returns
// users awaiting their first AI preview so the worker can self-heal on
// boot after Redis lost the queue.
func (h *Handlers) PendingAIPreviews(w http.ResponseWriter, r *http.Request) {
	list, err := h.Onboarding.ListPendingAIPreviews(r.Context(), 100)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	out := make([]pendingAIPreviewItem, 0, len(list))
	for _, p := range list {
		out = append(out, pendingAIPreviewItem{
			UserID:   p.UserID,
			RecordID: p.RecordID,
			Content:  p.Content,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type saveAIPreviewBody struct {
	UserID  string `json:"user_id"`
	Preview string `json:"preview"`
}

// SaveAIPreview handles POST /internal/onboarding/ai-preview. Called by the
// worker after a successful OpenRouter edit to persist the result.
func (h *Handlers) SaveAIPreview(w http.ResponseWriter, r *http.Request) {
	var body saveAIPreviewBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil || body.UserID == "" || body.Preview == "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := h.Onboarding.UpdateAIPreview(r.Context(), body.UserID, body.Preview); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "onboarding not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
