package users

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
)

// Handlers exposes the user-scoped HTTP handlers. It composes with the
// onboarding store so the /me response can fold onboarding state back into
// the flat shape the client already expects (see MeResponse).
type Handlers struct {
	Store           *Store
	Onboarding      *onboarding.Store
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

// MeResponse is the flat JSON body returned by GET /me and any handler that
// also returns the current user. Onboarding fields live in a separate DB
// table now but the wire contract stays flat so the RN client doesn't have
// to juggle nested objects.
type MeResponse struct {
	ID                        string     `json:"id"`
	Email                     string     `json:"email"`
	Name                      string     `json:"name"`
	PictureURL                string     `json:"picture_url"`
	DueDate                   *string    `json:"due_date"`
	OnboardedAt               *time.Time `json:"onboarded_at"`
	VoiceCoachmarkDismissedAt *time.Time `json:"voice_coachmark_dismissed_at"`
	FirstRecordAt             *time.Time `json:"first_record_at"`
	AIPreview                 *string    `json:"ai_preview"`
	CreatedAt                 time.Time  `json:"created_at"`
	UpdatedAt                 time.Time  `json:"updated_at"`
}

// BuildMeResponse joins the two rows into the client-facing flat body.
// Exposed so other packages (auth handlers, records handlers) can build the
// same response without re-implementing the merge logic.
func BuildMeResponse(u *User, o *onboarding.Onboarding) MeResponse {
	r := MeResponse{
		ID:         u.ID,
		Email:      u.Email,
		Name:       u.Name,
		PictureURL: u.PictureURL,
		CreatedAt:  u.CreatedAt,
		UpdatedAt:  u.UpdatedAt,
	}
	if o != nil {
		r.DueDate = o.DueDate
		r.OnboardedAt = o.OnboardedAt
		r.VoiceCoachmarkDismissedAt = o.VoiceCoachmarkDismissedAt
		r.FirstRecordAt = o.FirstRecordAt
		r.AIPreview = o.AIPreview
	}
	return r
}

// LoadMe loads the merged user + onboarding data in one call. Returns
// ErrNotFound if the user is missing; an absent onboarding row is tolerated
// (the merged response simply carries null onboarding fields).
func (h *Handlers) LoadMe(r *http.Request, id string) (*MeResponse, error) {
	u, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		return nil, err
	}
	var o *onboarding.Onboarding
	if h.Onboarding != nil {
		got, err := h.Onboarding.Get(r.Context(), id)
		if err != nil && !errors.Is(err, onboarding.ErrNotFound) {
			return nil, err
		}
		o = got
	}
	resp := BuildMeResponse(u, o)
	return &resp, nil
}

// Me returns the authenticated user's profile. Expects that an auth
// middleware has already injected the user id into the request context.
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	resp, err := h.LoadMe(r, id)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

// isoDateRe matches the YYYY-MM-DD shape we accept for due_date; we also
// validate the date is real (e.g., rejects 2025-02-31) below via time.Parse.
var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// patchMeBody is the request body for PATCH /me.
//
// due_date: nullable. When present it must be an ISO date (YYYY-MM-DD).
// Sending {"due_date": null} marks the user as onboarded without a date
// (the onboarding "아직 정해지지 않았어요" escape hatch).
//
// dismiss_voice_coachmark: set to true from the home screen when the user
// closes the voice-record coachmark. The backend stamps the dismissal time
// so the coachmark never re-appears, even after reinstall. Must not be
// combined with due_date in the same request.
type patchMeBody struct {
	DueDate               *string `json:"due_date"`
	DismissVoiceCoachmark *bool   `json:"dismiss_voice_coachmark"`
}

// PatchMe updates the authenticated user's onboarding fields. It accepts
// a single optional due_date and always stamps onboarded_at.
func (h *Handlers) PatchMe(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body patchMeBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}

	// Voice coachmark dismissal is a distinct action and is not combined
	// with onboarding fields in the same call.
	if body.DismissVoiceCoachmark != nil && *body.DismissVoiceCoachmark {
		if body.DueDate != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid body")
			return
		}
		// Existence check on the user itself — the onboarding row is
		// guaranteed by the signup tx, but we still want 404 for a bogus id.
		if _, err := h.Store.GetByID(r.Context(), id); err != nil {
			if errors.Is(err, ErrNotFound) {
				httpx.WriteError(w, http.StatusNotFound, "user not found")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
		if err := h.Onboarding.DismissVoiceCoachmark(r.Context(), id); err != nil {
			if errors.Is(err, onboarding.ErrNotFound) {
				httpx.WriteError(w, http.StatusNotFound, "user not found")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
		resp, err := h.LoadMe(r, id)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, resp)
		return
	}

	if body.DueDate != nil {
		s := *body.DueDate
		if !isoDateRe.MatchString(s) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid date")
			return
		}
		if _, err := time.Parse("2006-01-02", s); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid date")
			return
		}
	}

	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	if err := h.Onboarding.UpdateDueDateAndOnboardedAt(r.Context(), id, body.DueDate); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	resp, err := h.LoadMe(r, id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
