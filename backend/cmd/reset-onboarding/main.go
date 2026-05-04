// Command reset-onboarding clears the case-branching onboarding state for
// the user matching the given email: case_kind, onboarded_at, voice
// coachmark dismissal, AI preview, plus every children + child_record_purposes
// row. When AWS_S3_BUCKET is configured, it also wipes the user's
// onboarding-tmp/ and children/ S3 prefixes so successive E2E runs start
// from a clean slate.
//
// Intended to be invoked inside the backend container, e.g.
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

	store := &onboarding.Store{DB: d}

	// Resolve the user id BEFORE the DB reset wipes the row, so we can
	// scope the S3 cleanup to the right prefix.
	var userID string
	if err := d.QueryRow(`SELECT id FROM users WHERE email = ?`, email).Scan(&userID); err != nil {
		return fmt.Errorf("no user found with email %q: %w", email, err)
	}

	if err := store.ResetByEmail(context.Background(), email); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			return fmt.Errorf("no user found with email %q", email)
		}
		return err
	}

	// S3 cleanup is best-effort: the DB reset is the source of truth, so
	// a flaky network or unconfigured bucket should not abort the
	// command. Production has the bucket; CI MinIO has it; a stripped
	// dev environment may not.
	if cfg.AWS.Bucket != "" {
		s3Client, err := storage.NewClient(context.Background(), storage.Config{
			Region:         cfg.AWS.Region,
			AssumeRoleARN:  cfg.AWS.AssumeRoleARN,
			Bucket:         cfg.AWS.Bucket,
			KeyPrefix:      cfg.AWS.KeyPrefix,
			ForcePathStyle: cfg.AWS.ForcePathStyle,
			EndpointURL:    cfg.AWS.EndpointURL,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "warn: skip S3 cleanup (init): %v\n", err)
		} else {
			normPrefix := s3Client.Config.KeyPrefix // already normalised by LoadConfig
			tmpPrefix := fmt.Sprintf("%susers/%s/onboarding-tmp/", normPrefix, userID)
			childPrefix := fmt.Sprintf("%susers/%s/children/", normPrefix, userID)
			for _, p := range []string{tmpPrefix, childPrefix} {
				if err := s3Client.DeletePrefix(context.Background(), p); err != nil {
					fmt.Fprintf(os.Stderr, "warn: delete prefix %s: %v\n", p, err)
				}
			}
		}
	}

	fmt.Printf("reset onboarding for %s\n", email)
	return nil
}
