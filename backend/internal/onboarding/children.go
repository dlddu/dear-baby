package onboarding

import (
	"fmt"
	"time"
)

// ChildRow mirrors a row in the `children` table. Fields specific to
// one kind (BirthDate for kind=child, PregnancyWeeks/DueDate for
// kind=fetus) are nullable on the type so a single struct can describe
// both.
type ChildRow struct {
	ID             string
	UserID         string
	Kind           ChildKind
	DisplayName    *string
	Gender         Gender
	Introduction   *string
	PhotoS3Key     *string
	BirthDate      *string // YYYY-MM-DD, child only
	PregnancyWeeks *int    // fetus only
	DueDate        *string // YYYY-MM-DD, fetus only
	SortOrder      int
	Purposes       []RecordPurpose
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ChildInput is the per-child payload of POST /onboarding/case. Each
// field is captured at face value off the wire and validated by
// SubmitCaseRequest.Validate before reaching the store.
type ChildInput struct {
	Kind           ChildKind       `json:"kind"`
	DisplayName    *string         `json:"display_name,omitempty"`
	Gender         Gender          `json:"gender"`
	Introduction   *string         `json:"introduction,omitempty"`
	BirthDate      *string         `json:"birth_date,omitempty"`
	PregnancyWeeks *int            `json:"pregnancy_weeks,omitempty"`
	DueDate        *string         `json:"due_date,omitempty"`
	PhotoTmpKey    *string         `json:"photo_tmp_key,omitempty"`
	Purposes       []RecordPurpose `json:"purposes"`
}

// SubmitCaseRequest is the full body of POST /onboarding/case — the
// case bucket the user landed on plus one or more child rows.
type SubmitCaseRequest struct {
	Case     Case         `json:"case"`
	Children []ChildInput `json:"children"`
}

// Validate enforces the case-vs-children invariants spelled out in the
// PRD: every child row carries the right shape for its kind, and the
// counts per kind match the declared case bucket.
func (r SubmitCaseRequest) Validate() error {
	if !r.Case.Valid() {
		return fmt.Errorf("invalid case")
	}
	if len(r.Children) == 0 {
		return fmt.Errorf("children must not be empty")
	}
	var fetuses, kids int
	for i, c := range r.Children {
		if !c.Kind.Valid() {
			return fmt.Errorf("child[%d]: invalid kind", i)
		}
		if !c.Gender.Valid() {
			return fmt.Errorf("child[%d]: invalid gender", i)
		}
		if len(c.Purposes) == 0 {
			return fmt.Errorf("child[%d]: at least one purpose required", i)
		}
		seen := map[RecordPurpose]bool{}
		for _, p := range c.Purposes {
			if !p.Valid() {
				return fmt.Errorf("child[%d]: invalid purpose %q", i, p)
			}
			if seen[p] {
				return fmt.Errorf("child[%d]: duplicate purpose %q", i, p)
			}
			seen[p] = true
		}
		switch c.Kind {
		case ChildKindFetus:
			if c.PregnancyWeeks == nil {
				return fmt.Errorf("child[%d]: pregnancy_weeks required for fetus", i)
			}
			if *c.PregnancyWeeks < 0 || *c.PregnancyWeeks > 45 {
				return fmt.Errorf("child[%d]: pregnancy_weeks out of range", i)
			}
			if c.DueDate == nil || !isISODate(*c.DueDate) {
				return fmt.Errorf("child[%d]: valid due_date required for fetus", i)
			}
			if c.BirthDate != nil {
				return fmt.Errorf("child[%d]: birth_date forbidden for fetus", i)
			}
			fetuses++
		case ChildKindChild:
			if c.DisplayName == nil || *c.DisplayName == "" {
				return fmt.Errorf("child[%d]: display_name required for child", i)
			}
			if c.BirthDate == nil || !isISODate(*c.BirthDate) {
				return fmt.Errorf("child[%d]: valid birth_date required for child", i)
			}
			if c.PregnancyWeeks != nil || c.DueDate != nil {
				return fmt.Errorf("child[%d]: pregnancy fields forbidden for child", i)
			}
			kids++
		}
	}
	switch r.Case {
	case CaseA:
		if fetuses == 0 || kids != 0 {
			return fmt.Errorf("case A requires only fetus children")
		}
	case CaseB:
		if fetuses == 0 || kids == 0 {
			return fmt.Errorf("case B requires both fetus and child children")
		}
	case CaseC:
		if kids == 0 || fetuses != 0 {
			return fmt.Errorf("case C requires only post-birth children")
		}
	}
	return nil
}

// isoDateRe matches YYYY-MM-DD plus a real-date check via time.Parse.
func isISODate(s string) bool {
	if len(s) != 10 {
		return false
	}
	if _, err := time.Parse("2006-01-02", s); err != nil {
		return false
	}
	return true
}
