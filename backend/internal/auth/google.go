package auth

import (
	"context"
	"errors"

	"google.golang.org/api/idtoken"
)

// GoogleClaims is the subset of a verified Google ID token that we care about.
type GoogleClaims struct {
	Sub     string
	Email   string
	Name    string
	Picture string
}

// GoogleVerifier validates Google ID tokens against one or more allowed
// audience client IDs. A token is accepted if it is valid for any of the
// configured audiences (useful for apps that have separate iOS, Android, and
// Web client IDs).
type GoogleVerifier struct {
	Audiences []string
}

// Verify validates the given ID token and returns its claims, or an error if
// the token is invalid for every configured audience.
func (g *GoogleVerifier) Verify(ctx context.Context, idToken string) (*GoogleClaims, error) {
	if len(g.Audiences) == 0 {
		return nil, errors.New("no google audiences configured")
	}
	var lastErr error
	for _, aud := range g.Audiences {
		payload, err := idtoken.Validate(ctx, idToken, aud)
		if err == nil {
			return &GoogleClaims{
				Sub:     payload.Subject,
				Email:   asString(payload.Claims["email"]),
				Name:    asString(payload.Claims["name"]),
				Picture: asString(payload.Claims["picture"]),
			}, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}
