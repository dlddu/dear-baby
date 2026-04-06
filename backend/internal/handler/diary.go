package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/dlddu/dear-baby/backend/internal/middleware"
	"github.com/dlddu/dear-baby/backend/internal/model"
	"github.com/dlddu/dear-baby/backend/internal/service"
)

type DiaryHandler struct {
	diaryService *service.DiaryService
}

func NewDiaryHandler(diaryService *service.DiaryService) *DiaryHandler {
	return &DiaryHandler{diaryService: diaryService}
}

func (h *DiaryHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreateDiaryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	entry, err := h.diaryService.Create(userID, req)
	if err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, model.APIResponse{Data: entry}, http.StatusCreated)
}

func (h *DiaryHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	entry, err := h.diaryService.GetByID(id, userID)
	if err != nil {
		writeError(w, "diary entry not found", http.StatusNotFound)
		return
	}

	writeJSON(w, model.APIResponse{Data: entry}, http.StatusOK)
}

func (h *DiaryHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.diaryService.List(userID, page, limit)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, result, http.StatusOK)
}

func (h *DiaryHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req model.UpdateDiaryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	entry, err := h.diaryService.Update(id, userID, req)
	if err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, model.APIResponse{Data: entry}, http.StatusOK)
}

func (h *DiaryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	if err := h.diaryService.Delete(id, userID); err != nil {
		writeError(w, "diary entry not found", http.StatusNotFound)
		return
	}

	writeJSON(w, model.APIResponse{Message: "deleted"}, http.StatusOK)
}
