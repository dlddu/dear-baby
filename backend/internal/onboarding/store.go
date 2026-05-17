package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

// ErrNotFound is returned when no onboarding row matches the given user id.
var ErrNotFound = errors.New("onboarding row not found")

// Store is a data-access layer over the onboarding table.
type Store struct {
	DB *sql.DB
}

// EnsureRowTx inserts an empty onboarding row for the given user if one
// does not already exist. Called from users.Store.UpsertByOAuth inside the
// same transaction so every users row has a matching onboarding row.
// Idempotent — safe to call on repeat sign-ins.
func (s *Store) EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}
	return nil
}

// ResetUserByEmail wipes all per-user state used by the onboarding e2e
// suite — onboarding flags, the per-fetus / per-child onboarding rows,
// and the user's record history — so the next session lands on a fresh
// funnel. The users row itself, plus auth artifacts (oauth_accounts,
// refresh_tokens), are untouched so the test account can still log in.
//
// Intended for CI between maestro runs and ops break-glass. Returns
// ErrNotFound if no user matches the given email.
func (s *Store) ResetUserByEmail(ctx context.Context, email string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin reset user tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var userID string
	if err := tx.QueryRowContext(ctx,
		`SELECT id FROM users WHERE email = ?`, email,
	).Scan(&userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("lookup user by email: %w", err)
	}

	// children + fetuses 는 활성 아이 픽커가 leftover 를 골라 카드 컨텍스트
	// 라벨이 비결정적으로 되는 사례(맥락 leak)를 제거. records 는 다음
	// 시나리오의 home-feed 어셋션이 직전 run 의 voice fixture 와 섞이지
	// 않도록 함께 wipe.
	for _, stmt := range []string{
		`DELETE FROM children WHERE user_id = ?`,
		`DELETE FROM fetuses  WHERE user_id = ?`,
		`DELETE FROM records  WHERE user_id = ?`,
	} {
		if _, err := tx.ExecContext(ctx, stmt, userID); err != nil {
			return fmt.Errorf("reset user (%s): %w", stmt, err)
		}
	}

	// onboarding row 는 EnsureRowTx 가 로그인마다 보장한다. INSERT OR
	// IGNORE 로 멱등하게 한 줄 보장 후, 모든 필드를 null 로 되돌린다.
	if _, err := tx.ExecContext(ctx,
		`INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)`, userID,
	); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET onboarded_at = NULL,
		    first_record_at = NULL,
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID); err != nil {
		return fmt.Errorf("reset onboarding fields: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit reset user tx: %w", err)
	}
	return nil
}

