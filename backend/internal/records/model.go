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

// Record represents a single entry in the records table. Records are the
// user's raw diary content. AudioS3Key is nullable and may stay nil
// forever — the user can choose to keep audio local-only or delete it.
// QuestionText is the daily question the home screen surfaced when this
// record was created, persisted for context. Nullable because not all
// entry points (deep links, future flows) supply one.
type Record struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Source       Source    `json:"source"`
	Content      string    `json:"content"`
	QuestionText *string   `json:"question_text"`
	AudioS3Key   *string   `json:"audio_s3_key"`
	CreatedAt    time.Time `json:"created_at"`
}
