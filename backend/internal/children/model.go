// Package children models the per-child rows captured during PRD-006
// case-branching onboarding. A single table holds both currently-parented
// children (status='parenting') and in-utero pregnancies (status='pregnancy');
// the unification simplifies multi-child context iteration and the eventual
// pregnancy → parenting transition (AC-006-06). See
// docs/engineering/onboarding-cases-data-model.md for the trade-off rationale.
package children

import "time"

// Status discriminates parenting children from pregnancies.
type Status string

const (
	StatusParenting Status = "parenting"
	StatusPregnancy Status = "pregnancy"
)

// Valid reports whether s is a known status.
func (s Status) Valid() bool {
	return s == StatusParenting || s == StatusPregnancy
}

// Gender enumerates the three options offered in the onboarding wireframe
// (여아 / 남아 / 아직 모르겠어요). 'unknown' is the default escape hatch
// for early pregnancy.
type Gender string

const (
	GenderFemale  Gender = "female"
	GenderMale    Gender = "male"
	GenderUnknown Gender = "unknown"
)

// Valid reports whether g is a known gender.
func (g Gender) Valid() bool {
	return g == GenderFemale || g == GenderMale || g == GenderUnknown
}

// Child mirrors a row in the children table. All optional onboarding
// inputs (이름·태명, 사진, 한줄 소개, 임신 주차) are nullable. CHECK
// constraints in the schema enforce that parenting rows have a birth_date
// and pregnancy rows either a due_date or is_due_date_undecided=1.
type Child struct {
	ID                 string
	UserID             string
	Status             Status
	Name               *string
	Gender             Gender
	BirthDate          *string
	DueDate            *string
	PregnancyWeek      *int
	Bio                *string
	PhotoS3Key         *string
	IsDueDateUndecided bool
	DisplayOrder       int
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// Purpose is one of a child's recording-purpose tags. Position preserves
// the order the user selected the options in (today the wireframe shows
// purposes as a checkbox group, but order matters when the child later
// gets multiple per-aspect ranking UIs).
type Purpose struct {
	ChildID  string
	Purpose  string
	Position int
}
