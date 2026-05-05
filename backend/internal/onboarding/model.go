package onboarding

import "time"

// Onboarding is a row in the `onboarding` table. All fields except UserID
// are nullable — they are stamped incrementally as the user completes
// the case-branching onboarding (CaseKind, OnboardedAt), dismisses the
// home-screen voice coachmark (VoiceCoachmarkDismissedAt), or saves
// their first record + AI preview (FirstRecordAt, AIPreview).
type Onboarding struct {
	UserID                    string
	CaseKind                  *Case
	OnboardedAt               *time.Time
	VoiceCoachmarkDismissedAt *time.Time
	FirstRecordAt             *time.Time
	AIPreview                 *string
	UpdatedAt                 time.Time
}
