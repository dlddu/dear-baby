package records

import "time"

// Record represents a single entry in the records table. Records are the
// user's raw diary content (today: text only; voice is a separate PRD).
type Record struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
