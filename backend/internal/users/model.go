package users

import "time"

// User represents a row in the users table.
type User struct {
	ID          string     `json:"id"`
	Email       string     `json:"email"`
	Name        string     `json:"name"`
	PictureURL  string     `json:"picture_url"`
	DueDate     *string    `json:"due_date"`
	OnboardedAt *time.Time `json:"onboarded_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
