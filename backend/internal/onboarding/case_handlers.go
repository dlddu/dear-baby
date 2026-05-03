package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/children"
	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// CaseStore is the slice of onboarding.Store the case-branching handlers
// depend on. Declared as an interface so handlers_test can supply a fake
// without spinning up SQLite.
type CaseStore interface {
	SetCase(ctx context.Context, userID string, isPregnant, hasChildren *bool) error
	SetMultiplePregnancy(ctx context.Context, userID string, value bool) error
	Complete(ctx context.Context, userID string) error
}

// ChildrenStore is the slice of children.Store needed for the batch submit
// endpoint. Same testability rationale as CaseStore.
type ChildrenStore interface {
	ReplaceAll(ctx context.Context, userID string, inputs []children.ChildInput) ([]children.Child, error)
}

// CaseHandlers exposes PRD-006 케이스 분기 온보딩 endpoints. The four
// endpoints map 1:1 to the wireframe's submit points: case answers (S1·S2),
// 단태/다태 toggle (Case A only), per-child batch (replaces every child),
// and completion stamp.
type CaseHandlers struct {
	Onboarding      CaseStore
	Children        ChildrenStore
	UserIDFromCtxFn func(r *http.Request) (string, bool)
}

// caseBody mirrors the two-question form on the case-pregnancy/case-children
// screens. Both fields are required pointers so {"is_pregnant":false} stays
// distinguishable from "field omitted."
type caseBody struct {
	IsPregnant  *bool `json:"is_pregnant"`
	HasChildren *bool `json:"has_children"`
}

// SetCase persists the AC-006-01 두 개의 독립 체크 답변. Idempotent.
func (h *CaseHandlers) SetCase(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body caseBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.IsPregnant == nil || body.HasChildren == nil {
		httpx.WriteError(w, http.StatusBadRequest, "is_pregnant and has_children required")
		return
	}
	if err := h.Onboarding.SetCase(r.Context(), userID, body.IsPregnant, body.HasChildren); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// multiplePregnancyBody is a single-bool body — using a struct keeps the
// JSON shape future-proof.
type multiplePregnancyBody struct {
	Value *bool `json:"value"`
}

// SetMultiplePregnancy stores the 단태/다태 toggle for Case A.
func (h *CaseHandlers) SetMultiplePregnancy(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body multiplePregnancyBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil || body.Value == nil {
		httpx.WriteError(w, http.StatusBadRequest, "value required")
		return
	}
	if err := h.Onboarding.SetMultiplePregnancy(r.Context(), userID, *body.Value); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// childInputJSON is the wire shape for one child in the SubmitChildren
// payload. Field names match the mobile draft so the client can send its
// state over with no translation.
type childInputJSON struct {
	Status             string   `json:"status"`
	Name               *string  `json:"name"`
	Gender             string   `json:"gender"`
	BirthDate          *string  `json:"birth_date"`
	DueDate            *string  `json:"due_date"`
	PregnancyWeek      *int     `json:"pregnancy_week"`
	Bio                *string  `json:"bio"`
	PhotoS3Key         *string  `json:"photo_s3_key"`
	IsDueDateUndecided bool     `json:"is_due_date_undecided"`
	Purposes           []string `json:"purposes"`
}

// submitChildrenBody is the entire onboarding batch — every child the user
// has, in display order, with per-child purposes embedded.
type submitChildrenBody struct {
	Children []childInputJSON `json:"children"`
}

// isoDateRe validates the wire-format YYYY-MM-DD before sending it to the
// store. The store relies on this for shape only; calendar validity is
// re-checked via time.Parse below.
var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// SubmitChildren persists the entire children + purposes set for the user
// in a single transaction. Replaces any prior rows. Returns the canonical
// list (server-assigned IDs/timestamps) so the client can mirror state
// without a /me round-trip.
func (h *CaseHandlers) SubmitChildren(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body submitChildrenBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Children) == 0 {
		httpx.WriteError(w, http.StatusBadRequest, "at least one child required")
		return
	}
	inputs := make([]children.ChildInput, 0, len(body.Children))
	for _, c := range body.Children {
		status := children.Status(c.Status)
		gender := children.Gender(c.Gender)
		if !status.Valid() {
			httpx.WriteError(w, http.StatusBadRequest, "invalid status")
			return
		}
		if !gender.Valid() {
			httpx.WriteError(w, http.StatusBadRequest, "invalid gender")
			return
		}
		if c.BirthDate != nil && !validDate(*c.BirthDate) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid birth_date")
			return
		}
		if c.DueDate != nil && !validDate(*c.DueDate) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid due_date")
			return
		}
		inputs = append(inputs, children.ChildInput{
			Status:             status,
			Name:               c.Name,
			Gender:             gender,
			BirthDate:          c.BirthDate,
			DueDate:            c.DueDate,
			PregnancyWeek:      c.PregnancyWeek,
			Bio:                c.Bio,
			PhotoS3Key:         c.PhotoS3Key,
			IsDueDateUndecided: c.IsDueDateUndecided,
			Purposes:           c.Purposes,
		})
	}
	if _, err := h.Children.ReplaceAll(r.Context(), userID, inputs); err != nil {
		if errors.Is(err, children.ErrInvalidChild) {
			httpx.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Complete stamps onboarded_at, finishing the funnel.
func (h *CaseHandlers) Complete(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.Onboarding.Complete(r.Context(), userID); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validDate(s string) bool {
	if !isoDateRe.MatchString(s) {
		return false
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}
