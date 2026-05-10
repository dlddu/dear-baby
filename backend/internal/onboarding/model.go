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

// Fetus is a row in the `fetuses` table. Holds per-태아 input from Case A
// (and the 임신 부분 of Case B). Purposes are the 기록 목적 칩 labels —
// the Korean strings the user selected on A3 — stored verbatim. The client
// is responsible for replicating the user's purpose selection to every
// fetus row before sending; the server stores what it receives.
type Fetus struct {
	Ordinal       int      `json:"ordinal"`
	Nickname      *string  `json:"nickname"`
	Gender        *string  `json:"gender"`
	PregnancyWeek *int     `json:"pregnancy_week"`
	DueDate       *string  `json:"due_date"`
	Purposes      []string `json:"purposes"`
}

// Child is a row in the `children` table. Holds per-아이 input from Case C
// (and the 양육 부분 of Case B). Same purposes-replication contract as Fetus.
type Child struct {
	Ordinal   int      `json:"ordinal"`
	Name      *string  `json:"name"`
	Gender    *string  `json:"gender"`
	BirthDate *string  `json:"birth_date"`
	Bio       *string  `json:"bio"`
	Purposes  []string `json:"purposes"`
}
