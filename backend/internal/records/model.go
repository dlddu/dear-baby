package records

import "time"

// Source enumerates how the user produced a record. The set is closed and
// matches the CHECK constraint on records.source.
type Source string

const (
	SourceText  Source = "text"
	SourceVoice Source = "voice"
)

// Valid reports whether s is one of the recognised sources.
func (s Source) Valid() bool {
	switch s {
	case SourceText, SourceVoice:
		return true
	}
	return false
}

// Visibility decides whether the record is private to the author or visible
// on the community feed. Default at every write site is `'private'` —
// user-trust-first policy. The CHECK constraint on records.visibility
// mirrors this enum exactly.
type Visibility string

const (
	VisibilityPrivate Visibility = "private"
	VisibilityPublic  Visibility = "public"
)

// Valid reports whether v is one of the recognised visibilities.
func (v Visibility) Valid() bool {
	switch v {
	case VisibilityPrivate, VisibilityPublic:
		return true
	}
	return false
}

// Record represents a single entry in the records table. Records are the
// user's raw diary content. AudioS3Key is nullable and may stay nil
// forever — the user can choose to keep audio local-only or delete it.
// QuestionText is the daily question the home screen surfaced when this
// record was created, persisted for context. Nullable because not all
// entry points (deep links, future flows) supply one. SubjectID points to
// the record_subjects row (i.e. the fetus / child this record is about)
// and is required at every write site. Visibility flips between 'private'
// and 'public' — toggleable post-creation via PATCH.
type Record struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	SubjectID    string     `json:"subject_id"`
	Source       Source     `json:"source"`
	Content      string     `json:"content"`
	QuestionText *string    `json:"question_text"`
	AudioS3Key   *string    `json:"audio_s3_key"`
	Visibility   Visibility `json:"visibility"`
	CreatedAt    time.Time  `json:"created_at"`
}
