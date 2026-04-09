package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	TypeAccess  = "access"
	TypeRefresh = "refresh"
)

// Claims is the JWT claim set used for both access and refresh tokens.
// TokenType distinguishes them so that a refresh token is never accepted in
// place of an access token and vice versa.
type Claims struct {
	UserID    string `json:"uid"`
	TokenType string `json:"typ"`
	jwt.RegisteredClaims
}

// Issuer signs and parses JWTs using a shared HS256 secret.
type Issuer struct {
	Secret     []byte
	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

// IssueAccess returns a signed short-lived access token for the user.
func (i *Issuer) IssueAccess(userID string) (string, error) {
	return i.issue(userID, TypeAccess, i.AccessTTL)
}

// IssueRefresh returns a signed long-lived refresh token for the user. The
// returned jti is the unique token id embedded in the JWT's RegisteredClaims
// ID field so it can be correlated with a server-side refresh_tokens row.
func (i *Issuer) IssueRefresh(userID string) (tokenString, jti string, err error) {
	jti = uuid.NewString()
	tok, err := i.signWithJTI(userID, TypeRefresh, i.RefreshTTL, jti)
	return tok, jti, err
}

func (i *Issuer) issue(userID, typ string, ttl time.Duration) (string, error) {
	return i.signWithJTI(userID, typ, ttl, uuid.NewString())
}

func (i *Issuer) signWithJTI(userID, typ string, ttl time.Duration, jti string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:    userID,
		TokenType: typ,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			Issuer:    "dear-baby",
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(i.Secret)
}

// Parse validates a signed token string and returns the claims if valid.
// It does not check TokenType — callers must verify that with ExpectType.
func (i *Issuer) Parse(tokenString string) (*Claims, error) {
	tok, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return i.Secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := tok.Claims.(*Claims)
	if !ok || !tok.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// ExpectType returns an error if claims.TokenType does not match want.
func ExpectType(claims *Claims, want string) error {
	if claims.TokenType != want {
		return fmt.Errorf("wrong token type: got %q, want %q", claims.TokenType, want)
	}
	return nil
}
