package diary

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

const whisperURL = "https://api.openai.com/v1/audio/transcriptions"

// TranscribeHandler holds the config needed to proxy audio to OpenAI Whisper.
type TranscribeHandler struct {
	OpenAIAPIKey    string
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

type transcribeResponse struct {
	Text string `json:"text"`
}

// Transcribe handles POST /diary/transcribe.
// It expects a multipart/form-data request with an "audio" file field,
// forwards it to OpenAI Whisper API for Korean transcription, and
// returns the transcribed text.
func (h *TranscribeHandler) Transcribe(w http.ResponseWriter, r *http.Request) {
	_, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if h.OpenAIAPIKey == "" {
		httpx.WriteError(w, http.StatusInternalServerError, "transcription not configured")
		return
	}

	// Parse the uploaded audio file (max 25 MB — Whisper limit).
	if err := r.ParseMultipartForm(25 << 20); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid multipart form")
		return
	}
	file, header, err := r.FormFile("audio")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "audio file required")
		return
	}
	defer file.Close()

	// Build the multipart request for OpenAI.
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if err := mw.WriteField("model", "whisper-1"); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if err := mw.WriteField("language", "ko"); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	part, err := mw.CreateFormFile("file", header.Filename)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if _, err := io.Copy(part, file); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	mw.Close()

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, whisperURL, &buf)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", h.OpenAIAPIKey))
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "transcription service unavailable")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		httpx.WriteError(w, http.StatusBadGateway, "transcription failed")
		return
	}

	var result transcribeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed to parse transcription")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, result)
}
