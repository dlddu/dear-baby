package users

import "time"

// User represents a row in the users table. Core identity only — all
// onboarding-related state (onboarded_at, first_record_at) lives in the
// `onboarding` table and is merged into Profile for the /me response.
type User struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	PictureURL string    `json:"picture_url"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// FetusProfile is the per-태아 row attached to Profile.Fetuses. Mirrors the
// onboarding.Fetus shape but lives here so the users package owns the
// /me response wire format.
type FetusProfile struct {
	Ordinal       int      `json:"ordinal"`
	Nickname      *string  `json:"nickname"`
	Gender        *string  `json:"gender"`
	PregnancyWeek *int     `json:"pregnancy_week"`
	DueDate       *string  `json:"due_date"`
	Purposes      []string `json:"purposes"`
}

// ChildProfile is the per-아이 row attached to Profile.Children.
type ChildProfile struct {
	Ordinal   int      `json:"ordinal"`
	Name      *string  `json:"name"`
	Gender    *string  `json:"gender"`
	BirthDate *string  `json:"birth_date"`
	Bio       *string  `json:"bio"`
	Purposes  []string `json:"purposes"`
}

// Profile is the flat view returned by GET /me and POST /records. It
// preserves the shape the client had before the onboarding-table move so
// the app can keep treating the response as a single object.
type Profile struct {
	ID            string         `json:"id"`
	Email         string         `json:"email"`
	Name          string         `json:"name"`
	PictureURL    string         `json:"picture_url"`
	OnboardedAt   *time.Time     `json:"onboarded_at"`
	FirstRecordAt *time.Time     `json:"first_record_at"`
	Fetuses       []FetusProfile `json:"fetuses"`
	Children      []ChildProfile `json:"children"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}
