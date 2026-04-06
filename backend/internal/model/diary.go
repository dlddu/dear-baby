package model

import "database/sql"

type DiaryEntry struct {
	ID            string         `json:"id"`
	UserID        string         `json:"user_id"`
	Title         sql.NullString `json:"-"`
	Content       string         `json:"content"`
	EntryType     string         `json:"entry_type"`
	PregnancyWeek sql.NullInt64  `json:"-"`
	Mood          sql.NullString `json:"-"`
	IsDeleted     bool           `json:"is_deleted"`
	Timestamps
}

type DiaryEntryJSON struct {
	ID            string `json:"id"`
	UserID        string `json:"user_id"`
	Title         string `json:"title,omitempty"`
	Content       string `json:"content"`
	EntryType     string `json:"entry_type"`
	PregnancyWeek int    `json:"pregnancy_week,omitempty"`
	Mood          string `json:"mood,omitempty"`
	Timestamps
}

func (d *DiaryEntry) ToJSON() DiaryEntryJSON {
	var title string
	if d.Title.Valid {
		title = d.Title.String
	}
	var week int
	if d.PregnancyWeek.Valid {
		week = int(d.PregnancyWeek.Int64)
	}
	var mood string
	if d.Mood.Valid {
		mood = d.Mood.String
	}
	return DiaryEntryJSON{
		ID:            d.ID,
		UserID:        d.UserID,
		Title:         title,
		Content:       d.Content,
		EntryType:     d.EntryType,
		PregnancyWeek: week,
		Mood:          mood,
		Timestamps:    d.Timestamps,
	}
}

type CreateDiaryRequest struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	EntryType     string `json:"entry_type"`
	PregnancyWeek int    `json:"pregnancy_week"`
	Mood          string `json:"mood"`
}

type UpdateDiaryRequest struct {
	Title         *string `json:"title"`
	Content       *string `json:"content"`
	EntryType     *string `json:"entry_type"`
	PregnancyWeek *int    `json:"pregnancy_week"`
	Mood          *string `json:"mood"`
}
