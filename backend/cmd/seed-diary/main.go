// Command seed-diary populates a tester account with a fixture set of
// children/fetuses + records spanning multiple months and visibilities,
// so the diary-tab e2e maestro flows have a reproducible target. It is
// intended for CI between maestro runs and ops break-glass.
//
//	/seed-diary user@example.com
//
// Designed to be idempotent: a returning run wipes the user's existing
// records / children / fetuses first (mirroring reset-user semantics)
// then re-seeds. The users row itself + auth artifacts (oauth_accounts,
// refresh_tokens) are untouched so the test account can still log in.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/db"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 || strings.TrimSpace(args[0]) == "" {
		return errors.New("usage: seed-diary <email>")
	}
	email := strings.TrimSpace(args[0])

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	d, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer d.Close()

	ctx := context.Background()
	var userID string
	if err := d.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("no user found with email %q (run /reset-user or sign in once first)", email)
		}
		return fmt.Errorf("lookup user: %w", err)
	}

	if err := seed(ctx, d, userID); err != nil {
		return fmt.Errorf("seed diary fixtures: %w", err)
	}
	fmt.Printf("seeded diary fixtures for %s (user_id=%s)\n", email, userID)
	return nil
}

// seed wipes per-user diary state and re-installs the fixture. Mirrors the
// shape of `onboarding.Store.ResetUserByEmail` but kept here rather than
// extending the onboarding store API — the fixture set is e2e-specific.
func seed(ctx context.Context, d *sql.DB, userID string) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Wipe in FK-safe order.
	for _, stmt := range []string{
		`DELETE FROM records         WHERE user_id = ?`,
		`DELETE FROM record_subjects WHERE user_id = ?`,
		`DELETE FROM children        WHERE user_id = ?`,
		`DELETE FROM fetuses         WHERE user_id = ?`,
	} {
		if _, err := tx.ExecContext(ctx, stmt, userID); err != nil {
			return fmt.Errorf("wipe (%s): %w", stmt, err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)
	`, userID); err != nil {
		return fmt.Errorf("ensure onboarding row: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET onboarded_at = datetime('now'),
		    first_record_at = NULL,
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID); err != nil {
		return fmt.Errorf("stamp onboarding: %w", err)
	}

	// (1) Multi-child fixture — 1 fetus + 1 child so the diary tab tests
	// the multi-subject path (헤더에 좌우 화살표는 없지만 카드 chip 은
	// 두 종류). Subject IDs are pinned (not uuid.NewString) so e2e
	// maestro flows can target the filter chip's testID directly —
	// `diary-filter-child-seed-fetus-1` / `…seed-child-1` — without
	// having to read /me first.
	purposes, _ := json.Marshal([]string{"매일의 마음"})

	const (
		fetusSubj = "seed-fetus-1"
		childSubj = "seed-child-1"
	)
	_ = uuid.NewString // keep the import; future fixture rows may want random ids
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO record_subjects (id, user_id, kind, ordinal) VALUES (?, ?, 'fetus', 0)
	`, fetusSubj, userID); err != nil {
		return fmt.Errorf("seed fetus subject: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO fetuses (id, user_id, ordinal, nickname, gender, pregnancy_week, due_date, purposes_json)
		VALUES (?, ?, 0, '콩이', 'unknown', 28, '2026-08-15', ?)
	`, fetusSubj, userID, string(purposes)); err != nil {
		return fmt.Errorf("seed fetus: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO record_subjects (id, user_id, kind, ordinal) VALUES (?, ?, 'child', 0)
	`, childSubj, userID); err != nil {
		return fmt.Errorf("seed child subject: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO children (id, user_id, ordinal, name, gender, birth_date, bio, purposes_json)
		VALUES (?, ?, 0, '하준', 'male', '2025-11-12', NULL, ?)
	`, childSubj, userID, string(purposes)); err != nil {
		return fmt.Errorf("seed child: %w", err)
	}

	// (2) Records — spread across two months so the SectionList renders
	// at least two month-groups, mix of voice/text + private/public,
	// across both children. created_at uses pinned UTC strings so
	// snapshot tests / assertions stay deterministic.
	type fixtureRec struct {
		ID         string
		SubjectID  string
		Source     string
		Visibility string
		Content    string
		Question   *string
		CreatedAt  string
	}
	q1 := "엄마, 제 첫 태동을 어떻게 알아채셨어요?"
	q2 := "엄마, 오늘 저한테 어떤 음악을 들려주셨어요?"
	q3 := "엄마, 제가 오늘 새로 한 표정이 있었나요?"
	q4 := "엄마, 오늘 저를 위해 어떤 결심을 했어요?"
	fixtures := []fixtureRec{
		{
			ID: "diary-r1", SubjectID: fetusSubj, Source: "text", Visibility: "private",
			Content:   "회의 중에 갑자기 뱃속이 꿈틀거려서 깜짝 놀랐어. 처음엔 가스인 줄 알았는데, 잠깐 멈췄다가 또 한 번 꿈틀.",
			Question:  &q1,
			CreatedAt: "2026-05-15 09:30:00",
		},
		{
			ID: "diary-r2", SubjectID: fetusSubj, Source: "voice", Visibility: "public",
			Content:   "출근길에 너에게 노래를 불러줬어. 너도 듣고 있는 것 같은 기분이 들었어.",
			Question:  &q2,
			CreatedAt: "2026-05-10 08:15:00",
		},
		{
			ID: "diary-r3", SubjectID: childSubj, Source: "text", Visibility: "public",
			Content:   "혀를 내밀고 메롱하는 표정을 처음 지었어. 너무 귀여워서 한참을 봤어.",
			Question:  &q3,
			CreatedAt: "2026-05-08 20:00:00",
		},
		{
			ID: "diary-r4", SubjectID: fetusSubj, Source: "text", Visibility: "private",
			Content:   "너에게 부끄럽지 않은 엄마가 되고 싶어서 술을 끊었어.",
			Question:  &q4,
			CreatedAt: "2026-04-20 22:10:00",
		},
		{
			ID: "diary-r5", SubjectID: childSubj, Source: "voice", Visibility: "private",
			Content:   "처음으로 너랑 같이 공원에 나갔어. 햇볕이 너무 좋아서 한참 동안 머물렀어.",
			Question:  nil,
			CreatedAt: "2026-04-18 15:45:00",
		},
	}
	for _, f := range fixtures {
		var q any
		if f.Question != nil {
			q = *f.Question
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO records (id, user_id, subject_id, content, source, question_text, visibility, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, f.ID, userID, f.SubjectID, f.Content, f.Source, q, f.Visibility, f.CreatedAt); err != nil {
			return fmt.Errorf("seed record %s: %w", f.ID, err)
		}
	}

	// Re-derive first_record_at from the oldest seeded record so the home
	// screen treats the user as already past the AI-preview unblur.
	if _, err := tx.ExecContext(ctx, `
		UPDATE onboarding
		SET first_record_at = (SELECT MIN(created_at) FROM records WHERE user_id = ?),
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID, userID); err != nil {
		return fmt.Errorf("stamp first_record_at: %w", err)
	}

	return tx.Commit()
}
