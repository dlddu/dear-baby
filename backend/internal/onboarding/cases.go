package onboarding

// Case is the branch a user lands on after the two independent yes/no
// checks at the top of the onboarding funnel (Q1 임신 / Q2 양육):
//
//	A — 임신 O · 양육 X (only fetus children)
//	B — 임신 O · 양육 O (mixed: fetus + child)
//	C — 임신 X · 양육 O (only born children)
//
// See docs/prd/PRD-006-onboarding-cases.md AC-006-01~04 and
// docs/flows/onboarding-flow.md.
type Case string

const (
	CaseA Case = "A"
	CaseB Case = "B"
	CaseC Case = "C"
)

// ParseCase normalizes a wire value into a Case. Returns false for any
// other input including empty string (the case is mandatory on submit).
func ParseCase(s string) (Case, bool) {
	switch s {
	case string(CaseA):
		return CaseA, true
	case string(CaseB):
		return CaseB, true
	case string(CaseC):
		return CaseC, true
	}
	return "", false
}

// ChildKind discriminates fetus rows from already-born child rows in the
// shared `children` table. Stored as TEXT in SQLite ("fetus"|"child").
type ChildKind string

const (
	ChildKindFetus ChildKind = "fetus"
	ChildKindChild ChildKind = "child"
)

// ParseChildKind normalizes a wire value. Empty string is rejected — the
// caller must always specify which side of the case the row belongs to.
func ParseChildKind(s string) (ChildKind, bool) {
	switch s {
	case string(ChildKindFetus):
		return ChildKindFetus, true
	case string(ChildKindChild):
		return ChildKindChild, true
	}
	return "", false
}

// Gender enumerates the values stored in `children.gender`. "undecided"
// matches the wireframe's "미정" option, which is required because users
// are encouraged not to gender a fetus they don't know about yet.
type Gender string

const (
	GenderMale      Gender = "male"
	GenderFemale    Gender = "female"
	GenderUndecided Gender = "undecided"
)

// ParseGender normalizes a wire value. Empty rejected — the form always
// has a default "미정" selection so the field cannot be missing.
func ParseGender(s string) (Gender, bool) {
	switch s {
	case string(GenderMale):
		return GenderMale, true
	case string(GenderFemale):
		return GenderFemale, true
	case string(GenderUndecided):
		return GenderUndecided, true
	}
	return "", false
}

// RecordPurpose enumerates the buckets we surface as "어떤 목적으로 기록
// 하시나요?" on screens A3 / B6 / C3. Stored verbatim in the
// `child_record_purposes.purpose` column.
type RecordPurpose string

const (
	PurposeBookMaking    RecordPurpose = "book_making"
	PurposeMemoryKeeping RecordPurpose = "memory_keeping"
	PurposeFamilyShare   RecordPurpose = "family_share"
	PurposeEmotionDiary  RecordPurpose = "emotion_diary"
)

// ParseRecordPurpose normalizes a wire value. Returns false for unknown
// strings so the validator can reject mixed-old-new payloads.
func ParseRecordPurpose(s string) (RecordPurpose, bool) {
	switch s {
	case string(PurposeBookMaking):
		return PurposeBookMaking, true
	case string(PurposeMemoryKeeping):
		return PurposeMemoryKeeping, true
	case string(PurposeFamilyShare):
		return PurposeFamilyShare, true
	case string(PurposeEmotionDiary):
		return PurposeEmotionDiary, true
	}
	return "", false
}
