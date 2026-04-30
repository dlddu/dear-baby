package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// fakeFetcher returns a fixed key map so tests don't reach Apple's JWKS.
type fakeFetcher struct {
	keys map[string]*rsa.PublicKey
	err  error
}

func (f *fakeFetcher) Fetch(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.keys, nil
}

func signAppleToken(t *testing.T, key *rsa.PrivateKey, kid string, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = kid
	signed, err := tok.SignedString(key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

func newAppleFixture(t *testing.T) (*rsa.PrivateKey, string, *AppleVerifier) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("genkey: %v", err)
	}
	const kid = "test-kid"
	v := &AppleVerifier{
		Audiences: []string{"com.dlddu.dearbaby"},
		Fetcher:   &fakeFetcher{keys: map[string]*rsa.PublicKey{kid: &key.PublicKey}},
	}
	return key, kid, v
}

func baseAppleClaims() jwt.MapClaims {
	now := time.Now()
	return jwt.MapClaims{
		"iss":   appleIssuer,
		"aud":   "com.dlddu.dearbaby",
		"sub":   "001234.deadbeef",
		"email": "tester@privaterelay.appleid.com",
		"iat":   now.Unix(),
		"exp":   now.Add(10 * time.Minute).Unix(),
	}
}

func TestAppleVerify_ValidToken(t *testing.T) {
	key, kid, v := newAppleFixture(t)
	tok := signAppleToken(t, key, kid, baseAppleClaims())

	claims, err := v.Verify(context.Background(), tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.Sub != "001234.deadbeef" {
		t.Errorf("sub: got %q", claims.Sub)
	}
	if claims.Email != "tester@privaterelay.appleid.com" {
		t.Errorf("email: got %q", claims.Email)
	}
}

func TestAppleVerify_AudienceMismatch(t *testing.T) {
	key, kid, v := newAppleFixture(t)
	c := baseAppleClaims()
	c["aud"] = "com.someone.else"
	tok := signAppleToken(t, key, kid, c)

	if _, err := v.Verify(context.Background(), tok); err == nil {
		t.Fatal("expected audience mismatch error")
	}
}

func TestAppleVerify_IssuerMismatch(t *testing.T) {
	key, kid, v := newAppleFixture(t)
	c := baseAppleClaims()
	c["iss"] = "https://evil.example.com"
	tok := signAppleToken(t, key, kid, c)

	if _, err := v.Verify(context.Background(), tok); err == nil {
		t.Fatal("expected issuer mismatch error")
	}
}

func TestAppleVerify_ExpiredToken(t *testing.T) {
	key, kid, v := newAppleFixture(t)
	c := baseAppleClaims()
	c["exp"] = time.Now().Add(-time.Minute).Unix()
	tok := signAppleToken(t, key, kid, c)

	if _, err := v.Verify(context.Background(), tok); err == nil {
		t.Fatal("expected expired token error")
	}
}

func TestAppleVerify_UnknownKid(t *testing.T) {
	key, _, v := newAppleFixture(t)
	tok := signAppleToken(t, key, "other-kid", baseAppleClaims())

	if _, err := v.Verify(context.Background(), tok); err == nil {
		t.Fatal("expected unknown kid error")
	}
}

func TestAppleVerify_ArrayAudience(t *testing.T) {
	key, kid, v := newAppleFixture(t)
	c := baseAppleClaims()
	c["aud"] = []any{"com.other", "com.dlddu.dearbaby"}
	tok := signAppleToken(t, key, kid, c)

	if _, err := v.Verify(context.Background(), tok); err != nil {
		t.Fatalf("verify with array aud: %v", err)
	}
}

func TestAppleJWKSFetcher_FetchesAndCaches(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("genkey: %v", err)
	}
	jwks := buildJWKSResponse(t, "kid-1", &key.PublicKey)

	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jwks))
	}))
	defer srv.Close()

	f := &AppleJWKSFetcher{URL: srv.URL}
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		keys, err := f.Fetch(ctx)
		if err != nil {
			t.Fatalf("fetch %d: %v", i, err)
		}
		if _, ok := keys["kid-1"]; !ok {
			t.Errorf("expected kid-1 in fetched keys: %v", keys)
		}
	}
	if calls != 1 {
		t.Errorf("expected JWKS to be fetched once, got %d calls", calls)
	}
}

func buildJWKSResponse(t *testing.T, kid string, pub *rsa.PublicKey) string {
	t.Helper()
	type k struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		Use string `json:"use"`
		Alg string `json:"alg"`
		N   string `json:"n"`
		E   string `json:"e"`
	}
	type js struct {
		Keys []k `json:"keys"`
	}
	n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())
	// 65537 is the canonical RSA exponent. The encoded form is fixed across
	// all keys we generate, so hard-coding 0x010001 keeps the test simple.
	e := base64.RawURLEncoding.EncodeToString([]byte{0x01, 0x00, 0x01})
	out, err := json.Marshal(js{Keys: []k{{
		Kty: "RSA", Kid: kid, Use: "sig", Alg: "RS256", N: n, E: e,
	}}})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return string(out)
}
