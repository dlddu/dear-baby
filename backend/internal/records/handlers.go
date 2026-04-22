package records

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// maxContentRunes caps the length of a text record. 2000 UTF-8 code points
// comfortably fits the Stage 2 text-entry screen (multiline, ~a few
// paragraphs) while keeping the payload small on low-end networks.
const maxContentRunes = 2000

// Handlers exposes the POST /records endpoint. Deliberately does NOT know
// about the task queue — AI preview generation is a separate concern owned
// by the onboarding package (POST /onboarding/ai-preview).
type Handlers struct {
	Store           *Store
	Users           *users.Store
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

type createBody struct {
	Content string `json:"content"`
}

// createResponse returns the new record alongside the merged user/onboarding
// flat response so the client can refresh AuthContext in one round-trip.
type createResponse struct {
	Record *Record          `json:"record"`
	User   users.MeResponse `json:"user"`
}

// Create handles POST /records. Accepts `{content: string}`, trims it,
// validates length (1..2000 runes), persists, and stamps first_record_at
// if this is the user's first entry.
func (h *Handlers) Create(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body createBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}

	content := strings.TrimSpace(body.Content)
	if content == "" {
		httpx.WriteError(w, http.StatusBadRequest, "content is required")
		return
	}
	if utf8.RuneCountInString(content) > maxContentRunes {
		httpx.WriteError(w, http.StatusBadRequest, "content too long")
		return
	}

	res, err := h.Store.CreateText(r.Context(), h.Users, uid, content)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	me := users.BuildMeResponse(res.User, res.Onboarding)
	httpx.WriteJSON(w, http.StatusCreated, createResponse{Record: res.Record, User: me})
}
