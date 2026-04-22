package onboarding

import "time"

// Onboarding is a row in the `onboarding` table: one per user, tracking
// Stage 1 completion (due_date, onboarded_at), Stage 2 coachmark dismissal,
// first-record timestamp, and the AI-edited preview generated from that
// first record.
type Onboarding struct {
	UserID                    string     `json:"user_id"`
	DueDate                   *string    `json:"due_date"`
	OnboardedAt               *time.Time `json:"onboarded_at"`
	VoiceCoachmarkDismissedAt *time.Time `json:"voice_coachmark_dismissed_at"`
	FirstRecordAt             *time.Time `json:"first_record_at"`
	AIPreview                 *string    `json:"ai_preview"`
	UpdatedAt                 time.Time  `json:"updated_at"`
}
