package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	_ "modernc.org/sqlite"

	"github.com/dlddu/dear-baby/backend/internal/tasks"
)

func newProcessorDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := "file:" + t.Name() + "?mode=memory&cache=private"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	db.SetMaxOpenConns(1)
	schema := `
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT, picture_url TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE onboarding (user_id TEXT PRIMARY KEY, due_date TEXT, onboarded_at TEXT, voice_coachmark_dismissed_at TEXT, first_record_at TEXT, ai_preview TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE records (id TEXT PRIMARY KEY, user_id TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func seedUser(t *testing.T, db *sql.DB, userID string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, userID, userID+"@x"); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO onboarding (user_id) VALUES (?)`, userID); err != nil {
		t.Fatalf("seed onboarding: %v", err)
	}
}

func TestAIPreviewProcessor_OkPersists(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")

	store := &Store{DB: db}
	p := AIPreviewProcessor(store)

	payload, _ := json.Marshal(map[string]string{"status": "ok", "preview": "hello there"})
	if err := p(context.Background(), "u1", string(payload)); err != nil {
		t.Fatalf("processor: %v", err)
	}

	var got sql.NullString
	if err := db.QueryRow(`SELECT ai_preview FROM onboarding WHERE user_id='u1'`).Scan(&got); err != nil {
		t.Fatalf("query: %v", err)
	}
	if !got.Valid || got.String != "hello there" {
		t.Errorf("ai_preview: %+v", got)
	}
}

func TestAIPreviewProcessor_ErrorSkipsPersistence(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")

	store := &Store{DB: db}
	p := AIPreviewProcessor(store)

	payload, _ := json.Marshal(map[string]string{"status": "error", "error": "openrouter timeout"})
	// Returns nil so fanout still happens — the UI surfaces the error.
	if err := p(context.Background(), "u1", string(payload)); err != nil {
		t.Fatalf("processor: %v", err)
	}
	var got sql.NullString
	if err := db.QueryRow(`SELECT ai_preview FROM onboarding WHERE user_id='u1'`).Scan(&got); err != nil {
		t.Fatalf("query: %v", err)
	}
	if got.Valid {
		t.Errorf("expected null ai_preview, got %q", got.String)
	}
}

func TestAIPreviewProcessor_MalformedReturnsError(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	store := &Store{DB: db}
	p := AIPreviewProcessor(store)
	if err := p(context.Background(), "u1", "not-json"); err == nil {
		t.Fatal("expected error")
	}
}

func TestAIPreviewProcessor_OkWithoutPreviewIsError(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")
	store := &Store{DB: db}
	p := AIPreviewProcessor(store)

	payload, _ := json.Marshal(map[string]string{"status": "ok"})
	if err := p(context.Background(), "u1", string(payload)); err == nil {
		t.Fatal("expected error for ok without preview")
	}
}

func TestSyncPendingAIPreviews_EnqueuesEachPending(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	// Two pending users + one already-done user that must not be re-enqueued.
	for _, uid := range []string{"u1", "u2", "done"} {
		seedUser(t, db, uid)
	}
	if _, err := db.Exec(`
		UPDATE onboarding SET first_record_at = datetime('now') WHERE user_id IN ('u1','u2','done');
		UPDATE onboarding SET ai_preview = 'already' WHERE user_id = 'done';
		INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'alpha');
		INSERT INTO records (id, user_id, content) VALUES ('r2', 'u2', 'beta');
		INSERT INTO records (id, user_id, content) VALUES ('rd', 'done', 'gamma');
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rc := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rc.Close()

	SyncPendingAIPreviews(context.Background(), &Store{DB: db}, &tasks.Client{Redis: rc}, slog.Default())

	items, err := mr.DB(0).List("tasks:queue")
	if err != nil {
		t.Fatalf("list queue: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("queue: %d want 2", len(items))
	}
	seen := map[string]bool{}
	for _, raw := range items {
		var env struct {
			Type    string `json:"type"`
			Payload struct {
				UserID   string `json:"user_id"`
				RecordID string `json:"record_id"`
			} `json:"payload"`
		}
		if err := json.Unmarshal([]byte(raw), &env); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if env.Type != "ai_preview" {
			t.Errorf("type: %q", env.Type)
		}
		seen[env.Payload.UserID] = true
	}
	if !seen["u1"] || !seen["u2"] || seen["done"] {
		t.Errorf("seen: %+v", seen)
	}
}
