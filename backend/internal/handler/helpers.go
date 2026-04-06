package handler

import (
	"encoding/json"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/model"
)

func writeJSON(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, message string, status int) {
	writeJSON(w, model.APIResponse{Error: message}, status)
}
