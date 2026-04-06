package service

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/model"
	"github.com/dlddu/dear-baby/backend/internal/repository"
)

type AuthService struct {
	cfg      *config.Config
	userRepo *repository.UserRepository
	db       *sql.DB
}

func NewAuthService(cfg *config.Config, userRepo *repository.UserRepository, db *sql.DB) *AuthService {
	return &AuthService{cfg: cfg, userRepo: userRepo, db: db}
}

type GoogleAuthRequest struct {
	IDToken  string `json:"id_token"`
	GoogleID string `json:"google_id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Picture  string `json:"picture"`
}

type AuthResponse struct {
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token"`
	ExpiresIn    int            `json:"expires_in"`
	User         model.UserJSON `json:"user"`
}

type GoogleTokenInfo struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func (s *AuthService) AuthenticateWithGoogle(req GoogleAuthRequest) (*AuthResponse, error) {
	var googleInfo *GoogleTokenInfo

	if s.cfg.IsTestMode() {
		if req.GoogleID == "" || req.Email == "" || req.Name == "" {
			return nil, fmt.Errorf("test mode requires google_id, email, and name")
		}
		googleInfo = &GoogleTokenInfo{
			Sub:     req.GoogleID,
			Email:   req.Email,
			Name:    req.Name,
			Picture: req.Picture,
		}
	} else {
		var err error
		googleInfo, err = s.verifyGoogleIDToken(req.IDToken)
		if err != nil {
			return nil, fmt.Errorf("verify google token: %w", err)
		}
	}

	user, err := s.userRepo.GetByGoogleID(googleInfo.Sub)
	if err != nil {
		user = &model.User{
			ID:       uuid.New().String(),
			GoogleID: googleInfo.Sub,
			Email:    googleInfo.Email,
			Name:     googleInfo.Name,
			ProfileImage: sql.NullString{
				String: googleInfo.Picture,
				Valid:  googleInfo.Picture != "",
			},
		}
		if err := s.userRepo.Create(user); err != nil {
			return nil, fmt.Errorf("create user: %w", err)
		}
	}

	accessToken, err := s.generateAccessToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshToken, err := s.generateAndStoreRefreshToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    900, // 15 minutes
		User:         user.ToJSON(),
	}, nil
}

func (s *AuthService) RefreshAccessToken(refreshToken string) (*AuthResponse, error) {
	tokenHash := hashToken(refreshToken)

	var userID string
	var expiresAt time.Time
	err := s.db.QueryRow(
		`SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?`, tokenHash,
	).Scan(&userID, &expiresAt)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	if time.Now().After(expiresAt) {
		s.db.Exec("DELETE FROM refresh_tokens WHERE token_hash = ?", tokenHash)
		return nil, fmt.Errorf("refresh token expired")
	}

	// Delete old refresh token
	s.db.Exec("DELETE FROM refresh_tokens WHERE token_hash = ?", tokenHash)

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	accessToken, err := s.generateAccessToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	newRefreshToken, err := s.generateAndStoreRefreshToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    900,
		User:         user.ToJSON(),
	}, nil
}

func (s *AuthService) verifyGoogleIDToken(idToken string) (*GoogleTokenInfo, error) {
	if idToken == "" {
		return nil, fmt.Errorf("id_token is required")
	}

	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken)
	if err != nil {
		return nil, fmt.Errorf("verify token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("invalid token: %s", string(body))
	}

	var info GoogleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decode token info: %w", err)
	}

	if info.Sub == "" {
		return nil, fmt.Errorf("invalid token: no subject")
	}

	return &info, nil
}

func (s *AuthService) generateAccessToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(15 * time.Minute).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *AuthService) generateAndStoreRefreshToken(userID string) (string, error) {
	refreshToken := uuid.New().String()
	tokenHash := hashToken(refreshToken)
	expiresAt := time.Now().Add(30 * 24 * time.Hour)

	_, err := s.db.Exec(
		`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
		uuid.New().String(), userID, tokenHash, expiresAt,
	)
	if err != nil {
		return "", fmt.Errorf("store refresh token: %w", err)
	}

	return refreshToken, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}
