package repository

import (
	"database/sql"
	"fmt"

	"github.com/dlddu/dear-baby/backend/internal/model"
)

type DiaryRepository struct {
	db *sql.DB
}

func NewDiaryRepository(db *sql.DB) *DiaryRepository {
	return &DiaryRepository{db: db}
}

func (r *DiaryRepository) Create(entry *model.DiaryEntry) error {
	_, err := r.db.Exec(
		`INSERT INTO diary_entries (id, user_id, title, content, entry_type, pregnancy_week, mood, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		entry.ID, entry.UserID, entry.Title, entry.Content, entry.EntryType,
		entry.PregnancyWeek, entry.Mood,
	)
	if err != nil {
		return fmt.Errorf("create diary entry: %w", err)
	}
	return nil
}

func (r *DiaryRepository) GetByID(id, userID string) (*model.DiaryEntry, error) {
	entry := &model.DiaryEntry{}
	err := r.db.QueryRow(
		`SELECT id, user_id, title, content, entry_type, pregnancy_week, mood, is_deleted, created_at, updated_at
		 FROM diary_entries WHERE id = ? AND user_id = ? AND is_deleted = 0`, id, userID,
	).Scan(&entry.ID, &entry.UserID, &entry.Title, &entry.Content, &entry.EntryType,
		&entry.PregnancyWeek, &entry.Mood, &entry.IsDeleted, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get diary entry: %w", err)
	}
	return entry, nil
}

func (r *DiaryRepository) ListByUserID(userID string, page, limit int) ([]model.DiaryEntry, int, error) {
	var totalCount int
	err := r.db.QueryRow(
		`SELECT COUNT(*) FROM diary_entries WHERE user_id = ? AND is_deleted = 0`, userID,
	).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count diary entries: %w", err)
	}

	offset := (page - 1) * limit
	rows, err := r.db.Query(
		`SELECT id, user_id, title, content, entry_type, pregnancy_week, mood, is_deleted, created_at, updated_at
		 FROM diary_entries WHERE user_id = ? AND is_deleted = 0
		 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		userID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list diary entries: %w", err)
	}
	defer rows.Close()

	var entries []model.DiaryEntry
	for rows.Next() {
		var entry model.DiaryEntry
		if err := rows.Scan(&entry.ID, &entry.UserID, &entry.Title, &entry.Content, &entry.EntryType,
			&entry.PregnancyWeek, &entry.Mood, &entry.IsDeleted, &entry.CreatedAt, &entry.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan diary entry: %w", err)
		}
		entries = append(entries, entry)
	}

	return entries, totalCount, nil
}

func (r *DiaryRepository) Update(entry *model.DiaryEntry) error {
	_, err := r.db.Exec(
		`UPDATE diary_entries SET title = ?, content = ?, entry_type = ?, pregnancy_week = ?, mood = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ? AND is_deleted = 0`,
		entry.Title, entry.Content, entry.EntryType, entry.PregnancyWeek, entry.Mood,
		entry.ID, entry.UserID,
	)
	if err != nil {
		return fmt.Errorf("update diary entry: %w", err)
	}
	return nil
}

func (r *DiaryRepository) SoftDelete(id, userID string) error {
	result, err := r.db.Exec(
		`UPDATE diary_entries SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ? AND is_deleted = 0`,
		id, userID,
	)
	if err != nil {
		return fmt.Errorf("soft delete diary entry: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check rows affected: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
