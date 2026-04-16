package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

func newTestHandlers(t *testing.T) (*Handlers, func()) {
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
		Verifier: &GoogleVerifier{},
		Users:    usersStore,
		Refresh:  refreshStore,
		Issuer:   issuer,
	}
	h := &Handlers{Service: svc}
	return h, func() { db.Close() }
}

func TestTestLogin_DefaultUser(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/auth/test-login",
		strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.TestLogin(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var resp sessionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Error("tokens should be non-empty")
	}
	if resp.User == nil || resp.User.Email != defaultTestEmail {
		t.Errorf("default email: got %+v", resp.User)
	}
	if resp.User.OnboardedAt != nil {
		t.Error("default user should not be onboarded")
	}

	// Access token should be parseable and of type access.
	claims, err := h.Service.Issuer.Parse(resp.AccessToken)
	if err != nil {
		t.Fatalf("parse access: %v", err)
	}
	if err := ExpectType(claims, TypeAccess); err != nil {
		t.Errorf("access type: %v", err)
	}
	if claims.UserID != resp.User.ID {
		t.Errorf("uid drift: %q vs %q", claims.UserID, resp.User.ID)
	}
}

func TestTestLogin_OnboardedFlag(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/auth/test-login",
		strings.NewReader(`{"email":"a@b.com","name":"Alice","onboarded":true}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.TestLogin(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var resp sessionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.User.Email != "a@b.com" || resp.User.Name != "Alice" {
		t.Errorf("user fields: got %+v", resp.User)
	}
	if resp.User.OnboardedAt == nil {
		t.Error("onboarded=true should set onboarded_at")
	}
	if resp.User.DueDate != nil {
		t.Errorf("due_date: got %v want nil", *resp.User.DueDate)
	}
}

func TestTestLogin_IdempotentForSameEmail(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()

	body := `{"email":"dup@b.com"}`
	run := func() sessionResponse {
		req := httptest.NewRequest(http.MethodPost, "/auth/test-login",
			strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		h.TestLogin(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
		}
		var r sessionResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &r); err != nil {
			t.Fatalf("decode: %v", err)
		}
		return r
	}
	first := run()
	second := run()
	if first.User.ID != second.User.ID {
		t.Errorf("user id should be stable across test-login calls: %q vs %q",
			first.User.ID, second.User.ID)
	}
}
