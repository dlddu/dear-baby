package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

func newTestHandlers(t *testing.T) (*Handlers, *sql.DB, func()) {
	t.Helper()
	db := newTestDB(t)
	usersStore := &users.Store{DB: db}
	refreshStore := &RefreshStore{DB: db}
	issuer := &Issuer{
		Secret:     []byte("test-secret"),
		AccessTTL:  5 * time.Minute,
		RefreshTTL: time.Hour,
	}
	svc := &Service{
		Verifier:   &GoogleVerifier{},
		Users:      usersStore,
		Onboarding: testEnsurer{},
		Refresh:    refreshStore,
		Issuer:     issuer,
	}
	h := &Handlers{Service: svc}
	return h, db, func() { db.Close() }
}

// configureTestUser drops the seeded user into the DB and stashes the
// matching in-memory creds on the service — mirrors what app.go does
// after SeedTestUser at boot.
func configureTestUser(t *testing.T, h *Handlers, db *sql.DB, email, password string) string {
	t.Helper()
	creds, err := SeedTestUser(
		context.Background(),
		db,
		testEnsurer{},
		slog.New(slog.NewTextHandler(nopWriter{}, nil)),
		TestUserSeed{Email: email, Password: password, Name: "Tester"},
	)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if creds == nil {
		t.Fatal("seed returned nil creds")
	}
	h.Service.TestUser = creds

	var id string
	if err := db.QueryRow(`SELECT id FROM users WHERE email = ?`, email).Scan(&id); err != nil {
		t.Fatalf("lookup id: %v", err)
	}
	return id
}

type nopWriter struct{}

func (nopWriter) Write(p []byte) (int, error) { return len(p), nil }

func postPasswordLogin(t *testing.T, h *Handlers, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/auth/password-login",
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.PasswordLogin(rec, req)
	return rec
}

func TestPasswordLogin_MissingFieldsReturns400(t *testing.T) {
	h, _, cleanup := newTestHandlers(t)
	defer cleanup()

	cases := []string{
		`{}`,
		`{"email":"a@b.com"}`,
		`{"password":"hunter2"}`,
		`not-json`,
	}
	for _, body := range cases {
		rec := postPasswordLogin(t, h, body)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body=%q: status got %d want 400, resp=%s", body, rec.Code, rec.Body.String())
		}
	}
}

func TestPasswordLogin_NoTestUserConfiguredReturns401(t *testing.T) {
	h, _, cleanup := newTestHandlers(t)
	defer cleanup()
	// h.Service.TestUser is nil — the deploy did not configure
	// TEST_USER_EMAIL/PASSWORD, so every login attempt must 401.
	rec := postPasswordLogin(t, h, `{"email":"anyone@dear-baby.app","password":"hunter2"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d want 401, resp=%s", rec.Code, rec.Body.String())
	}
}

func TestPasswordLogin_WrongEmailReturns401(t *testing.T) {
	h, db, cleanup := newTestHandlers(t)
	defer cleanup()
	configureTestUser(t, h, db, "tester@dear-baby.app", "correct-password")

	rec := postPasswordLogin(t, h, `{"email":"someone-else@dear-baby.app","password":"correct-password"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d want 401, resp=%s", rec.Code, rec.Body.String())
	}
}

func TestPasswordLogin_WrongPasswordReturns401(t *testing.T) {
	h, db, cleanup := newTestHandlers(t)
	defer cleanup()
	configureTestUser(t, h, db, "tester@dear-baby.app", "correct-password")

	rec := postPasswordLogin(t, h, `{"email":"tester@dear-baby.app","password":"wrong-password"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d want 401, resp=%s", rec.Code, rec.Body.String())
	}
}

func TestPasswordLogin_Success(t *testing.T) {
	h, db, cleanup := newTestHandlers(t)
	defer cleanup()
	const email, pwd = "tester@dear-baby.app", "correct-password"
	uid := configureTestUser(t, h, db, email, pwd)

	rec := postPasswordLogin(t, h, `{"email":"`+email+`","password":"`+pwd+`"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200, resp=%s", rec.Code, rec.Body.String())
	}
	var resp sessionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("tokens should be non-empty")
	}
	if resp.User == nil || resp.User.ID != uid || resp.User.Email != email {
		t.Errorf("user mismatch: got %+v want id=%q email=%q", resp.User, uid, email)
	}

	claims, err := h.Service.Issuer.Parse(resp.AccessToken)
	if err != nil {
		t.Fatalf("parse access: %v", err)
	}
	if err := ExpectType(claims, TypeAccess); err != nil {
		t.Errorf("access type: %v", err)
	}
	if claims.UserID != uid {
		t.Errorf("uid drift: got %q want %q", claims.UserID, uid)
	}
}

func TestPasswordLogin_Idempotent(t *testing.T) {
	h, db, cleanup := newTestHandlers(t)
	defer cleanup()
	const email, pwd = "tester@dear-baby.app", "correct-password"
	uid := configureTestUser(t, h, db, email, pwd)

	body := `{"email":"` + email + `","password":"` + pwd + `"}`
	for i := 0; i < 3; i++ {
		rec := postPasswordLogin(t, h, body)
		if rec.Code != http.StatusOK {
			t.Fatalf("iter %d: status got %d, resp=%s", i, rec.Code, rec.Body.String())
		}
		var resp sessionResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("iter %d decode: %v", i, err)
		}
		if resp.User.ID != uid {
			t.Errorf("iter %d: user id drifted: %q vs %q", i, resp.User.ID, uid)
		}
	}
}

func TestSeedTestUser_SkipsWhenUnconfigured(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	creds, err := SeedTestUser(
		context.Background(),
		db,
		testEnsurer{},
		slog.New(slog.NewTextHandler(nopWriter{}, nil)),
		TestUserSeed{Email: "", Password: ""},
	)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if creds != nil {
		t.Errorf("expected nil creds, got %+v", creds)
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("expected no users seeded, found %d", n)
	}
}

func TestSeedTestUser_IdempotentAcrossReboots(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	logger := slog.New(slog.NewTextHandler(nopWriter{}, nil))

	first, err := SeedTestUser(context.Background(), db, testEnsurer{}, logger,
		TestUserSeed{Email: "tester@dear-baby.app", Password: "first-secret", Name: "Tester"})
	if err != nil {
		t.Fatalf("first seed: %v", err)
	}

	// Simulate a secret rotation: same email, new password.
	second, err := SeedTestUser(context.Background(), db, testEnsurer{}, logger,
		TestUserSeed{Email: "tester@dear-baby.app", Password: "second-secret", Name: "Tester"})
	if err != nil {
		t.Fatalf("second seed: %v", err)
	}

	// Old hash must no longer verify; new one must.
	if err := first.Verify("first-secret"); err != nil {
		t.Errorf("first creds should still verify their original password: %v", err)
	}
	if err := second.Verify("second-secret"); err != nil {
		t.Errorf("second creds should verify rotated password: %v", err)
	}
	if err := second.Verify("first-secret"); err == nil {
		t.Error("second creds must not accept rotated-out password")
	}

	// Single users row, despite two seed calls.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE email = ?`, "tester@dear-baby.app").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("expected exactly one users row, found %d", n)
	}
}
