package diary

import "time"

// Entry represents a row in the diary_entries table.
type Entry struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	EntryType string    `json:"entry_type"`
	Week      *int      `json:"week"`
	Duration  *int      `json:"duration"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
