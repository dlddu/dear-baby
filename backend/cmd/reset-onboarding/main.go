// Command reset-onboarding clears all case-branched onboarding state
// for the user matching the given email. Intended to be invoked inside
// the backend container, e.g.
//
//	/reset-onboarding user@example.com
//
// The tool wipes:
//   - onboarding flags (case_kind, onboarded_at, voice_coachmark_dismissed_at,
//     first_record_at, ai_preview)
//   - children rows (and their record purposes)
//   - S3 objects under users/{uid}/onboarding-tmp/ (orphaned uploads from
//     abandoned funnels) and users/{uid}/children/ (child photos)
//
// Records and the user row itself are preserved.
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
	"github.com/dlddu/dear-baby/backend/internal/users"
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

	// Look up the user up front so we can wipe S3 by user id even
	// after the DB rows are gone.
	usersStore := &users.Store{DB: d}
	u, err := usersStore.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			return fmt.Errorf("no user found with email %q", email)
		}
		return fmt.Errorf("lookup user: %w", err)
	}

	store := &onboarding.Store{DB: d}
	if err := store.Reset(ctx, u.ID); err != nil {
		return fmt.Errorf("reset onboarding: %w", err)
	}
	fmt.Printf("reset onboarding for %s (user %s)\n", email, u.ID)

	// Try to wipe S3 too. We don't fail the whole command if S3 isn't
	// configured (the local dev path may want to reset DB-only) — just
	// log and continue.
	s3Client, err := storage.NewClient(ctx, storage.Config{
		Region:         cfg.AWS.Region,
		AssumeRoleARN:  cfg.AWS.AssumeRoleARN,
		Bucket:         cfg.AWS.Bucket,
		KeyPrefix:      cfg.AWS.KeyPrefix,
		ForcePathStyle: cfg.AWS.ForcePathStyle,
		EndpointURL:    cfg.AWS.EndpointURL,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "warn: S3 wipe skipped (%v)\n", err)
		return nil
	}
	tmpPrefix := fmt.Sprintf("%susers/%s/onboarding-tmp/", cfg.AWS.KeyPrefix, u.ID)
	childrenPrefix := fmt.Sprintf("%susers/%s/children/", cfg.AWS.KeyPrefix, u.ID)
	for _, p := range []string{tmpPrefix, childrenPrefix} {
		n, err := s3Client.DeletePrefix(ctx, p)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warn: failed to wipe %s: %v\n", p, err)
			continue
		}
		fmt.Printf("wiped %d objects under %s\n", n, p)
	}
	return nil
}
