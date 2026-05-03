// Command reset-onboarding clears onboarded_at, the voice coachmark
// dismissal, the case-branching flags, and every child row owned by the
// user matching the given email. Intended to be invoked inside the
// backend container, e.g.
//
//	/reset-onboarding user@example.com
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/dlddu/dear-baby/backend/internal/children"
	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/db"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
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
	store := &onboarding.Store{DB: d}
	if err := store.ResetByEmail(ctx, email); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			return fmt.Errorf("no user found with email %q", email)
		}
		return err
	}

	// Clear children + child_purposes too. Looked up via email to keep
	// the command surface stable; children.Store has no email-keyed
	// helper, so we resolve the user id in-line.
	var userID string
	if err := d.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ?`, email).Scan(&userID); err != nil {
		return fmt.Errorf("lookup user id: %w", err)
	}
	childrenStore := &children.Store{DB: d}
	if err := childrenStore.DeleteAll(ctx, userID); err != nil {
		return fmt.Errorf("reset children: %w", err)
	}

	fmt.Printf("reset onboarding for %s\n", email)
	return nil
}
