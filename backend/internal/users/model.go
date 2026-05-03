package users

import "time"

// User represents a row in the users table. Core identity only — all
// onboarding-related state (due_date, onboarded_at, voice coachmark
// dismissal, first_record_at, ai_preview) lives in the `onboarding` table
// and is merged into Profile for the /me response.
type User struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	PictureURL string    `json:"picture_url"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Profile is the flat view returned by GET /me and POST /records. It
// preserves the shape the client had before the onboarding-table move so
// the app can keep treating the response as a single object.
//
// PRD-006 fields (IsPregnant, HasChildren, MultiplePregnancy, Children,
// Purposes) are appended; existing fields stay in their original order to
// keep the JSON wire shape additive. DueDate is deprecated — the real
// per-child due date lives on Children[i].DueDate. The field is preserved
// in the response shape but always emitted as null.
type Profile struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	PictureURL string `json:"picture_url"`
	// DueDate is always null after PRD-006. Preserved for backward
	// compatibility with the User type on the mobile client; new readers
	// should use Children[i].DueDate.
	DueDate                   *string     `json:"due_date"`
	OnboardedAt               *time.Time  `json:"onboarded_at"`
	VoiceCoachmarkDismissedAt *time.Time  `json:"voice_coachmark_dismissed_at"`
	FirstRecordAt             *time.Time  `json:"first_record_at"`
	AIPreview                 *string     `json:"ai_preview"`
	IsPregnant                *bool       `json:"is_pregnant"`
	HasChildren               *bool       `json:"has_children"`
	MultiplePregnancy         *bool       `json:"multiple_pregnancy"`
	Children                  []ChildView `json:"children"`
	CreatedAt                 time.Time   `json:"created_at"`
	UpdatedAt                 time.Time   `json:"updated_at"`
}

// ChildView is the per-child slice surfaced inside Profile.Children. It is
// flat so RN consumers can render directly without hydration helpers; the
// Purposes string slice mirrors the order the user picked them in.
type ChildView struct {
	ID                 string    `json:"id"`
	Status             string    `json:"status"`
	Name               *string   `json:"name"`
	Gender             string    `json:"gender"`
	BirthDate          *string   `json:"birth_date"`
	DueDate            *string   `json:"due_date"`
	PregnancyWeek      *int      `json:"pregnancy_week"`
	Bio                *string   `json:"bio"`
	PhotoS3Key         *string   `json:"photo_s3_key"`
	IsDueDateUndecided bool      `json:"is_due_date_undecided"`
	DisplayOrder       int       `json:"display_order"`
	Purposes           []string  `json:"purposes"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}
