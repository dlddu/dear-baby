package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/dlddu/dear-baby/backend/internal/app"
	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/db"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "reset-onboarding":
			if err := resetOnboarding(os.Args[2:]); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return
		}
	}

	if err := app.Run(); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

// resetOnboarding clears onboarded_at and due_date for the user matching the
// given email. Intended to be invoked inside the backend container, e.g.
//
//	/dear-baby-backend reset-onboarding user@example.com
func resetOnboarding(args []string) error {
	if len(args) != 1 || strings.TrimSpace(args[0]) == "" {
		return errors.New("usage: dear-baby-backend reset-onboarding <email>")
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

	store := &users.Store{DB: d}
	if err := store.ResetOnboardingByEmail(context.Background(), email); err != nil {
		if errors.Is(err, users.ErrNotFound) {
			return fmt.Errorf("no user found with email %q", email)
		}
		return err
	}
	fmt.Printf("reset onboarding for %s\n", email)
	return nil
}
