package diary

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// Handlers exposes the diary HTTP endpoints.
type Handlers struct {
	Store           *Store
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

type createRequest struct {
	Title     string `json:"title"`
	Content   string `json:"content"`
	EntryType string `json:"entry_type"`
	Week      *int   `json:"week"`
	Duration  *int   `json:"duration"`
}

type updateRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// Create handles POST /diary.
func (h *Handlers) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.EntryType == "" {
		req.EntryType = "voice"
	}
	entry, err := h.Store.Create(r.Context(), userID, req.Title, req.Content, req.EntryType, req.Week, req.Duration)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to create entry")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, entry)
}

// List handles GET /diary?week=17.
func (h *Handlers) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var week *int
	if wStr := r.URL.Query().Get("week"); wStr != "" {
		w, err := strconv.Atoi(wStr)
		if err == nil {
			week = &w
		}
	}
	entries, err := h.Store.ListByUser(r.Context(), userID, week)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to list entries")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, entries)
}

// Get handles GET /diary/{id}.
func (h *Handlers) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	entry, err := h.Store.GetByID(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "entry not found")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if entry.UserID != userID {
		httpx.WriteError(w, http.StatusNotFound, "entry not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, entry)
}

// Update handles PUT /diary/{id}.
func (h *Handlers) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	var req updateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	entry, err := h.Store.Update(r.Context(), id, userID, req.Title, req.Content)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "entry not found")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to update entry")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, entry)
}

// Delete handles DELETE /diary/{id}.
func (h *Handlers) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	err := h.Store.Delete(r.Context(), id, userID)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "entry not found")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to delete entry")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
