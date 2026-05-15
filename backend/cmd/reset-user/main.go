// Command reset-user wipes a single user's onboarding state, children,
// fetuses, and records — leaving only the users row and auth artifacts
// (oauth_accounts, refresh_tokens) — so the next session lands on a
// fresh funnel. Intended for CI between maestro e2e runs and ops
// break-glass.
//
//	/reset-user user@example.com
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
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 || strings.TrimSpace(args[0]) == "" {
		return errors.New("usage: reset-user <email>")
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
	if err := store.ResetUserByEmail(context.Background(), email); err != nil {
		if errors.Is(err, onboarding.ErrNotFound) {
			return fmt.Errorf("no user found with email %q", email)
		}
		return err
	}
	fmt.Printf("reset user %s\n", email)
	return nil
}
