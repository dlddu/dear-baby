package model

import "database/sql"

type User struct {
	ID           string         `json:"id"`
	GoogleID     string         `json:"google_id"`
	Email        string         `json:"email"`
	Name         string         `json:"name"`
	ProfileImage sql.NullString `json:"-"`
	DueDate      sql.NullString `json:"-"`
	Timestamps
}

// ProfileImageURL returns the profile image URL or empty string.
func (u *User) ProfileImageURL() string {
	if u.ProfileImage.Valid {
		return u.ProfileImage.String
	}
	return ""
}

// DueDateStr returns the due date or empty string.
func (u *User) DueDateStr() string {
	if u.DueDate.Valid {
		return u.DueDate.String
	}
	return ""
}

// UserJSON is the JSON representation sent to clients.
type UserJSON struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	ProfileImage string `json:"profile_image,omitempty"`
	DueDate      string `json:"due_date,omitempty"`
}

func (u *User) ToJSON() UserJSON {
	return UserJSON{
		ID:           u.ID,
		Email:        u.Email,
		Name:         u.Name,
		ProfileImage: u.ProfileImageURL(),
		DueDate:      u.DueDateStr(),
	}
}
