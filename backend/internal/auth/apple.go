package auth

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/Timothylock/go-signin-with-apple/apple"
)

// AppleClaims is the subset of a verified Apple ID token that we care about.
// Email may be empty: Apple only returns it on the very first sign-in
// (and only if the user did not opt out), so handlers must tolerate the
// absent case rather than treating it as a hard failure.
type AppleClaims struct {
	Sub   string
	Email string
}

// AppleConfig groups the Apple Developer credentials needed to exchange an
// authorization code for an ID token. All fields are required; an empty
// PrivateKey is treated as "Apple sign-in is not configured" by AppleVerifier.
type AppleConfig struct {
	// TeamID is the 10-character Apple Developer Team ID (e.g. "ABC1234DEF").
	TeamID string
	// ClientID is the bundle ID for native iOS apps (e.g. "com.dlddu.dearbaby")
	// or the Services ID for web. Apple sets this as the `aud` claim on the
	// returned id_token.
	ClientID string
	// KeyID is the 10-character Key ID for the .p8 private key.
	KeyID string
	// PrivateKey is the PEM-encoded contents of the .p8 file downloaded from
	// the Apple Developer portal.
	PrivateKey string
}

// appleValidator is the subset of *apple.Client we use, extracted as an
// interface so tests can replace the network call with a stub.
type appleValidator interface {
	VerifyAppToken(ctx context.Context, reqBody apple.AppValidationTokenRequest, result interface{}) error
}

// AppleVerifier exchanges an Apple authorization code for an id_token via
// Apple's token endpoint and extracts the verified claims. The client_secret
// JWT is regenerated lazily and cached for ~5 days — Apple's secret can live
// up to 6 months but rotating well before that gives us headroom against
// clock skew and lets new pods pick up a fresh secret on restart.
type AppleVerifier struct {
	Cfg    AppleConfig
	Client appleValidator

	mu             sync.Mutex
	cachedSecret   string
	cachedSecretAt time.Time
}

// secretTTL is how long we reuse a generated client_secret before
// regenerating. Well below Apple's 180-day max so a stale secret is never
// the cause of a sign-in failure.
const appleSecretTTL = 5 * 24 * time.Hour

// Verify exchanges the given authorization code with Apple and returns the
// (sub, email) extracted from the id_token Apple sends back. The id_token
// is implicitly trusted because it came directly from Apple's token endpoint
// over TLS, in response to a request signed with our private key.
func (a *AppleVerifier) Verify(ctx context.Context, code string) (*AppleClaims, error) {
	if a.Cfg.PrivateKey == "" || a.Cfg.TeamID == "" || a.Cfg.ClientID == "" || a.Cfg.KeyID == "" {
		return nil, errors.New("apple sign-in not configured")
	}
	if code == "" {
		return nil, errors.New("apple: empty authorization code")
	}

	secret, err := a.clientSecret()
	if err != nil {
		return nil, fmt.Errorf("apple: client secret: %w", err)
	}

	client := a.Client
	if client == nil {
		client = apple.New()
	}

	var resp apple.ValidationResponse
	if err := client.VerifyAppToken(ctx, apple.AppValidationTokenRequest{
		ClientID:     a.Cfg.ClientID,
		ClientSecret: secret,
		Code:         code,
	}, &resp); err != nil {
		return nil, fmt.Errorf("apple: verify: %w", err)
	}
	if resp.Error != "" {
		return nil, fmt.Errorf("apple: %s: %s", resp.Error, resp.ErrorDescription)
	}
	if resp.IDToken == "" {
		return nil, errors.New("apple: empty id_token in response")
	}

	claims, err := apple.GetClaims(resp.IDToken)
	if err != nil {
		return nil, fmt.Errorf("apple: parse claims: %w", err)
	}
	c := *claims

	sub, _ := c["sub"].(string)
	if sub == "" {
		return nil, errors.New("apple: missing sub claim")
	}
	email, _ := c["email"].(string)
	return &AppleClaims{Sub: sub, Email: email}, nil
}

// clientSecret returns the cached client_secret JWT or generates a new one
// when the cache is empty or stale. Concurrent callers serialize on the
// mutex to avoid burning ECDSA signing cycles in parallel — the JWT is
// stable for days, so the contention window is negligible.
func (a *AppleVerifier) clientSecret() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.cachedSecret != "" && time.Since(a.cachedSecretAt) < appleSecretTTL {
		return a.cachedSecret, nil
	}
	secret, err := apple.GenerateClientSecret(a.Cfg.PrivateKey, a.Cfg.TeamID, a.Cfg.ClientID, a.Cfg.KeyID)
	if err != nil {
		return "", err
	}
	a.cachedSecret = secret
	a.cachedSecretAt = time.Now()
	return secret, nil
}
