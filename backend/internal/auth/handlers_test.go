package auth

import (
	"context"
	"database/sql"
	"encoding/json"
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
	passwordStore := &PasswordStore{DB: db}
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
		Passwords:  passwordStore,
	}
	h := &Handlers{Service: svc}
	return h, db, func() { db.Close() }
}

// seedPasswordUser creates a users row, links it to oauth_accounts under
// provider="password", ensures an onboarding row, and stores a bcrypt
// hash — the same shape SeedTestUser produces at boot.
func seedPasswordUser(t *testing.T, db *sql.DB, email, password string) string {
	t.Helper()
	ctx := context.Background()
	usersStore := &users.Store{DB: db}
	passwordStore := &PasswordStore{DB: db}
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	id, err := upsertPasswordUser(ctx, db, usersStore, testEnsurer{}, TestUserSeed{
		Email: email,
		Name:  "Tester",
	})
	if err != nil {
		t.Fatalf("upsert seed: %v", err)
	}
	if err := passwordStore.Upsert(ctx, id, hash); err != nil {
		t.Fatalf("password upsert: %v", err)
	}
	return id
}

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

func TestPasswordLogin_UnknownEmailReturns401(t *testing.T) {
	h, _, cleanup := newTestHandlers(t)
	defer cleanup()

	rec := postPasswordLogin(t, h, `{"email":"nobody@dear-baby.app","password":"hunter2"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d want 401, resp=%s", rec.Code, rec.Body.String())
	}
}

func TestPasswordLogin_WrongPasswordReturns401(t *testing.T) {
	h, db, cleanup := newTestHandlers(t)
	defer cleanup()
	seedPasswordUser(t, db, "tester@dear-baby.app", "correct-password")

	rec := postPasswordLogin(t, h, `{"email":"tester@dear-baby.app","password":"wrong-password"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d want 401, resp=%s", rec.Code, rec.Body.String())
	}
}

func TestPasswordLogin_Success(t *testing.T) {
	h, db, cleanup := newTestHandlers(t)
	defer cleanup()
	const email, pwd = "tester@dear-baby.app", "correct-password"
	uid := seedPasswordUser(t, db, email, pwd)

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
	uid := seedPasswordUser(t, db, email, pwd)

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
