// Command reset-onboarding clears the case-branching onboarding state
// (case_kind, onboarded_at, voice coachmark dismissal, AI preview,
// children + per-child purposes + S3-backed photos) for the user
// matching the given email. Intended to be invoked inside the backend
// container, e.g.
//
//	/reset-onboarding user@example.com
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

	ctx := context.Background()

	// Look up user_id before resetting so we can also wipe S3 prefixes
	// for the same user. Once Reset runs the children rows are gone,
	// but the S3 objects need their own cleanup pass.
	var userID string
	if err := d.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID); err != nil {
		return fmt.Errorf("no user found with email %q: %w", email, err)
	}

	store := &onboarding.Store{DB: d}
	if err := store.Reset(ctx, userID); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			return fmt.Errorf("no onboarding row for user %q", email)
		}
		return err
	}

	// Best-effort S3 cleanup. Failures here are logged but do not fail
	// the command — the DB rows are already cleared, and the worst
	// case is a few stale objects that the next reset (or a future S3
	// lifecycle rule) will sweep. Empty AWS_S3_BUCKET means S3 isn't
	// wired in this environment (e.g., a CI smoke test) — skip
	// silently.
	if cfg.AWS.Bucket != "" {
		s3Client, err := storage.NewClient(ctx, storage.Config{
			Region:         cfg.AWS.Region,
			AssumeRoleARN:  cfg.AWS.AssumeRoleARN,
			Bucket:         cfg.AWS.Bucket,
			KeyPrefix:      cfg.AWS.KeyPrefix,
			ForcePathStyle: cfg.AWS.ForcePathStyle,
			EndpointURL:    cfg.AWS.EndpointURL,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: skip S3 cleanup, init failed: %v\n", err)
		} else {
			tmpPrefix := fmt.Sprintf("%susers/%s/onboarding-tmp/", s3Client.Config.KeyPrefix, userID)
			if err := s3Client.DeletePrefix(ctx, tmpPrefix); err != nil {
				fmt.Fprintf(os.Stderr, "warning: tmp prefix delete failed: %v\n", err)
			}
			childPrefix := fmt.Sprintf("%susers/%s/children/", s3Client.Config.KeyPrefix, userID)
			if err := s3Client.DeletePrefix(ctx, childPrefix); err != nil {
				fmt.Fprintf(os.Stderr, "warning: children prefix delete failed: %v\n", err)
			}
		}
	}

	fmt.Printf("reset onboarding for %s (user_id=%s)\n", email, userID)
	return nil
}
