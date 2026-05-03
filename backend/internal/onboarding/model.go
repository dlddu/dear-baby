package onboarding

import "time"

// Onboarding is a row in the `onboarding` table. All fields except UserID
// are nullable — they are stamped incrementally as the user progresses
// through PRD-006 case-branching (IsPregnant, HasChildren, MultiplePregnancy
// → OnboardedAt), the home-screen coachmark (VoiceCoachmarkDismissedAt),
// and the first record + AI preview (FirstRecordAt, AIPreview).
//
// DueDate is preserved here as a dead column for migration tidiness; the
// real per-child due date now lives on `children.due_date`. Profile no
// longer surfaces it.
type Onboarding struct {
	UserID                    string
	DueDate                   *string
	OnboardedAt               *time.Time
	VoiceCoachmarkDismissedAt *time.Time
	FirstRecordAt             *time.Time
	AIPreview                 *string
	IsPregnant                *bool
	HasChildren               *bool
	MultiplePregnancy         *bool
	UpdatedAt                 time.Time
}
