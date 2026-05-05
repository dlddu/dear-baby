package onboarding

// Case identifies which onboarding branch a user took. The mapping comes
// from the two yes/no questions in docs/wireframes/onboarding/common.svg
// (Q1 임신 여부, Q2 양육 여부):
//
//	A → 임신 O · 양육 X
//	B → 임신 O · 양육 O  (핵심 추가 케이스)
//	C → 임신 X · 양육 O
//
// 임신 X · 양육 X 조합은 PRD-006 명세상 양해 카피 후 Case A 로 안내한다.
type Case string

const (
	CaseA Case = "A"
	CaseB Case = "B"
	CaseC Case = "C"
)

// Valid returns true if c is one of the three defined cases. Used in
// JSON validation; the SQL CHECK constraint backs this up at the
// storage layer.
func (c Case) Valid() bool {
	switch c {
	case CaseA, CaseB, CaseC:
		return true
	}
	return false
}

// ChildKind distinguishes the two child rows we accept on submission.
// Stored on `children.kind` and read back as the discriminator that
// switches required fields (birth_date for child / pregnancy_weeks +
// due_date for fetus).
type ChildKind string

const (
	KindFetus ChildKind = "fetus"
	KindChild ChildKind = "child"
)

func (k ChildKind) Valid() bool {
	switch k {
	case KindFetus, KindChild:
		return true
	}
	return false
}

// Gender enumerates the gender choices the wireframes expose. "미정"
// (undecided) is always available so the user can finish the funnel
// without committing to a specific value early on.
type Gender string

const (
	GenderMale      Gender = "male"
	GenderFemale    Gender = "female"
	GenderUndecided Gender = "undecided"
)

func (g Gender) Valid() bool {
	switch g {
	case GenderMale, GenderFemale, GenderUndecided:
		return true
	}
	return false
}

// RecordPurpose enumerates the per-child recording purposes. Drives the
// final selection screens A3 / B6 / C3. Stored as M:N rows in
// child_record_purposes; the DB CHECK constraint enforces the same set.
type RecordPurpose string

const (
	PurposeBookMaking    RecordPurpose = "book_making"
	PurposeMemoryKeeping RecordPurpose = "memory_keeping"
	PurposeFamilyShare   RecordPurpose = "family_share"
	PurposeEmotionDiary  RecordPurpose = "emotion_diary"
)

func (p RecordPurpose) Valid() bool {
	switch p {
	case PurposeBookMaking, PurposeMemoryKeeping, PurposeFamilyShare, PurposeEmotionDiary:
		return true
	}
	return false
}
