package diary

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("entry not found")

const sqliteTimeLayout = "2006-01-02 15:04:05"

// Store is a thin data-access layer over the diary_entries table.
type Store struct {
	DB *sql.DB
}

// Create inserts a new diary entry and returns it.
func (s *Store) Create(ctx context.Context, userID, title, content, entryType string, week, duration *int) (*Entry, error) {
	id := uuid.NewString()
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO diary_entries (id, user_id, title, content, entry_type, week, duration)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, id, userID, title, content, entryType, week, duration)
	if err != nil {
		return nil, fmt.Errorf("insert diary entry: %w", err)
	}
	return s.GetByID(ctx, id)
}

// GetByID returns a single diary entry by primary key.
func (s *Store) GetByID(ctx context.Context, id string) (*Entry, error) {
	e := &Entry{}
	var week, duration sql.NullInt64
	var createdAt, updatedAt string
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, user_id, title, content, entry_type, week, duration, created_at, updated_at
		FROM diary_entries WHERE id = ?
	`, id).Scan(&e.ID, &e.UserID, &e.Title, &e.Content, &e.EntryType, &week, &duration, &createdAt, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select diary entry: %w", err)
	}
	if week.Valid {
		w := int(week.Int64)
		e.Week = &w
	}
	if duration.Valid {
		d := int(duration.Int64)
		e.Duration = &d
	}
	e.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
	e.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	return e, nil
}

// ListByUser returns all diary entries for a user, optionally filtered by week,
// ordered by created_at DESC.
func (s *Store) ListByUser(ctx context.Context, userID string, week *int) ([]*Entry, error) {
	var rows *sql.Rows
	var err error
	if week != nil {
		rows, err = s.DB.QueryContext(ctx, `
			SELECT id, user_id, title, content, entry_type, week, duration, created_at, updated_at
			FROM diary_entries WHERE user_id = ? AND week = ?
			ORDER BY created_at DESC
		`, userID, *week)
	} else {
		rows, err = s.DB.QueryContext(ctx, `
			SELECT id, user_id, title, content, entry_type, week, duration, created_at, updated_at
			FROM diary_entries WHERE user_id = ?
			ORDER BY created_at DESC
		`, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("list diary entries: %w", err)
	}
	defer rows.Close()

	var entries []*Entry
	for rows.Next() {
		e := &Entry{}
		var wk, dur sql.NullInt64
		var createdAt, updatedAt string
		if err := rows.Scan(&e.ID, &e.UserID, &e.Title, &e.Content, &e.EntryType, &wk, &dur, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan diary entry: %w", err)
		}
		if wk.Valid {
			w := int(wk.Int64)
			e.Week = &w
		}
		if dur.Valid {
			d := int(dur.Int64)
			e.Duration = &d
		}
		e.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		e.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []*Entry{}
	}
	return entries, rows.Err()
}

// Update modifies the title and content of a diary entry owned by the given user.
func (s *Store) Update(ctx context.Context, id, userID, title, content string) (*Entry, error) {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE diary_entries SET title = ?, content = ?, updated_at = datetime('now')
		WHERE id = ? AND user_id = ?
	`, title, content, id, userID)
	if err != nil {
		return nil, fmt.Errorf("update diary entry: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return s.GetByID(ctx, id)
}

// Delete removes a diary entry owned by the given user.
func (s *Store) Delete(ctx context.Context, id, userID string) error {
	res, err := s.DB.ExecContext(ctx, `
		DELETE FROM diary_entries WHERE id = ? AND user_id = ?
	`, id, userID)
	if err != nil {
		return fmt.Errorf("delete diary entry: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
