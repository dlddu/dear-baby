package onboarding

import "time"

// ChildRow mirrors a row in the `children` table. Optional fields are
// pointers so we can distinguish "not provided" from a zero value when
// scanning SQL results.
type ChildRow struct {
	ID             string
	UserID         string
	Kind           ChildKind
	DisplayName    *string
	Gender         Gender
	Introduction   *string
	PhotoS3Key     *string
	BirthDate      *string // YYYY-MM-DD (kind=child only)
	PregnancyWeeks *int    // kind=fetus only
	DueDate        *string // YYYY-MM-DD (kind=fetus only)
	SortOrder      int
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ChildInput is the per-child payload accepted by POST /onboarding/case.
// JSON tags match the body documented in the implementation plan §4.2;
// Required fields per kind are validated by the handler — model-level
// validation only checks shape (enum values, non-blank when required).
type ChildInput struct {
	Kind           ChildKind       `json:"kind"`
	DisplayName    *string         `json:"display_name,omitempty"`
	Gender         Gender          `json:"gender"`
	Introduction   *string         `json:"introduction,omitempty"`
	BirthDate      *string         `json:"birth_date,omitempty"`
	PregnancyWeeks *int            `json:"pregnancy_weeks,omitempty"`
	DueDate        *string         `json:"due_date,omitempty"`
	PhotoTmpKey    *string         `json:"photo_tmp_key,omitempty"`
	Purposes       []RecordPurpose `json:"purposes"`
}

// CaseSubmission is the full POST /onboarding/case body. The payload is
// idempotent in the sense that submitting again with the same content
// after a transient failure is safe — the handler runs the whole thing
// inside a single SQL transaction and re-runs photo rename only when
// the original tmp key is still present in S3.
type CaseSubmission struct {
	Case     Case         `json:"case"`
	Children []ChildInput `json:"children"`
}
