package onboarding

import "time"

// Child is a row in the `children` table — either a fetus or a born
// child. Kind determines which subset of fields are meaningful;
// SaveCaseOnboarding enforces the kind-specific rules at write time so
// callers can rely on the invariants when reading.
type Child struct {
	ID             string
	UserID         string
	Kind           ChildKind
	DisplayName    *string
	Gender         Gender
	Introduction   *string
	PhotoS3Key     *string
	BirthDate      *string // YYYY-MM-DD, only for kind=child
	PregnancyWeeks *int    // only for kind=fetus
	DueDate        *string // YYYY-MM-DD, only for kind=fetus
	SortOrder      int
	CreatedAt      time.Time
	UpdatedAt      time.Time
	Purposes       []RecordPurpose
}

// ChildInput is the wire-form payload for one child inside POST
// /onboarding/case. Validation lives in handlers — this struct only
// transports the fields. PhotoTmpKey is the staging key the client got
// from POST /onboarding/children/photo/upload-url; SaveCaseOnboarding
// renames it to a permanent location once the child id is known.
type ChildInput struct {
	Kind           ChildKind       `json:"kind"`
	DisplayName    *string         `json:"display_name,omitempty"`
	Gender         Gender          `json:"gender"`
	Introduction   *string         `json:"introduction,omitempty"`
	PhotoTmpKey    *string         `json:"photo_tmp_key,omitempty"`
	BirthDate      *string         `json:"birth_date,omitempty"`
	PregnancyWeeks *int            `json:"pregnancy_weeks,omitempty"`
	DueDate        *string         `json:"due_date,omitempty"`
	Purposes       []RecordPurpose `json:"purposes"`
}

// CaseOnboardingInput is the body for POST /onboarding/case. Once
// validated and persisted by SaveCaseOnboarding, the user transitions
// from status='onboarding' to 'authenticated' on the client.
type CaseOnboardingInput struct {
	Case     Case         `json:"case"`
	Children []ChildInput `json:"children"`
}
