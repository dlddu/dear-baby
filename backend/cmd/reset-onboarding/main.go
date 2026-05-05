// Command reset-onboarding clears the case-branching onboarding state and
// every associated child / photo for the user matching the given email.
// Intended to be invoked inside the backend container, e.g.
//
//	/reset-onboarding user@example.com
//
// The DB transaction clears `onboarding.case_kind`, `onboarded_at`, and
// the related `voice_coachmark_dismissed_at`/`first_record_at`/`ai_preview`
// columns, then deletes every `children` + `child_record_purposes` row.
// After the DB write commits, both S3 prefixes (`onboarding-tmp/` and
// `children/`) are cleared so a re-run from the case-branching funnel
// starts from a clean slate.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/db"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
	"github.com/dlddu/dear-baby/backend/internal/storage"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 || strings.TrimSpace(args[0]) == "" {
		return errors.New("usage: reset-onboarding <email>")
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

	// Look up the user id first so we can target the matching S3
	// prefixes. The reset path itself is keyed on email but the S3
	// cleanup needs the user id.
	ctx := context.Background()
	var userID string
	if err := d.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID); err != nil {
		return fmt.Errorf("no user found with email %q", email)
	}

	store := &onboarding.Store{DB: d}
	if err := store.Reset(ctx, userID); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			return fmt.Errorf("no onboarding row for %q", email)
		}
		return err
	}

	// S3 cleanup is best-effort but reported. A configuration without
	// S3 is unusual, but kept resilient so the DB reset still succeeds
	// when the bucket is unreachable (e.g. local dev).
	storeCfg, err := storage.LoadConfig()
	if err != nil {
		fmt.Printf("reset onboarding for %s (s3 not configured: %v)\n", email, err)
		return nil
	}
	s3Client, err := storage.NewClient(ctx, storeCfg)
	if err != nil {
		fmt.Printf("reset onboarding for %s (s3 init failed: %v)\n", email, err)
		return nil
	}
	tmpCount, err := s3Client.DeletePrefix(ctx, s3Client.ChildPhotoTmpPrefix(userID))
	if err != nil {
		fmt.Printf("reset onboarding for %s (s3 tmp cleanup failed: %v)\n", email, err)
		return nil
	}
	childCount, err := s3Client.DeletePrefix(ctx, s3Client.ChildrenPrefix(userID))
	if err != nil {
		fmt.Printf("reset onboarding for %s (s3 children cleanup failed: %v, tmp removed %d)\n", email, err, tmpCount)
		return nil
	}
	fmt.Printf("reset onboarding for %s (cleared %d tmp + %d permanent child photos)\n", email, tmpCount, childCount)
	return nil
}
