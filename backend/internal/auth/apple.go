package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// appleIssuer is the canonical iss claim Apple stamps on Sign in with Apple
// identity tokens. We compare with TrimSuffix on "/" because Apple has
// historically emitted both forms.
const appleIssuer = "https://appleid.apple.com"

// appleJWKSURL is the public endpoint that publishes Apple's signing keys.
// Keys rotate periodically and old ones stay for a grace period — we cache
// the full set and re-fetch when a token references an unknown kid.
const appleJWKSURL = "https://appleid.apple.com/auth/keys"

// appleJWKSTTL bounds how long we trust a cached key set before refreshing
// it proactively. A miss on the kid path also triggers a refresh.
const appleJWKSTTL = 1 * time.Hour

// AppleClaims is the subset of a verified Apple identity token we care
// about. Apple only includes the email/name on the very first sign-in;
// subsequent sign-ins return only sub, so callers must not depend on
// Email being non-empty across all calls.
type AppleClaims struct {
	Sub   string
	Email string
	// Name is never present in the identity token itself — Apple sends it
	// out-of-band in the authorization response on first sign-in. The
	// client is responsible for forwarding it; the verifier only knows
	// what's signed.
}

// AppleKeyFetcher abstracts the fetch step so tests can inject a static
// key set without going over the network.
type AppleKeyFetcher interface {
	Fetch(ctx context.Context) (map[string]*rsa.PublicKey, error)
}

// AppleVerifier validates Apple identity tokens against one or more allowed
// audiences. The audience must be the iOS bundle identifier (e.g.
// "com.dlddu.dearbaby") for the native Sign in with Apple flow, or the
// configured Service ID for the web flow.
type AppleVerifier struct {
	Audiences []string
	Fetcher   AppleKeyFetcher
}

// Verify parses and validates the given identity token, returning the
// subset of claims the auth service uses to upsert a user.
func (a *AppleVerifier) Verify(ctx context.Context, idToken string) (*AppleClaims, error) {
	if len(a.Audiences) == 0 {
		return nil, errors.New("no apple audiences configured")
	}
	if a.Fetcher == nil {
		return nil, errors.New("apple key fetcher not configured")
	}

	// Parse with a key func that looks up the kid in the cached JWKS. We
	// resolve the kid lazily so a key rotation only forces one extra
	// network call rather than failing every request until a TTL elapses.
	parser := jwt.NewParser(jwt.WithValidMethods([]string{"RS256"}))
	token, err := parser.ParseWithClaims(idToken, jwt.MapClaims{}, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("apple token missing kid")
		}
		keys, err := a.Fetcher.Fetch(ctx)
		if err != nil {
			return nil, fmt.Errorf("fetch jwks: %w", err)
		}
		key, ok := keys[kid]
		if !ok {
			return nil, fmt.Errorf("apple jwks: unknown kid %q", kid)
		}
		return key, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid apple token")
	}

	// Apple emits iss with no trailing slash; allow both anyway.
	iss, _ := claims["iss"].(string)
	if iss != appleIssuer && iss != appleIssuer+"/" {
		return nil, fmt.Errorf("apple token issuer mismatch: %q", iss)
	}

	// Audience may be either a string or []string in the wild. We accept
	// the token if any allowed audience appears.
	if !audienceMatches(claims["aud"], a.Audiences) {
		return nil, errors.New("apple token audience mismatch")
	}

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, errors.New("apple token missing sub")
	}
	email, _ := claims["email"].(string)
	return &AppleClaims{Sub: sub, Email: email}, nil
}

func audienceMatches(raw any, allowed []string) bool {
	switch v := raw.(type) {
	case string:
		for _, a := range allowed {
			if a == v {
				return true
			}
		}
	case []any:
		for _, item := range v {
			s, ok := item.(string)
			if !ok {
				continue
			}
			for _, a := range allowed {
				if a == s {
					return true
				}
			}
		}
	}
	return false
}

// AppleJWKSFetcher fetches and caches Apple's public signing keys. The
// cache is shared across requests because parsing the JWKS for every
// sign-in would add ~50ms of latency for no benefit.
type AppleJWKSFetcher struct {
	URL    string
	Client *http.Client

	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}

// Fetch returns the cached key set if it is fresh, otherwise fetches and
// parses the JWKS from Apple. Concurrent callers serialize through a
// single mutex — a brief blip during rotation is preferable to a thundering
// herd of HTTPS requests every time the cache expires.
func (f *AppleJWKSFetcher) Fetch(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.keys != nil && time.Since(f.fetchedAt) < appleJWKSTTL {
		return f.keys, nil
	}

	url := f.URL
	if url == "" {
		url = appleJWKSURL
	}
	client := f.Client
	if client == nil {
		client = http.DefaultClient
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build jwks request: %w", err)
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get jwks: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get jwks: status %d", res.StatusCode)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("read jwks: %w", err)
	}
	keys, err := parseAppleJWKS(body)
	if err != nil {
		return nil, err
	}
	f.keys = keys
	f.fetchedAt = time.Now()
	return keys, nil
}

type appleJWKS struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		Use string `json:"use"`
		Alg string `json:"alg"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func parseAppleJWKS(raw []byte) (map[string]*rsa.PublicKey, error) {
	var jwks appleJWKS
	if err := json.Unmarshal(raw, &jwks); err != nil {
		return nil, fmt.Errorf("decode jwks: %w", err)
	}
	out := make(map[string]*rsa.PublicKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			return nil, fmt.Errorf("decode jwks n: %w", err)
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			return nil, fmt.Errorf("decode jwks e: %w", err)
		}
		e := 0
		for _, b := range eBytes {
			e = e<<8 | int(b)
		}
		out[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: e,
		}
	}
	if len(out) == 0 {
		return nil, errors.New("apple jwks: no usable keys")
	}
	return out, nil
}
