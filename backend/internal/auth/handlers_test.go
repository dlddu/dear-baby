package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// localOnboardingOps implements both OnboardingOps and
// users.OnboardingEnsurer against the test DB so the handlers can run
// without pulling in the onboarding package.
type localOnboardingOps struct{ db *sql.DB }

func (l *localOnboardingOps) EnsureRowTx(ctx context.Context, tx *sql.Tx, userID string) error {
	_, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO onboarding (user_id) VALUES (?)`, userID)
	return err
}

var errLocalOnboardingNotFound = errors.New("onboarding not found")

func (l *localOnboardingOps) Reset(ctx context.Context, userID string) error {
	res, err := l.db.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = NULL, onboarded_at = NULL,
		    voice_coachmark_dismissed_at = NULL,
		    first_record_at = NULL, ai_preview = NULL,
		    updated_at = datetime('now')
		WHERE user_id = ?
	`, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errLocalOnboardingNotFound
	}
	return nil
}

func (l *localOnboardingOps) UpdateDueDateAndOnboardedAt(ctx context.Context, userID string, dueDate *string) error {
	var dueArg any
	if dueDate != nil {
		dueArg = *dueDate
	}
	res, err := l.db.ExecContext(ctx, `
		UPDATE onboarding
		SET due_date = ?, onboarded_at = datetime('now'), updated_at = datetime('now')
		WHERE user_id = ?
	`, dueArg, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errLocalOnboardingNotFound
	}
	return nil
}

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
	onb := &localOnboardingOps{db: db}
	svc := &Service{
		Verifier:   &GoogleVerifier{},
		Users:      usersStore,
		Onboarding: onb,
		Refresh:    refreshStore,
		Issuer:     issuer,
	}
	h := &Handlers{Service: svc, Onboarding: onb}
	return h, func() { db.Close() }
}

func TestTestLogin_EmptyEmailReturns400(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodPost, "/auth/test-login",
		strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.TestLogin(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400, body=%s", rec.Code, rec.Body.String())
	}
}

func TestTestLogin_WithEmail(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()

	const email = "fixture@dear-baby.test"
	req := httptest.NewRequest(http.MethodPost, "/auth/test-login",
		strings.NewReader(`{"email":"`+email+`"}`))
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
	if resp.User == nil || resp.User.Email != email {
		t.Errorf("email: got %+v", resp.User)
	}
	if resp.User.OnboardedAt != nil {
		t.Error("default user should not be onboarded")
	}

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

func TestApple_NotConfiguredReturns503(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()
	if h.Service.Apple != nil {
		t.Fatal("apple should be unconfigured by default")
	}

	req := httptest.NewRequest(http.MethodPost, "/auth/apple",
		strings.NewReader(`{"id_token":"anything"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.Apple(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status: got %d want 503, body=%s", rec.Code, rec.Body.String())
	}
}

func TestApple_ValidTokenIssuesSession(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("genkey: %v", err)
	}
	const kid = "test-kid"
	h.Service.Apple = &AppleVerifier{
		Audiences: []string{"com.dlddu.dearbaby"},
		Fetcher:   &fakeFetcher{keys: map[string]*rsa.PublicKey{kid: &key.PublicKey}},
	}

	now := time.Now()
	tokClaims := jwt.MapClaims{
		"iss":   appleIssuer,
		"aud":   "com.dlddu.dearbaby",
		"sub":   "001234.handlers",
		"email": "appleuser@privaterelay.appleid.com",
		"iat":   now.Unix(),
		"exp":   now.Add(10 * time.Minute).Unix(),
	}
	idToken := signAppleToken(t, key, kid, tokClaims)

	body, _ := json.Marshal(map[string]string{"id_token": idToken, "name": "Apple Tester"})
	req := httptest.NewRequest(http.MethodPost, "/auth/apple", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.Apple(rec, req)

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
	if resp.User == nil || resp.User.Email != "appleuser@privaterelay.appleid.com" {
		t.Errorf("user: got %+v", resp.User)
	}
	if resp.User.Name != "Apple Tester" {
		t.Errorf("name should pass through from request: got %q", resp.User.Name)
	}
}

func TestApple_InvalidTokenReturns401(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("genkey: %v", err)
	}
	h.Service.Apple = &AppleVerifier{
		Audiences: []string{"com.dlddu.dearbaby"},
		Fetcher:   &fakeFetcher{keys: map[string]*rsa.PublicKey{"k": &key.PublicKey}},
	}

	req := httptest.NewRequest(http.MethodPost, "/auth/apple",
		strings.NewReader(`{"id_token":"not-a-jwt"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.Apple(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestTestLogin_ResetOnboarding(t *testing.T) {
	h, cleanup := newTestHandlers(t)
	defer cleanup()

	call := func(body string) sessionResponse {
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

	r1 := call(`{"email":"reset@test.com","onboarded":true}`)
	if r1.User.OnboardedAt == nil {
		t.Fatal("expected onboarded_at to be set")
	}

	r2 := call(`{"email":"reset@test.com","onboarded":false}`)
	if r2.User.OnboardedAt != nil {
		t.Error("expected onboarded_at to be nil after reset")
	}
	if r1.User.ID != r2.User.ID {
		t.Errorf("user id should be stable: %q vs %q", r1.User.ID, r2.User.ID)
	}
}
