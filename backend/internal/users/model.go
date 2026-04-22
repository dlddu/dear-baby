package users

import "time"

// User represents a row in the users table. Onboarding state (due date,
// coachmark dismissal, first-record timestamp, AI preview) has moved to the
// `onboarding` table — see the onboarding package.
type User struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	PictureURL string    `json:"picture_url"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
