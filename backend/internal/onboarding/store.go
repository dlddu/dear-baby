package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/records"
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
// the user's record history, and any record_subjects pointing at them —
// so the next session lands on a fresh funnel. The users row itself,
// plus auth artifacts (oauth_accounts, refresh_tokens), are untouched
// so the test account can still log in.
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
		// records 먼저 — record_subjects FK 에 의존하므로 record_subjects 보다
		// 앞서 지워야 한다.
		`DELETE FROM records         WHERE user_id = ?`,
		`DELETE FROM record_subjects WHERE user_id = ?`,
		`DELETE FROM children        WHERE user_id = ?`,
		`DELETE FROM fetuses         WHERE user_id = ?`,
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
//
// record_subjects rows are reused across upserts when (user_id, kind,
// ordinal) matches — this preserves records.subject_id pointers when
// the user merely tweaks per-fetus details without adding/removing
// rows. When the user shrinks the list, leftover record_subjects rows
// are kept (orphaned) so any existing records pointing at them remain
// addressable.
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
	var touched []string
	for i, f := range fetuses {
		subjectID, err := insertFetusTx(ctx, tx, userID, i, f)
		if err != nil {
			return fmt.Errorf("insert fetus %d: %w", i, err)
		}
		touched = append(touched, subjectID)
	}
	if err := recomputeStageSnapshotsTx(ctx, tx, touched); err != nil {
		return err
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
	var touched []string
	for i, c := range children {
		subjectID, err := insertChildTx(ctx, tx, userID, i, c)
		if err != nil {
			return fmt.Errorf("insert child %d: %w", i, err)
		}
		touched = append(touched, subjectID)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM fetuses WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete fetuses: %w", err)
	}
	for i, f := range fetuses {
		subjectID, err := insertFetusTx(ctx, tx, userID, i, f)
		if err != nil {
			return fmt.Errorf("insert fetus %d: %w", i, err)
		}
		touched = append(touched, subjectID)
	}
	if err := recomputeStageSnapshotsTx(ctx, tx, touched); err != nil {
		return err
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
	var touched []string
	for i, c := range children {
		subjectID, err := insertChildTx(ctx, tx, userID, i, c)
		if err != nil {
			return fmt.Errorf("insert child %d: %w", i, err)
		}
		touched = append(touched, subjectID)
	}
	if err := recomputeStageSnapshotsTx(ctx, tx, touched); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ensureSubjectIDTx returns the record_subjects.id for (userID, kind,
// ordinal), creating the row with a fresh uuid when missing. Used by the
// fetus/child insert helpers so a re-onboarding sequence preserves the
// stable subject id any historical records point at.
func ensureSubjectIDTx(ctx context.Context, tx *sql.Tx, userID string, kind SubjectKind, ordinal int) (string, error) {
	var id string
	err := tx.QueryRowContext(ctx, `
		SELECT id FROM record_subjects
		WHERE user_id = ? AND kind = ? AND ordinal = ?
	`, userID, string(kind), ordinal).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("lookup record_subject: %w", err)
	}
	id = uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO record_subjects (id, user_id, kind, ordinal) VALUES (?, ?, ?, ?)
	`, id, userID, string(kind), ordinal); err != nil {
		return "", fmt.Errorf("insert record_subject: %w", err)
	}
	return id, nil
}

// insertFetusTx inserts one fetus row and returns the record_subjects.id it
// hangs off, so the caller can recompute that subject's 단계 스냅샷 before
// committing (ENG-013 T1).
func insertFetusTx(ctx context.Context, tx *sql.Tx, userID string, ordinal int, f Fetus) (string, error) {
	subjectID, err := ensureSubjectIDTx(ctx, tx, userID, SubjectKindFetus, ordinal)
	if err != nil {
		return "", err
	}
	purposes, err := json.Marshal(f.Purposes)
	if err != nil {
		return "", fmt.Errorf("marshal purposes: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO fetuses (id, user_id, ordinal, nickname, gender, pregnancy_week, due_date, purposes_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, subjectID, userID, ordinal, nullableString(f.Nickname), nullableString(f.Gender), nullableInt(f.PregnancyWeek), nullableString(f.DueDate), string(purposes)); err != nil {
		return "", fmt.Errorf("insert fetus: %w", err)
	}
	return subjectID, nil
}

// insertChildTx inserts one child row and returns the record_subjects.id it
// hangs off (see insertFetusTx — ENG-013 T2).
func insertChildTx(ctx context.Context, tx *sql.Tx, userID string, ordinal int, c Child) (string, error) {
	subjectID, err := ensureSubjectIDTx(ctx, tx, userID, SubjectKindChild, ordinal)
	if err != nil {
		return "", err
	}
	purposes, err := json.Marshal(c.Purposes)
	if err != nil {
		return "", fmt.Errorf("marshal purposes: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO children (id, user_id, ordinal, name, gender, birth_date, bio, purposes_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, subjectID, userID, ordinal, nullableString(c.Name), nullableString(c.Gender), nullableString(c.BirthDate), nullableString(c.Bio), string(purposes)); err != nil {
		return "", fmt.Errorf("insert child: %w", err)
	}
	return subjectID, nil
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

// recomputeStageSnapshotsTx rebuilds the 단계 스냅샷 of every record belonging
// to the subjects this upsert just re-seeded (ENG-013 재계산 트리거 T1
// `due_date` 수정 · T2 `birth_date` 수정). The three UpsertCase* functions are
// currently the **only** write path for due_date / birth_date, so binding the
// recalculation here satisfies ENG-013's "기준값 갱신은 데이터 계층의 단일
// 지점을 거치게 하고, 재계산을 그 지점에 묶는다". Any future 기준값 editor
// (설정 탭 아이 정보 수정 · 출산 전환) must route through the same point.
//
// It deliberately does **not** compare old and new 기준값 first. Recalculation
// is idempotent and scoped to one child's records (수십~수백 행), so running it
// unconditionally costs nothing — while a comparison introduces exactly the
// failure mode ENG-013 warns about, since a field left out of the comparison is
// a missed trigger. "값이 바뀌었나" 대신 "기준값 write 경로를 통과했나" 로 잡는다.
//
// Subjects dropped from the list are *not* in `subjectIDs` and so are never
// recomputed — their fetuses / children row is gone, and recomputing them would
// NULL out the whole history. RecomputeSnapshotsForSubjectTx guards that case
// again from the inside.
func recomputeStageSnapshotsTx(ctx context.Context, tx *sql.Tx, subjectIDs []string) error {
	for _, subjectID := range subjectIDs {
		if _, err := records.RecomputeSnapshotsForSubjectTx(ctx, tx, subjectID); err != nil {
			return fmt.Errorf("recompute stage snapshots (%s): %w", subjectID, err)
		}
	}
	return nil
}
