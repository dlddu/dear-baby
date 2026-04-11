package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type healthResponse struct {
	Status string `json:"status"`
}

// Health returns {"status":"ok"}. The response body and Content-Type must
// remain byte-equivalent to the original backend/main.go handler so that
// the Maestro E2E flow and the curl health-check in CI keep passing.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(healthResponse{Status: "ok"}); err != nil {
		slog.Error("health encode error", "err", err)
	}
}
