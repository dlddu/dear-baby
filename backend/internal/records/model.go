package records

import "time"

// Source distinguishes how a record's text was authored. Voice records
// originate from on-device STT — even when the audio itself was never
// uploaded, `source` stays "voice" because the text came from a recording.
const (
	SourceText  = "text"
	SourceVoice = "voice"
)

// Record represents a single entry in the records table. AudioS3Key is
// nil when no audio is attached — either because the user authored the
// text manually (Source == SourceText) or because they chose to keep the
// recording on-device (Source == SourceVoice, audio never uploaded).
type Record struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Content     string    `json:"content"`
	Source      string    `json:"source"`
	AudioS3Key  *string   `json:"audio_s3_key,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}
