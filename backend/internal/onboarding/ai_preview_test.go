package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"testing"
	"time"

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

func newTestClient(t *testing.T) (*tasks.Client, *miniredis.Miniredis, func()) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	rc := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	cleanup := func() {
		_ = rc.Close()
		mr.Close()
	}
	return &tasks.Client{Redis: rc}, mr, cleanup
}

func TestAIPreviewProcessor_OkPersistsAndFanouts(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")

	store := &Store{DB: db}
	client, _, cleanup := newTestClient(t)
	defer cleanup()
	p := AIPreviewProcessor(store, client, slog.Default())

	payload, _ := json.Marshal(map[string]any{"status": "ok", "preview": "hello there"})
	fanout, err := p(context.Background(), "u1", string(payload))
	if err != nil {
		t.Fatalf("processor: %v", err)
	}
	if !fanout {
		t.Error("expected fanout=true on ok")
	}

	var got sql.NullString
	if err := db.QueryRow(`SELECT ai_preview FROM onboarding WHERE user_id='u1'`).Scan(&got); err != nil {
		t.Fatalf("query: %v", err)
	}
	if !got.Valid || got.String != "hello there" {
		t.Errorf("ai_preview: %+v", got)
	}
}

func TestAIPreviewProcessor_ErrorBelowCap_SchedulesRetry(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")
	// Seed a record so the retry path can look up GetOldestRecord.
	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hi')`); err != nil {
		t.Fatalf("seed record: %v", err)
	}

	store := &Store{DB: db}
	client, mr, cleanup := newTestClient(t)
	defer cleanup()
	p := AIPreviewProcessor(store, client, slog.Default())

	payload, _ := json.Marshal(map[string]any{"status": "error", "error": "openrouter timeout", "attempt": 1})
	fanout, err := p(context.Background(), "u1", string(payload))
	if err != nil {
		t.Fatalf("processor: %v", err)
	}
	if fanout {
		t.Error("expected fanout=false (silent skip during retry)")
	}

	// DB must remain null — we don't persist error states.
	var got sql.NullString
	if err := db.QueryRow(`SELECT ai_preview FROM onboarding WHERE user_id='u1'`).Scan(&got); err != nil {
		t.Fatalf("query: %v", err)
	}
	if got.Valid {
		t.Errorf("expected null ai_preview, got %q", got.String)
	}

	// Retry is scheduled on a goroutine with a 500ms backoff. Poll the
	// queue until it shows up — if we hit the deadline the retry never
	// got enqueued.
	deadline := time.Now().Add(2 * time.Second)
	var items []string
	for time.Now().Before(deadline) {
		items, _ = mr.DB(0).List("tasks:queue")
		if len(items) > 0 {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if len(items) != 1 {
		t.Fatalf("queue: %d want 1", len(items))
	}
	var env struct {
		Type    string `json:"type"`
		Payload struct {
			UserID  string `json:"user_id"`
			Attempt int    `json:"attempt"`
		} `json:"payload"`
	}
	if err := json.Unmarshal([]byte(items[0]), &env); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if env.Type != "ai_preview" || env.Payload.UserID != "u1" || env.Payload.Attempt != 2 {
		t.Errorf("envelope: %+v", env)
	}
}

func TestAIPreviewProcessor_ErrorAtCap_FanoutsFinal(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")

	store := &Store{DB: db}
	client, mr, cleanup := newTestClient(t)
	defer cleanup()
	p := AIPreviewProcessor(store, client, slog.Default())

	// attempt == maxAIPreviewAttempts → no more retries; fanout so the
	// UI can show the final error.
	payload, _ := json.Marshal(map[string]any{"status": "error", "error": "openrouter timeout", "attempt": maxAIPreviewAttempts})
	fanout, err := p(context.Background(), "u1", string(payload))
	if err != nil {
		t.Fatalf("processor: %v", err)
	}
	if !fanout {
		t.Error("expected fanout=true on final error")
	}

	// Give the goroutine a moment — if it fired it would add to the
	// queue, which we don't want.
	time.Sleep(50 * time.Millisecond)
	items, _ := mr.DB(0).List("tasks:queue")
	if len(items) != 0 {
		t.Errorf("expected no retry, got %d queue items", len(items))
	}
}

func TestAIPreviewProcessor_ErrorWithZeroAttemptDefaultsToOne(t *testing.T) {
	// A payload missing `attempt` should be treated as attempt=1 so we
	// still get retries. Guards against drift with older worker versions.
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")
	if _, err := db.Exec(`INSERT INTO records (id, user_id, content) VALUES ('r1', 'u1', 'hi')`); err != nil {
		t.Fatalf("seed record: %v", err)
	}

	store := &Store{DB: db}
	client, mr, cleanup := newTestClient(t)
	defer cleanup()
	p := AIPreviewProcessor(store, client, slog.Default())

	payload, _ := json.Marshal(map[string]any{"status": "error", "error": "boom"})
	fanout, err := p(context.Background(), "u1", string(payload))
	if err != nil {
		t.Fatalf("processor: %v", err)
	}
	if fanout {
		t.Error("expected fanout=false (retry scheduled)")
	}
	deadline := time.Now().Add(2 * time.Second)
	var items []string
	for time.Now().Before(deadline) {
		items, _ = mr.DB(0).List("tasks:queue")
		if len(items) > 0 {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 retry, got %d", len(items))
	}
	var env struct {
		Payload struct {
			Attempt int `json:"attempt"`
		} `json:"payload"`
	}
	_ = json.Unmarshal([]byte(items[0]), &env)
	if env.Payload.Attempt != 2 {
		t.Errorf("attempt: %d want 2", env.Payload.Attempt)
	}
}

func TestAIPreviewProcessor_MalformedReturnsError(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	store := &Store{DB: db}
	client, _, cleanup := newTestClient(t)
	defer cleanup()
	p := AIPreviewProcessor(store, client, slog.Default())
	fanout, err := p(context.Background(), "u1", "not-json")
	if err == nil {
		t.Fatal("expected error")
	}
	if fanout {
		t.Error("expected fanout=false on malformed")
	}
}

func TestAIPreviewProcessor_OkWithoutPreviewIsError(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
	seedUser(t, db, "u1")
	store := &Store{DB: db}
	client, _, cleanup := newTestClient(t)
	defer cleanup()
	p := AIPreviewProcessor(store, client, slog.Default())

	payload, _ := json.Marshal(map[string]string{"status": "ok"})
	if _, err := p(context.Background(), "u1", string(payload)); err == nil {
		t.Fatal("expected error for ok without preview")
	}
}

func TestSyncPendingAIPreviews_EnqueuesEachPendingAtAttempt1(t *testing.T) {
	db := newProcessorDB(t)
	defer db.Close()
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

	client, mr, cleanup := newTestClient(t)
	defer cleanup()

	SyncPendingAIPreviews(context.Background(), &Store{DB: db}, client, slog.Default())

	items, err := mr.DB(0).List("tasks:queue")
	if err != nil {
		t.Fatalf("list queue: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("queue: %d want 2", len(items))
	}
	seen := map[string]int{}
	for _, raw := range items {
		var env struct {
			Type    string `json:"type"`
			Payload struct {
				UserID  string `json:"user_id"`
				Attempt int    `json:"attempt"`
			} `json:"payload"`
		}
		if err := json.Unmarshal([]byte(raw), &env); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if env.Type != "ai_preview" {
			t.Errorf("type: %q", env.Type)
		}
		seen[env.Payload.UserID] = env.Payload.Attempt
	}
	if seen["u1"] != 1 || seen["u2"] != 1 || seen["done"] != 0 {
		t.Errorf("seen: %+v", seen)
	}
}

func TestAIPreviewRetryBackoff(t *testing.T) {
	cases := []struct {
		in   int
		want time.Duration
	}{
		{0, 500 * time.Millisecond},
		{1, 500 * time.Millisecond},
		{2, 1000 * time.Millisecond},
		{3, 2000 * time.Millisecond},
	}
	for _, c := range cases {
		if got := aiPreviewRetryBackoff(c.in); got != c.want {
			t.Errorf("backoff(%d)=%v want %v", c.in, got, c.want)
		}
	}
}
