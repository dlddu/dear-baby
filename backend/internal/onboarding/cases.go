package onboarding

// Case is the case-branching onboarding bucket — three combinations of
// (pregnancy?, parenting?) that determine the funnel screens and the
// shape of `children` rows the user submits.
//
//	A — pregnancy only (≥1 fetus)
//	B — parenting + pregnancy (≥1 child + ≥1 fetus)
//	C — parenting only (≥1 child)
//
// The Q1×Q2 (no, no) combination is steered to A in the UI with a
// "we built this for expecting parents" copy; the server still records
// it as Case A.
type Case string

const (
	CaseA Case = "A"
	CaseB Case = "B"
	CaseC Case = "C"
)

// Valid reports whether c is one of the three accepted case kinds.
func (c Case) Valid() bool {
	switch c {
	case CaseA, CaseB, CaseC:
		return true
	}
	return false
}

// ChildKind discriminates a row in the `children` table between an
// already-born child and a fetus carried by the user. The same table
// holds both so AC-006-06 (birth transition) can flip a row in place.
type ChildKind string

const (
	ChildKindFetus ChildKind = "fetus"
	ChildKindChild ChildKind = "child"
)

// Valid reports whether k is one of the two accepted kinds.
func (k ChildKind) Valid() bool {
	return k == ChildKindFetus || k == ChildKindChild
}

// Gender enumerates the gender values the onboarding form collects.
// "undecided" is always offered so users without a confirmed result
// can finish the funnel.
type Gender string

const (
	GenderMale      Gender = "male"
	GenderFemale    Gender = "female"
	GenderUndecided Gender = "undecided"
)

// Valid reports whether g is one of the three accepted gender values.
func (g Gender) Valid() bool {
	switch g {
	case GenderMale, GenderFemale, GenderUndecided:
		return true
	}
	return false
}

// RecordPurpose is one of the multi-select "what do you want to record
// for?" options collected on A3 / B6 / C3. Stored normalized (one row
// per (child_id, purpose)) in `child_record_purposes`.
type RecordPurpose string

const (
	PurposeBookMaking    RecordPurpose = "book_making"
	PurposeMemoryKeeping RecordPurpose = "memory_keeping"
	PurposeFamilyShare   RecordPurpose = "family_share"
	PurposeEmotionDiary  RecordPurpose = "emotion_diary"
)

// Valid reports whether p is a known record purpose.
func (p RecordPurpose) Valid() bool {
	switch p {
	case PurposeBookMaking, PurposeMemoryKeeping, PurposeFamilyShare, PurposeEmotionDiary:
		return true
	}
	return false
}
