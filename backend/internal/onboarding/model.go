package onboarding

import "time"

// Onboarding is a row in the `onboarding` table. All fields except UserID
// are nullable — they are stamped incrementally as the user progresses
// through Stage 1 (DueDate, OnboardedAt), the home-screen coachmark
// (VoiceCoachmarkDismissedAt), and the first record + AI preview
// (FirstRecordAt, AIPreview).
type Onboarding struct {
	UserID                    string
	DueDate                   *string
	OnboardedAt               *time.Time
	VoiceCoachmarkDismissedAt *time.Time
	FirstRecordAt             *time.Time
	AIPreview                 *string
	UpdatedAt                 time.Time
}
