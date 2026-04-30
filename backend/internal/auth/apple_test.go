package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"strings"
	"testing"
	"time"

	"github.com/Timothylock/go-signin-with-apple/apple"
	"github.com/golang-jwt/jwt/v5"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// genAppleP8 emits a PEM-encoded ECDSA P-256 PKCS8 private key. The
// go-signin-with-apple library's GenerateClientSecret refuses anything
// that isn't a valid PKCS8 PEM, so the test setup mirrors what a real
// .p8 file looks like.
func genAppleP8(t *testing.T) string {
	t.Helper()
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("ecdsa: %v", err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
}

// signAppleIDToken returns an unsigned JWT carrying just the claims the
// verifier reads back (sub, email). Signature is HS256 with a throwaway
// key — the verifier uses ParseUnverified so it never checks it.
func signAppleIDToken(t *testing.T, sub, email string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":   sub,
		"iss":   "https://appleid.apple.com",
		"aud":   "com.test.app",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(time.Hour).Unix(),
		"email": email,
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := tok.SignedString([]byte("k"))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

// fakeAppleClient is an appleValidator that returns a canned response
// without doing any HTTP. Used to test AppleVerifier.Verify in isolation.
type fakeAppleClient struct {
	resp apple.ValidationResponse
	err  error
	// Captured request fields, for assertions on what we sent.
	gotClientID     string
	gotClientSecret string
	gotCode         string
}

func (f *fakeAppleClient) VerifyAppToken(_ context.Context, req apple.AppValidationTokenRequest, result interface{}) error {
	f.gotClientID = req.ClientID
	f.gotClientSecret = req.ClientSecret
	f.gotCode = req.Code
	if f.err != nil {
		return f.err
	}
	out, ok := result.(*apple.ValidationResponse)
	if !ok {
		return errors.New("result is not *apple.ValidationResponse")
	}
	*out = f.resp
	return nil
}

func newAppleVerifier(t *testing.T, fake *fakeAppleClient) *AppleVerifier {
	return &AppleVerifier{
		Cfg: AppleConfig{
			TeamID:     "TEAMIDXXXX",
			ClientID:   "com.test.app",
			KeyID:      "KEYIDXXXXX",
			PrivateKey: genAppleP8(t),
		},
		Client: fake,
	}
}

func TestAppleVerifier_VerifyHappyPath(t *testing.T) {
	fake := &fakeAppleClient{resp: apple.ValidationResponse{
		IDToken: signAppleIDToken(t, "apple-sub-1", "apple@example.com"),
	}}
	v := newAppleVerifier(t, fake)

	got, err := v.Verify(context.Background(), "auth-code-123")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if got.Sub != "apple-sub-1" {
		t.Errorf("sub: got %q", got.Sub)
	}
	if got.Email != "apple@example.com" {
		t.Errorf("email: got %q", got.Email)
	}
	if fake.gotCode != "auth-code-123" {
		t.Errorf("code: got %q", fake.gotCode)
	}
	if fake.gotClientID != "com.test.app" {
		t.Errorf("client id: got %q", fake.gotClientID)
	}
	if fake.gotClientSecret == "" {
		t.Error("client secret should be a generated JWT, got empty")
	}
}

func TestAppleVerifier_AppleErrorBubblesUp(t *testing.T) {
	fake := &fakeAppleClient{resp: apple.ValidationResponse{
		Error:            "invalid_client",
		ErrorDescription: "no good",
	}}
	v := newAppleVerifier(t, fake)

	if _, err := v.Verify(context.Background(), "code"); err == nil {
		t.Fatal("expected error")
	} else if !strings.Contains(err.Error(), "invalid_client") {
		t.Errorf("error should mention apple code, got %v", err)
	}
}

func TestAppleVerifier_EmptyCodeRejected(t *testing.T) {
	v := newAppleVerifier(t, &fakeAppleClient{})
	if _, err := v.Verify(context.Background(), ""); err == nil {
		t.Fatal("expected error for empty code")
	}
}

func TestAppleVerifier_UnconfiguredFailsClosed(t *testing.T) {
	v := &AppleVerifier{} // all fields empty
	if _, err := v.Verify(context.Background(), "code"); err == nil {
		t.Fatal("expected error from unconfigured verifier")
	}
}

func TestAppleVerifier_ClientSecretIsCached(t *testing.T) {
	fake := &fakeAppleClient{resp: apple.ValidationResponse{
		IDToken: signAppleIDToken(t, "s", ""),
	}}
	v := newAppleVerifier(t, fake)
	if _, err := v.Verify(context.Background(), "c"); err != nil {
		t.Fatalf("first: %v", err)
	}
	first := fake.gotClientSecret

	// Reset and verify again — the secret should be the same cached JWT.
	fake.gotClientSecret = ""
	if _, err := v.Verify(context.Background(), "c"); err != nil {
		t.Fatalf("second: %v", err)
	}
	if fake.gotClientSecret != first {
		t.Errorf("expected cached secret to be reused; got new %q vs first %q", fake.gotClientSecret, first)
	}
}

// stubAppleVerifier implements AppleCodeVerifier for Service-level tests.
type stubAppleVerifier struct {
	claims *AppleClaims
	err    error
}

func (s stubAppleVerifier) Verify(_ context.Context, _ string) (*AppleClaims, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.claims, nil
}

func newAppleService(t *testing.T, av AppleCodeVerifier) *Service {
	t.Helper()
	db := newTestDB(t)
	t.Cleanup(func() { db.Close() })
	return &Service{
		Verifier:      &GoogleVerifier{},
		AppleVerifier: av,
		Users:         &users.Store{DB: db},
		Onboarding:    testEnsurer{},
		Refresh:       &RefreshStore{DB: db},
		Issuer: &Issuer{
			Secret:     []byte("test-secret"),
			AccessTTL:  5 * time.Minute,
			RefreshTTL: time.Hour,
		},
	}
}

func TestService_SignInWithApple_NewUser(t *testing.T) {
	svc := newAppleService(t, stubAppleVerifier{
		claims: &AppleClaims{Sub: "apple-1", Email: "user@example.com"},
	})

	got, err := svc.SignInWithApple(context.Background(), AppleSignInInput{
		Code:       "code",
		GivenName:  "Min",
		FamilyName: "Park",
	})
	if err != nil {
		t.Fatalf("sign in: %v", err)
	}
	if got.User.Email != "user@example.com" {
		t.Errorf("email: got %q", got.User.Email)
	}
	if got.User.Name != "Min Park" {
		t.Errorf("name: got %q", got.User.Name)
	}
	if got.AccessToken == "" || got.RefreshToken == "" {
		t.Error("tokens should be issued")
	}
}

func TestService_SignInWithApple_ReturningUser_KeepsName(t *testing.T) {
	svc := newAppleService(t, stubAppleVerifier{
		claims: &AppleClaims{Sub: "apple-2", Email: "ret@example.com"},
	})
	ctx := context.Background()
	first, err := svc.SignInWithApple(ctx, AppleSignInInput{Code: "c", GivenName: "Su", FamilyName: "Lee"})
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	if first.User.Name != "Su Lee" {
		t.Fatalf("first name: got %q", first.User.Name)
	}

	// Subsequent sign-in: Apple omits name and email from the
	// id_token, but our placeholder email is stable enough that the
	// upsert finds the same row by oauth (sub, provider).
	svc.AppleVerifier = stubAppleVerifier{
		claims: &AppleClaims{Sub: "apple-2"},
	}
	second, err := svc.SignInWithApple(ctx, AppleSignInInput{Code: "c"})
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if second.User.ID != first.User.ID {
		t.Errorf("user id should be stable: %q vs %q", first.User.ID, second.User.ID)
	}
	if second.User.Name != "Su Lee" {
		t.Errorf("name should be preserved across re-sign-in, got %q", second.User.Name)
	}
}

func TestService_SignInWithApple_PrivateRelayPlaceholderEmail(t *testing.T) {
	svc := newAppleService(t, stubAppleVerifier{
		claims: &AppleClaims{Sub: "apple-noemail"},
	})
	got, err := svc.SignInWithApple(context.Background(), AppleSignInInput{Code: "c"})
	if err != nil {
		t.Fatalf("sign in: %v", err)
	}
	want := "apple-noemail@privaterelay.appleid.local"
	if got.User.Email != want {
		t.Errorf("email: got %q want %q", got.User.Email, want)
	}
}

// TestAppleVerifier_RealClientHitsURL exercises the production path
// (apple.New() with a custom URL) to make sure the library wiring still
// works end-to-end. We point the validator at an httptest server that
// echoes a synthetic id_token.
func TestAppleVerifier_RealClientHitsURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Library sends form-encoded body; we don't introspect it
		// here, but use httputil.DumpRequest only if the test fails
		// for diagnostics.
		_ = r
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id_token":"` + signAppleIDToken(t, "real-sub", "real@x.com") + `"}`))
	}))
	t.Cleanup(srv.Close)

	v := &AppleVerifier{
		Cfg: AppleConfig{
			TeamID:     "TEAMIDXXXX",
			ClientID:   "com.test.app",
			KeyID:      "KEYIDXXXXX",
			PrivateKey: genAppleP8(t),
		},
		Client: apple.NewWithOptions(apple.ClientOptions{ValidationURL: srv.URL}),
	}
	got, err := v.Verify(context.Background(), "code")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if got.Sub != "real-sub" {
		t.Errorf("sub: got %q", got.Sub)
	}
}

// silence unused-import warning if httputil ever stops being used in
// diagnostics — keeps the import list stable across edits.
var _ = httputil.DumpRequest
