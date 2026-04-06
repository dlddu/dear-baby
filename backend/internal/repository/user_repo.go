package repository

import (
	"database/sql"
	"fmt"

	"github.com/dlddu/dear-baby/backend/internal/model"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *model.User) error {
	_, err := r.db.Exec(
		`INSERT INTO users (id, google_id, email, name, profile_image, due_date, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		user.ID, user.GoogleID, user.Email, user.Name, user.ProfileImage, user.DueDate,
	)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (r *UserRepository) GetByID(id string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, google_id, email, name, profile_image, due_date, created_at, updated_at
		 FROM users WHERE id = ?`, id,
	).Scan(&user.ID, &user.GoogleID, &user.Email, &user.Name,
		&user.ProfileImage, &user.DueDate, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetByGoogleID(googleID string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, google_id, email, name, profile_image, due_date, created_at, updated_at
		 FROM users WHERE google_id = ?`, googleID,
	).Scan(&user.ID, &user.GoogleID, &user.Email, &user.Name,
		&user.ProfileImage, &user.DueDate, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user by google id: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetByEmail(email string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, google_id, email, name, profile_image, due_date, created_at, updated_at
		 FROM users WHERE email = ?`, email,
	).Scan(&user.ID, &user.GoogleID, &user.Email, &user.Name,
		&user.ProfileImage, &user.DueDate, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return user, nil
}

func (r *UserRepository) UpdateName(id, name string) error {
	_, err := r.db.Exec(
		`UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		name, id,
	)
	return err
}
