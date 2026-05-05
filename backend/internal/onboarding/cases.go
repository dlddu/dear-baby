package onboarding

// Case enumerates the three onboarding branches defined by PRD-006
// AC-006-01 — the user's combination of pregnancy / parenting answers
// pins them to exactly one of these. Stored in onboarding.case_kind.
type Case string

const (
	CaseA Case = "A" // 임신 O · 양육 X
	CaseB Case = "B" // 임신 O · 양육 O
	CaseC Case = "C" // 임신 X · 양육 O
)

// Valid reports whether c is one of the three defined cases.
func (c Case) Valid() bool {
	switch c {
	case CaseA, CaseB, CaseC:
		return true
	}
	return false
}

// ChildKind discriminates a child row between fetus (still in the womb)
// and child (already born). The same row can transition from fetus to
// child at birth (AC-006-06) by updating kind + birth_date.
type ChildKind string

const (
	ChildKindFetus ChildKind = "fetus"
	ChildKindChild ChildKind = "child"
)

// Valid reports whether k is a defined kind.
func (k ChildKind) Valid() bool {
	switch k {
	case ChildKindFetus, ChildKindChild:
		return true
	}
	return false
}

// Gender is one of three user-facing gender options. "undecided" is a
// first-class value because the PRD requires it always be selectable
// (see "입력 허들 낮추는 장치" in docs/wireframes/onboarding.md).
type Gender string

const (
	GenderMale      Gender = "male"
	GenderFemale    Gender = "female"
	GenderUndecided Gender = "undecided"
)

// Valid reports whether g is a defined gender.
func (g Gender) Valid() bool {
	switch g {
	case GenderMale, GenderFemale, GenderUndecided:
		return true
	}
	return false
}

// RecordPurpose is the user's reason for keeping records about a child.
// Multi-select per child; the M:N relationship lives in
// child_record_purposes.
type RecordPurpose string

const (
	PurposeBookMaking    RecordPurpose = "book_making"
	PurposeMemoryKeeping RecordPurpose = "memory_keeping"
	PurposeFamilyShare   RecordPurpose = "family_share"
	PurposeEmotionDiary  RecordPurpose = "emotion_diary"
)

// Valid reports whether p is a defined purpose.
func (p RecordPurpose) Valid() bool {
	switch p {
	case PurposeBookMaking, PurposeMemoryKeeping, PurposeFamilyShare, PurposeEmotionDiary:
		return true
	}
	return false
}
