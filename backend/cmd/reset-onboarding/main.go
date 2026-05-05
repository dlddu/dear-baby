// Command reset-onboarding clears the case-branching onboarding state
// (case_kind, onboarded_at, voice coachmark dismissal, AI preview) and
// the children rows belonging to the user matching the given email,
// plus best-effort cleanup of any S3 photos under the user's
// onboarding-tmp/ and children/ prefixes. Intended to be invoked
// inside the backend container, e.g.
//
//	/reset-onboarding user@example.com
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
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

	// Find the user id up front so we can reset DB state and S3
	// objects in matching scope. ErrNotFound here matches the prior
	// CLI behavior — surface it as a friendly message.
	var userID string
	err = d.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID)
	if err != nil {
		return fmt.Errorf("no user found with email %q", email)
	}

	store := &onboarding.Store{DB: d}
	if err := store.Reset(ctx, userID); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			return fmt.Errorf("no onboarding row for user %q", email)
		}
		return fmt.Errorf("reset onboarding: %w", err)
	}

	// Best-effort S3 cleanup. Failure here doesn't undo the DB reset —
	// the next onboarding run rotates fresh keys, and any leftover
	// objects are clearly identifiable as orphans.
	s3cfg, sErr := storage.LoadConfig()
	if sErr != nil {
		slog.Warn("skipping S3 cleanup (no config)", "err", sErr)
	} else {
		client, cErr := storage.NewClient(ctx, s3cfg)
		if cErr != nil {
			slog.Warn("skipping S3 cleanup (client init failed)", "err", cErr)
		} else {
			tmpPrefix := s3cfg.KeyPrefix + "users/" + userID + "/onboarding-tmp/"
			if err := client.DeletePrefix(ctx, tmpPrefix); err != nil {
				slog.Warn("delete onboarding-tmp prefix failed", "err", err, "prefix", tmpPrefix)
			}
			childrenPrefix := s3cfg.KeyPrefix + "users/" + userID + "/children/"
			if err := client.DeletePrefix(ctx, childrenPrefix); err != nil {
				slog.Warn("delete children prefix failed", "err", err, "prefix", childrenPrefix)
			}
		}
	}

	fmt.Printf("reset onboarding for %s\n", email)
	return nil
}
