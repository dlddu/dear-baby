package onboarding

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Case enumerates the three onboarding branches defined in PRD-006
// AC-006-01: A (pregnancy only), B (caregiver + pregnancy), C
// (caregiver only). The wire form is a single ASCII letter so the value
// can survive log lines, URLs, and header injection without quoting.
type Case string

const (
	CaseA Case = "A"
	CaseB Case = "B"
	CaseC Case = "C"
)

func (c Case) Valid() bool {
	switch c {
	case CaseA, CaseB, CaseC:
		return true
	}
	return false
}

// ChildKind is the per-row discriminator on the children table. Two
// values rather than two tables means the AC-006-06 birth transition is
// an UPDATE on the same row instead of an INSERT/DELETE pair, preserving
// the row id (and therefore foreign keys from records) across the
// transition.
type ChildKind string

const (
	ChildKindFetus ChildKind = "fetus"
	ChildKindChild ChildKind = "child"
)

func (k ChildKind) Valid() bool {
	switch k {
	case ChildKindFetus, ChildKindChild:
		return true
	}
	return false
}

// Gender is the third per-child field with a fixed enum. "undecided" is
// always available — see docs/wireframes/onboarding.md for the rationale
// (성별 미정 옵션 항상 포함).
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

// RecordPurpose is the closed enum the user picks from on the per-child
// record-purpose screen (A3 / B6 / C3). Stored in child_record_purposes
// as the raw enum string; introducing new options is a forward-only
// migration (existing rows stay valid).
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

// ChildInput is one element of POST /onboarding/case's `children` array.
// Field presence depends on Kind — the validator below enforces the
// kind-conditional fields rather than encoding them in the type system,
// so the JSON shape stays flat for the client.
type ChildInput struct {
	Kind           ChildKind       `json:"kind"`
	DisplayName    string          `json:"display_name"`
	Gender         Gender          `json:"gender"`
	Introduction   string          `json:"introduction"`
	PhotoTmpKey    string          `json:"photo_tmp_key"`
	BirthDate      string          `json:"birth_date"`
	PregnancyWeeks *int            `json:"pregnancy_weeks"`
	DueDate        string          `json:"due_date"`
	Purposes       []RecordPurpose `json:"purposes"`
}

// CaseSubmission is the body the client POSTs to /onboarding/case at the
// end of the funnel.
type CaseSubmission struct {
	Case     Case         `json:"case"`
	Children []ChildInput `json:"children"`
}

// ChildRow is the post-write view of a child returned by GetCase.
type ChildRow struct {
	ID             string
	UserID         string
	Kind           ChildKind
	DisplayName    *string
	Gender         Gender
	Introduction   *string
	PhotoS3Key     *string
	BirthDate      *string
	PregnancyWeeks *int
	DueDate        *string
	SortOrder      int
	Purposes       []RecordPurpose
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ErrInvalidPayload is returned when the submitted case payload fails
// the cross-field validation. Handlers map it to 400.
var ErrInvalidPayload = errors.New("invalid onboarding case payload")

// invalidf wraps ErrInvalidPayload with a human-readable detail. The
// detail surfaces in handler logs and (today) in the 400 response body
// so the client can show targeted feedback during development; in
// production the body is intentionally generic but the error type drives
// status mapping.
func invalidf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidPayload, fmt.Sprintf(format, args...))
}

var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// minPregnancyWeeks / maxPregnancyWeeks frame what the picker on A2/B5
// can produce. The wide upper bound (45) leaves headroom for late-term
// edge cases without enabling obvious typos.
const (
	minPregnancyWeeks = 1
	maxPregnancyWeeks = 45
	maxNameRunes      = 80
	maxIntroRunes     = 200
)

// Validate runs the cross-field validation described in PRD-006 §4.3 of
// the implementation plan. Pure CPU — no I/O — so it can run early and
// reject malformed bodies before the handler touches the DB or S3.
func (s *CaseSubmission) Validate() error {
	if !s.Case.Valid() {
		return invalidf("unknown case %q", s.Case)
	}
	if len(s.Children) == 0 {
		return invalidf("children must not be empty")
	}

	// Per-child shape + kind-conditional fields.
	var (
		fetusN int
		childN int
	)
	for i, c := range s.Children {
		if !c.Kind.Valid() {
			return invalidf("children[%d].kind invalid", i)
		}
		if !c.Gender.Valid() {
			return invalidf("children[%d].gender invalid", i)
		}
		if n := runeCount(c.DisplayName); n > maxNameRunes {
			return invalidf("children[%d].display_name too long", i)
		}
		if n := runeCount(c.Introduction); n > maxIntroRunes {
			return invalidf("children[%d].introduction too long", i)
		}
		switch c.Kind {
		case ChildKindFetus:
			fetusN++
			if c.BirthDate != "" {
				return invalidf("children[%d]: fetus must not have birth_date", i)
			}
			if c.PregnancyWeeks == nil {
				return invalidf("children[%d]: fetus requires pregnancy_weeks", i)
			}
			if w := *c.PregnancyWeeks; w < minPregnancyWeeks || w > maxPregnancyWeeks {
				return invalidf("children[%d]: pregnancy_weeks out of range", i)
			}
			if !isISODate(c.DueDate) {
				return invalidf("children[%d]: fetus requires due_date YYYY-MM-DD", i)
			}
		case ChildKindChild:
			childN++
			if c.DisplayName == "" {
				return invalidf("children[%d]: child requires display_name", i)
			}
			if !isISODate(c.BirthDate) {
				return invalidf("children[%d]: child requires birth_date YYYY-MM-DD", i)
			}
			if c.PregnancyWeeks != nil {
				return invalidf("children[%d]: child must not have pregnancy_weeks", i)
			}
			if c.DueDate != "" {
				return invalidf("children[%d]: child must not have due_date", i)
			}
		}
		if len(c.Purposes) == 0 {
			return invalidf("children[%d].purposes must have at least one entry", i)
		}
		seen := make(map[RecordPurpose]struct{}, len(c.Purposes))
		for j, p := range c.Purposes {
			if !p.Valid() {
				return invalidf("children[%d].purposes[%d] invalid", i, j)
			}
			if _, dup := seen[p]; dup {
				return invalidf("children[%d].purposes[%d] duplicate", i, j)
			}
			seen[p] = struct{}{}
		}
	}

	// Cross-case composition rules.
	switch s.Case {
	case CaseA:
		if fetusN == 0 || childN > 0 {
			return invalidf("case A requires only fetuses")
		}
	case CaseB:
		if fetusN == 0 || childN == 0 {
			return invalidf("case B requires at least one fetus and one child")
		}
	case CaseC:
		if childN == 0 || fetusN > 0 {
			return invalidf("case C requires only already-born children")
		}
	}
	return nil
}

func isISODate(s string) bool {
	if !isoDateRe.MatchString(s) {
		return false
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

// runeCount counts codepoints without importing unicode/utf8 at the
// callsites; the implementation is trivial enough to keep inline.
func runeCount(s string) int {
	return len([]rune(strings.TrimSpace(s)))
}