// UpsertCaseA atomically replaces the user's fetuses with the provided list
// and stamps onboarded_at in a single transaction. The client is
// responsible for replicating the chosen purposes to every fetus before
// calling — the server stores what it receives. Existing fetus rows for
// this user are deleted before the new rows are inserted, so the call is
// idempotent across retries.
func (s *Store) UpsertCaseA(ctx context.Context, userID string, fetuses []Fetus) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, userID); err != nil {
		return fmt.Errorf("update onboarding: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM fetuses WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete fetuses: %w", err)
	}
	for i, f := range fetuses {
		purposes, err := json.Marshal(f.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO fetuses (user_id, ordinal, nickname, gender, pregnancy_week, due_date, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(f.Nickname), nullableString(f.Gender), nullableInt(f.PregnancyWeek), nullableString(f.DueDate), string(purposes)); err != nil {
			return fmt.Errorf("insert fetus %d: %w", i, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// UpsertCaseB atomically replaces the user's children + fetuses with the
// provided lists in a single transaction and stamps onboarded_at. Unlike
// Case A·C, the caller provides per-child / per-fetus purposes
// (B2-purpose 1:1, B6 일괄) — the server stores what it receives.
func (s *Store) UpsertCaseB(ctx context.Context, userID string, children []Child, fetuses []Fetus) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, userID); err != nil {
		return fmt.Errorf("update onboarding: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	for i, c := range children {
		purposes, err := json.Marshal(c.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (user_id, ordinal, name, gender, birth_date, bio, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(c.Name), nullableString(c.Gender), nullableString(c.BirthDate), nullableString(c.Bio), string(purposes)); err != nil {
			return fmt.Errorf("insert child %d: %w", i, err)
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM fetuses WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete fetuses: %w", err)
	}
	for i, f := range fetuses {
		purposes, err := json.Marshal(f.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO fetuses (user_id, ordinal, nickname, gender, pregnancy_week, due_date, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(f.Nickname), nullableString(f.Gender), nullableInt(f.PregnancyWeek), nullableString(f.DueDate), string(purposes)); err != nil {
			return fmt.Errorf("insert fetus %d: %w", i, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// UpsertCaseC atomically replaces the user's children with the provided
// list and stamps onboarded_at. Same purposes-replication contract as
// UpsertCaseA.
func (s *Store) UpsertCaseC(ctx context.Context, userID string, children []Child) error {
	if err := s.ensureRow(ctx, userID); err != nil {
		return err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, userID); err != nil {
		return fmt.Errorf("update onboarding: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM children WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete children: %w", err)
	}
	for i, c := range children {
		purposes, err := json.Marshal(c.Purposes)
		if err != nil {
			return fmt.Errorf("marshal purposes: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO children (user_id, ordinal, name, gender, birth_date, bio, purposes_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, userID, i, nullableString(c.Name), nullableString(c.Gender), nullableString(c.BirthDate), nullableString(c.Bio), string(purposes)); err != nil {
			return fmt.Errorf("insert child %d: %w", i, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

func listFetuses(ctx context.Context, q rowQuerier, userID string) ([]Fetus, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT ordinal, nickname, gender, pregnancy_week, due_date, purposes_json
		FROM fetuses WHERE user_id = ? ORDER BY ordinal ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select fetuses: %w", err)
	}
	defer rows.Close()
	var out []Fetus
	for rows.Next() {
		var f Fetus
		var nickname, gender, dueDate sql.NullString
		var pregnancyWeek sql.NullInt64
		var purposesJSON string
		if err := rows.Scan(&f.Ordinal, &nickname, &gender, &pregnancyWeek, &dueDate, &purposesJSON); err != nil {
			return nil, fmt.Errorf("scan fetus: %w", err)
		}
		if nickname.Valid {
			v := nickname.String
			f.Nickname = &v
		}
		if gender.Valid {
			v := gender.String
			f.Gender = &v
		}
		if pregnancyWeek.Valid {
			v := int(pregnancyWeek.Int64)
			f.PregnancyWeek = &v
		}
		if dueDate.Valid {
			v := dueDate.String
			f.DueDate = &v
		}
		f.Purposes = parsePurposes(purposesJSON)
		out = append(out, f)
	}
	return out, rows.Err()
}

func listChildren(ctx context.Context, q rowQuerier, userID string) ([]Child, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT ordinal, name, gender, birth_date, bio, purposes_json
		FROM children WHERE user_id = ? ORDER BY ordinal ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("select children: %w", err)
	}
	defer rows.Close()
	var out []Child
	for rows.Next() {
		var c Child
		var name, gender, birthDate, bio sql.NullString
		var purposesJSON string
		if err := rows.Scan(&c.Ordinal, &name, &gender, &birthDate, &bio, &purposesJSON); err != nil {
			return nil, fmt.Errorf("scan child: %w", err)
		}
		if name.Valid {
			v := name.String
			c.Name = &v
		}
		if gender.Valid {
			v := gender.String
			c.Gender = &v
		}
		if birthDate.Valid {
			v := birthDate.String
			c.BirthDate = &v
		}
		if bio.Valid {
			v := bio.String
			c.Bio = &v
		}
		c.Purposes = parsePurposes(purposesJSON)
		out = append(out, c)
	}
	return out, rows.Err()
}

type rowQuerier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func parsePurposes(raw string) []string {
	if raw == "" {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return []string{}
	}
	if out == nil {
		return []string{}
	}
	return out
}

func nullableString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

func nullableInt(i *int) any {
	if i == nil {
		return nil
	}
	return *i
}

// ensureRow inserts an empty onboarding row if missing. Used by updates
// that should succeed for any existing user — defensive, since
// UpsertByOAuth already creates the row on sign-in.
func (s *Store) ensureRow(ctx context.Context, userID string) error {
	var exists bool
	err := s.DB.QueryRowContext(ctx, `SELECT 1 FROM users WHERE id = ?`, userID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("check user: %w", err)
	}
	if _, err := s.DB.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}
	return nil
}
