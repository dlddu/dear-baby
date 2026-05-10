package users

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// OnboardingUpdater is the minimal surface the users.Handlers need from
// the onboarding store. Declared as an interface so the users package does
// not import the onboarding package. The router wires in the concrete
// *onboarding.Store.
type OnboardingUpdater interface {
	UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error
	DismissVoiceCoachmark(ctx context.Context, userID string) error
	UpsertCaseA(ctx context.Context, userID string, dueDate *string, fetuses []OnboardingFetus) error
	UpsertCaseC(ctx context.Context, userID string, children []OnboardingChild) error
}

// OnboardingFetus is the wire-shape for one fetus in the Case A payload.
// Lives here (not in onboarding) so the users package can keep
// OnboardingUpdater as the only seam against the onboarding package. The
// router adapts onboarding.Store to satisfy this surface.
type OnboardingFetus struct {
	Nickname      *string
	Gender        *string
	PregnancyWeek *int
	DueDate       *string
	Purposes      []string
}

// OnboardingChild is the wire-shape for one child in the Case C payload.
type OnboardingChild struct {
	Name      *string
	Gender    *string
	BirthDate *string
	Bio       *string
	Purposes  []string
}

// Handlers exposes the user-scoped HTTP handlers.
type Handlers struct {
	Store                 *Store
	Onboarding            OnboardingUpdater
	OnboardingErrNotFound error // sentinel from the onboarding package, for error mapping
	UserIDFromCtxFn       func(r *http.Request) (string, bool)
}

// Me returns the authenticated user's profile — the flat view that merges
// users + onboarding.
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	p, err := h.Store.GetProfile(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

// isoDateRe matches the YYYY-MM-DD shape we accept for due_date; we also
// validate the date is real (e.g., rejects 2025-02-31) below via time.Parse.
var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// patchMeBody is the request body for PATCH /me. Either due_date or
// dismiss_voice_coachmark is sent — never both in the same call.
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

	if body.DismissVoiceCoachmark != nil && *body.DismissVoiceCoachmark {
		if body.DueDate != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if err := h.Onboarding.DismissVoiceCoachmark(r.Context(), id); err != nil {
			if isOnboardingNotFound(err, h.OnboardingErrNotFound) {
				httpx.WriteError(w, http.StatusNotFound, "user not found")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
		p, err := h.Store.GetProfile(r.Context(), id)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				httpx.WriteError(w, http.StatusNotFound, "user not found")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "internal")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, p)
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

	// Validate user exists before writing to onboarding — keeps 404
	// semantics consistent when the onboarding row is created lazily.
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	if err := h.Onboarding.UpdateDueDateAndOnboardedAt(r.Context(), id, body.DueDate); err != nil {
		if isOnboardingNotFound(err, h.OnboardingErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	p, err := h.Store.GetProfile(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

func isOnboardingNotFound(err error, sentinel error) bool {
	if sentinel != nil && errors.Is(err, sentinel) {
		return true
	}
	return errors.Is(err, sql.ErrNoRows)
}

// caseAFetusBody is one entry in the Case A payload's `fetuses` array.
// Field-level validation rules are enforced in PostOnboardingCaseA.
type caseAFetusBody struct {
	Nickname      *string  `json:"nickname"`
	Gender        *string  `json:"gender"`
	PregnancyWeek *int     `json:"pregnancy_week"`
	DueDate       *string  `json:"due_date"`
	Purposes      []string `json:"purposes"`
}

type caseABody struct {
	DueDate *string          `json:"due_date"`
	Fetuses []caseAFetusBody `json:"fetuses"`
}

type caseCChildBody struct {
	Name      *string  `json:"name"`
	Gender    *string  `json:"gender"`
	BirthDate *string  `json:"birth_date"`
	Bio       *string  `json:"bio"`
	Purposes  []string `json:"purposes"`
}

type caseCBody struct {
	Children []caseCChildBody `json:"children"`
}

// PostOnboardingCaseA persists the Case A onboarding payload — the
// chosen due date plus one row per fetus — and stamps onboarded_at. The
// client is expected to replicate the chosen purposes to every fetus
// (다태에서도 1회만 묻는 UX); the server stores what it receives.
func (h *Handlers) PostOnboardingCaseA(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body caseABody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Fetuses) == 0 {
		httpx.WriteError(w, http.StatusBadRequest, "fetuses required")
		return
	}
	if body.DueDate != nil && !validDate(*body.DueDate) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid date")
		return
	}
	for _, f := range body.Fetuses {
		if f.DueDate != nil && !validDate(*f.DueDate) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid date")
			return
		}
		if !validPurposes(f.Purposes) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid purpose")
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

	fetuses := make([]OnboardingFetus, 0, len(body.Fetuses))
	for _, f := range body.Fetuses {
		fetuses = append(fetuses, OnboardingFetus{
			Nickname:      f.Nickname,
			Gender:        f.Gender,
			PregnancyWeek: f.PregnancyWeek,
			DueDate:       f.DueDate,
			Purposes:      ensureStringSlice(f.Purposes),
		})
	}
	if err := h.Onboarding.UpsertCaseA(r.Context(), id, body.DueDate, fetuses); err != nil {
		if isOnboardingNotFound(err, h.OnboardingErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	p, err := h.Store.GetProfile(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

// PostOnboardingCaseC persists the Case C onboarding payload — one row
// per child — and stamps onboarded_at with due_date null.
func (h *Handlers) PostOnboardingCaseC(w http.ResponseWriter, r *http.Request) {
	id, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body caseCBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Children) == 0 {
		httpx.WriteError(w, http.StatusBadRequest, "children required")
		return
	}
	for _, c := range body.Children {
		if c.BirthDate != nil && !validDate(*c.BirthDate) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid date")
			return
		}
		if !validPurposes(c.Purposes) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid purpose")
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

	children := make([]OnboardingChild, 0, len(body.Children))
	for _, c := range body.Children {
		children = append(children, OnboardingChild{
			Name:      c.Name,
			Gender:    c.Gender,
			BirthDate: c.BirthDate,
			Bio:       c.Bio,
			Purposes:  ensureStringSlice(c.Purposes),
		})
	}
	if err := h.Onboarding.UpsertCaseC(r.Context(), id, children); err != nil {
		if isOnboardingNotFound(err, h.OnboardingErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	p, err := h.Store.GetProfile(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

func validDate(s string) bool {
	if !isoDateRe.MatchString(s) {
		return false
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

// validPurposes enforces the per-label length budget. The labels themselves
// are the canonical identifier (see glossary.md) — there is no whitelist;
// callers send Korean strings as picked from the chip grid, and the
// server only rejects empty strings and runaway lengths.
func validPurposes(p []string) bool {
	for _, label := range p {
		if label == "" {
			return false
		}
		if len([]rune(label)) > 100 {
			return false
		}
	}
	return true
}

func ensureStringSlice(p []string) []string {
	if p == nil {
		return []string{}
	}
	return p
}
