// Command seed-test-users inserts (or refreshes) a fixed set of fixture
// accounts so QA and the in-app tester login screen can sign in without
// hitting Google or Apple. Each account is upserted under provider="test"
// keyed by the same email used by the app's tester login screen.
//
// Examples:
//
//	# Default fixtures (onboarded + un-onboarded variants).
//	seed-test-users
//
//	# Re-seed and reset onboarding so the next sign-in re-enters the funnel.
//	seed-test-users --reset
//
//	# Custom fixtures from a JSON file. Useful when QA wants to load a
//	# specific persona for screenshot review.
//	seed-test-users --file ./fixtures/qa.json
//
// The command refuses to run unless TEST_AUTH_ENABLED=true to prevent an
// operator from accidentally seeding fake users into production.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/dlddu/dear-baby/backend/internal/db"
	"github.com/dlddu/dear-baby/backend/internal/onboarding"
	"github.com/dlddu/dear-baby/backend/internal/users"
)

// defaultDatabaseURL mirrors config.Load's default so a developer can run
// the seeder against the dev SQLite file without having to export
// DATABASE_URL. The seeder intentionally does not call config.Load
// because that path validates AWS S3 env vars the seeder doesn't need.
const defaultDatabaseURL = "file:./dear-baby.db?_pragma=foreign_keys(1)&_pragma=journal_mode(wal)"

// fixture describes a single tester account. Email is required; everything
// else has a sensible default. DueDate is parsed by the onboarding store
// as YYYY-MM-DD when Onboarded is true.
type fixture struct {
	Email     string  `json:"email"`
	Name      string  `json:"name"`
	Onboarded bool    `json:"onboarded"`
	DueDate   *string `json:"due_date,omitempty"`
}

// defaultFixtures mirrors the personas the app's tester login UI lets QA
// pick from. Keep these in sync with the buttons in app/index.tsx — the
// UI hard-codes the email so a fresh seed is enough to reproduce a
// specific state without typing.
var defaultFixtures = []fixture{
	{Email: "tester-onboarding@dear-baby.test", Name: "온보딩 테스터", Onboarded: false},
	{Email: "tester-onboarded@dear-baby.test", Name: "기록 테스터", Onboarded: true, DueDate: ptr("2026-09-01")},
	{Email: "tester-qa@dear-baby.test", Name: "QA 테스터", Onboarded: true, DueDate: ptr("2026-12-25")},
}

func ptr(s string) *string { return &s }

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("seed-test-users", flag.ContinueOnError)
	var (
		file  = fs.String("file", "", "path to a JSON file with [{email,name,onboarded,due_date}] fixtures (default: built-in personas)")
		reset = fs.Bool("reset", false, "reset onboarding for each fixture so the next sign-in re-enters the funnel (overrides per-fixture onboarded=true)")
		force = fs.Bool("force", false, "skip the TEST_AUTH_ENABLED safety check (use only when seeding a non-production DB by hand)")
	)
	if err := fs.Parse(args); err != nil {
		return err
	}

	if !*force && !envBool("TEST_AUTH_ENABLED") {
		return errors.New(
			"refusing to seed: TEST_AUTH_ENABLED is not true. " +
				"Set TEST_AUTH_ENABLED=1 to confirm this is a non-production database, " +
				"or pass --force if you really know what you're doing.")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = defaultDatabaseURL
	}
	d, err := db.Open(dsn)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer d.Close()
	if err := db.RunMigrations(d); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	fixtures, err := loadFixtures(*file)
	if err != nil {
		return err
	}
	if len(fixtures) == 0 {
		return errors.New("no fixtures to seed")
	}

	usersStore := &users.Store{DB: d}
	onbStore := &onboarding.Store{DB: d}
	ctx := context.Background()

	for _, fx := range fixtures {
		email := strings.TrimSpace(fx.Email)
		if email == "" {
			return errors.New("fixture missing email")
		}
		name := fx.Name
		if name == "" {
			name = email
		}
		// provider="test" keeps the seeded rows out of the google/apple
		// namespace so a clean-up sweep can target only fixture data
		// (DELETE FROM oauth_accounts WHERE provider = 'test').
		u, err := usersStore.UpsertByOAuth(ctx, onbStore, "test", email, email, name, "")
		if err != nil {
			return fmt.Errorf("upsert %s: %w", email, err)
		}
		switch {
		case *reset:
			if err := onbStore.Reset(ctx, u.ID); err != nil && !errors.Is(err, onboarding.ErrNotFound) {
				return fmt.Errorf("reset %s: %w", email, err)
			}
			fmt.Printf("seeded %s (%s) — onboarding reset\n", email, u.ID)
		case fx.Onboarded:
			if err := onbStore.UpdateDueDateAndOnboardedAt(ctx, u.ID, fx.DueDate); err != nil {
				return fmt.Errorf("onboard %s: %w", email, err)
			}
			due := "(none)"
			if fx.DueDate != nil {
				due = *fx.DueDate
			}
			fmt.Printf("seeded %s (%s) — onboarded, due=%s\n", email, u.ID, due)
		default:
			if err := onbStore.Reset(ctx, u.ID); err != nil && !errors.Is(err, onboarding.ErrNotFound) {
				return fmt.Errorf("reset %s: %w", email, err)
			}
			fmt.Printf("seeded %s (%s) — not onboarded\n", email, u.ID)
		}
	}
	return nil
}

func loadFixtures(path string) ([]fixture, error) {
	if path == "" {
		// Return a copy so the global slice cannot be mutated by callers.
		out := make([]fixture, len(defaultFixtures))
		copy(out, defaultFixtures)
		return out, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read fixtures: %w", err)
	}
	var out []fixture
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("parse fixtures: %w", err)
	}
	return out, nil
}

func envBool(k string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(k))) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}
