package children

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// sqliteTimeLayout is the format SQLite emits for datetime('now').
const sqliteTimeLayout = "2006-01-02 15:04:05"

// ErrInvalidChild is returned when an input row violates a domain rule
// before it reaches the database (e.g. parenting status without a birth
// date). Callers map it to HTTP 400.
var ErrInvalidChild = errors.New("invalid child")

// Store is the data-access layer over the children + child_purposes
// tables.
type Store struct {
	DB *sql.DB
}

// ChildInput is the per-child slice the onboarding submit endpoint accepts.
// It is intentionally close to the wire shape so handlers do not have to
// pre-translate every field. Callers fill in IDs server-side; client-supplied
// IDs are ignored.
type ChildInput struct {
	Status             Status
	Name               *string
	Gender             Gender
	BirthDate          *string
	DueDate            *string
	PregnancyWeek      *int
	Bio                *string
	PhotoS3Key         *string
	IsDueDateUndecided bool
	// Purposes is per-child so Case B can attach a different set per
	// aiae. The client-supplied order is preserved as `position`.
	Purposes []string
}

// ReplaceAll drops every existing child + purpose for the user and inserts
// the supplied list in a single transaction. The "replace" shape matches
// AC-006-02/03/04 which submit the entire onboarding batch at once and
// matches the client's draft model — there is no partial update during
// onboarding. Returns the inserted children with server-assigned IDs and
// timestamps.
func (s *Store) ReplaceAll(ctx context.Context, userID string, inputs []ChildInput) ([]Child, error) {
	for i, in := range inputs {
		if err := validateInput(in); err != nil {
			return nil, fmt.Errorf("child %d: %w", i, err)
		}
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return nil, fmt.Errorf("delete existing: %w", err)
	}

	out := make([]Child, 0, len(inputs))
	for i, in := range inputs {
		id := uuid.NewString()
		var pregWeekArg any
		if in.PregnancyWeek != nil {
			pregWeekArg = *in.PregnancyWeek
		}
		undecided := 0
		if in.IsDueDateUndecided {
			undecided = 1
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (
			  id, user_id, status, name, gender, birth_date, due_date,
			  pregnancy_week, bio, photo_s3_key, is_due_date_undecided,
			  display_order
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			id, userID, string(in.Status), nullableString(in.Name), string(in.Gender),
			nullableString(in.BirthDate), nullableString(in.DueDate),
			pregWeekArg, nullableString(in.Bio), nullableString(in.PhotoS3Key),
			undecided, i,
		); err != nil {
			return nil, fmt.Errorf("insert child %d: %w", i, err)
		}
		for j, p := range in.Purposes {
			if p == "" {
				continue
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO child_purposes (child_id, purpose, position) VALUES (?, ?, ?)
			`, id, p, j); err != nil {
				return nil, fmt.Errorf("insert purpose %d/%d: %w", i, j, err)
			}
		}
		c := Child{
			ID:                 id,
			UserID:             userID,
			Status:             in.Status,
			Name:               in.Name,
			Gender:             in.Gender,
			BirthDate:          in.BirthDate,
			DueDate:            in.DueDate,
			PregnancyWeek:      in.PregnancyWeek,
			Bio:                in.Bio,
			PhotoS3Key:         in.PhotoS3Key,
			IsDueDateUndecided: in.IsDueDateUndecided,
			DisplayOrder:       i,
		}
		out = append(out, c)
	}

	// Stamp timestamps from the DB so callers see the canonical values
	// (server clock) rather than time.Now() drift.
	for i := range out {
		var createdAt, updatedAt string
		if err := tx.QueryRowContext(ctx, `
			SELECT created_at, updated_at FROM children WHERE id = ?
		`, out[i].ID).Scan(&createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("read timestamps: %w", err)
		}
		out[i].CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		out[i].UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return out, nil
}

func validateInput(in ChildInput) error {
	if !in.Status.Valid() {
		return fmt.Errorf("%w: status", ErrInvalidChild)
	}
	if !in.Gender.Valid() {
		return fmt.Errorf("%w: gender", ErrInvalidChild)
	}
	switch in.Status {
	case StatusParenting:
		if in.BirthDate == nil || *in.BirthDate == "" {
			return fmt.Errorf("%w: birth_date required for parenting", ErrInvalidChild)
		}
	case StatusPregnancy:
		if (in.DueDate == nil || *in.DueDate == "") && !in.IsDueDateUndecided {
			return fmt.Errorf("%w: due_date or is_due_date_undecided required for pregnancy", ErrInvalidChild)
		}
	}
	return nil
}

func nullableString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

// ListByUser returns the user's children ordered by display_order, with
// purposes hydrated. Returns an empty slice (never nil) so JSON callers
// always emit `[]` rather than `null`.
func (s *Store) ListByUser(ctx context.Context, userID string) ([]Child, map[string][]string, error) {
	return list(ctx, s.DB, userID)
}

// ListByUserTx is the transactional variant — used by GetProfileTx so the
// /me view is consistent with concurrent writes.
func (s *Store) ListByUserTx(ctx context.Context, tx *sql.Tx, userID string) ([]Child, map[string][]string, error) {
	return list(ctx, tx, userID)
}

type rowScanner interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func list(ctx context.Context, q rowScanner, userID string) ([]Child, map[string][]string, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT id, user_id, status, name, gender, birth_date, due_date,
		       pregnancy_week, bio, photo_s3_key, is_due_date_undecided,
		       display_order, created_at, updated_at
		FROM children WHERE user_id = ? ORDER BY display_order, created_at
	`, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("query children: %w", err)
	}
	defer rows.Close()
	out := []Child{}
	ids := []string{}
	for rows.Next() {
		var c Child
		var name, birthDate, dueDate, bio, photoKey sql.NullString
		var pregWeek sql.NullInt64
		var undecided int
		var createdAt, updatedAt string
		if err := rows.Scan(&c.ID, &c.UserID, (*string)(&c.Status),
			&name, (*string)(&c.Gender), &birthDate, &dueDate,
			&pregWeek, &bio, &photoKey, &undecided,
			&c.DisplayOrder, &createdAt, &updatedAt); err != nil {
			return nil, nil, fmt.Errorf("scan child: %w", err)
		}
		if name.Valid {
			v := name.String
			c.Name = &v
		}
		if birthDate.Valid {
			v := birthDate.String
			c.BirthDate = &v
		}
		if dueDate.Valid {
			v := dueDate.String
			c.DueDate = &v
		}
		if pregWeek.Valid {
			v := int(pregWeek.Int64)
			c.PregnancyWeek = &v
		}
		if bio.Valid {
			v := bio.String
			c.Bio = &v
		}
		if photoKey.Valid {
			v := photoKey.String
			c.PhotoS3Key = &v
		}
		c.IsDueDateUndecided = undecided != 0
		c.CreatedAt, _ = time.Parse(sqliteTimeLayout, createdAt)
		c.UpdatedAt, _ = time.Parse(sqliteTimeLayout, updatedAt)
		out = append(out, c)
		ids = append(ids, c.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("rows: %w", err)
	}

	purposes := map[string][]string{}
	if len(ids) == 0 {
		return out, purposes, nil
	}
	// Hydrate purposes in a single query. No prepared statement / IN
	// list helper here because chi + sqlite stay in process and the slice
	// is small (one row per onboarding child).
	purposesQuery := `SELECT child_id, purpose FROM child_purposes WHERE child_id IN (?` +
		repeatComma(len(ids)-1) + `) ORDER BY child_id, position`
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	prows, err := q.QueryContext(ctx, purposesQuery, args...)
	if err != nil {
		return nil, nil, fmt.Errorf("query purposes: %w", err)
	}
	defer prows.Close()
	for prows.Next() {
		var cid, p string
		if err := prows.Scan(&cid, &p); err != nil {
			return nil, nil, fmt.Errorf("scan purpose: %w", err)
		}
		purposes[cid] = append(purposes[cid], p)
	}
	if err := prows.Err(); err != nil {
		return nil, nil, fmt.Errorf("purpose rows: %w", err)
	}
	return out, purposes, nil
}

func repeatComma(n int) string {
	if n <= 0 {
		return ""
	}
	out := make([]byte, 0, n*2)
	for i := 0; i < n; i++ {
		out = append(out, ',', '?')
	}
	return string(out)
}

// DeleteAll removes every children + purposes row for the user. Used by
// the reset-onboarding command and tests so successive E2E runs start
// from a clean state. Returns nil even when zero rows are affected —
// onboarding reset must be idempotent.
func (s *Store) DeleteAll(ctx context.Context, userID string) error {
	if _, err := s.DB.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	return nil
}
