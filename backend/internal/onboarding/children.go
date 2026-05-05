package onboarding

import "time"

// ChildRow mirrors the `children` table. `kind` discriminates fetus from
// already-born child; the other fields are nullable in different
// combinations depending on kind (fetus has pregnancy_weeks + due_date,
// child has birth_date and optional photo + introduction).
type ChildRow struct {
	ID             string
	UserID         string
	Kind           ChildKind
	DisplayName    *string
	Gender         Gender
	Introduction   *string
	PhotoS3Key     *string
	BirthDate      *string // YYYY-MM-DD, child only
	PregnancyWeeks *int    // fetus only
	DueDate        *string // YYYY-MM-DD, fetus only
	SortOrder      int
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ChildInput is the wire shape for one entry in POST /onboarding/case
// (see SubmitCasePayload). Validation lives in handlers.go; the store
// trusts inputs that reached it.
type ChildInput struct {
	Kind           ChildKind       `json:"kind"`
	DisplayName    *string         `json:"display_name"`
	Gender         Gender          `json:"gender"`
	Introduction   *string         `json:"introduction"`
	PhotoTmpKey    *string         `json:"photo_tmp_key"`
	BirthDate      *string         `json:"birth_date"`
	PregnancyWeeks *int            `json:"pregnancy_weeks"`
	DueDate        *string         `json:"due_date"`
	Purposes       []RecordPurpose `json:"purposes"`
}

// SubmitCasePayload is the body of POST /onboarding/case. The case
// determines the allowed child kinds and the validator enforces the
// intersection with the children list.
type SubmitCasePayload struct {
	Case     Case         `json:"case"`
	Children []ChildInput `json:"children"`
}
