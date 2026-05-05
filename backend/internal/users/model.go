package users

import "time"

// User represents a row in the users table. Core identity only — all
// onboarding-related state (case_kind, onboarded_at, voice coachmark
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
// `case_kind` is `"A"|"B"|"C"|null` once the user finishes the case
// branching funnel; `onboarded_at` is the completion stamp.
type Profile struct {
	ID                        string     `json:"id"`
	Email                     string     `json:"email"`
	Name                      string     `json:"name"`
	PictureURL                string     `json:"picture_url"`
	CaseKind                  *string    `json:"case_kind"`
	OnboardedAt               *time.Time `json:"onboarded_at"`
	VoiceCoachmarkDismissedAt *time.Time `json:"voice_coachmark_dismissed_at"`
	FirstRecordAt             *time.Time `json:"first_record_at"`
	AIPreview                 *string    `json:"ai_preview"`
	CreatedAt                 time.Time  `json:"created_at"`
	UpdatedAt                 time.Time  `json:"updated_at"`
}
