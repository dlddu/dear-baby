package service

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"

	"github.com/dlddu/dear-baby/backend/internal/model"
	"github.com/dlddu/dear-baby/backend/internal/repository"
)

type DiaryService struct {
	repo *repository.DiaryRepository
}

func NewDiaryService(repo *repository.DiaryRepository) *DiaryService {
	return &DiaryService{repo: repo}
}

func (s *DiaryService) Create(userID string, req model.CreateDiaryRequest) (*model.DiaryEntryJSON, error) {
	if req.Content == "" {
		return nil, fmt.Errorf("content is required")
	}

	entryType := req.EntryType
	if entryType == "" {
		entryType = "text"
	}

	entry := &model.DiaryEntry{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     sql.NullString{String: req.Title, Valid: req.Title != ""},
		Content:   req.Content,
		EntryType: entryType,
		PregnancyWeek: sql.NullInt64{
			Int64: int64(req.PregnancyWeek),
			Valid: req.PregnancyWeek > 0,
		},
		Mood: sql.NullString{String: req.Mood, Valid: req.Mood != ""},
	}

	if err := s.repo.Create(entry); err != nil {
		return nil, err
	}

	created, err := s.repo.GetByID(entry.ID, userID)
	if err != nil {
		return nil, err
	}

	result := created.ToJSON()
	return &result, nil
}

func (s *DiaryService) GetByID(id, userID string) (*model.DiaryEntryJSON, error) {
	entry, err := s.repo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}
	result := entry.ToJSON()
	return &result, nil
}

func (s *DiaryService) List(userID string, page, limit int) (*model.PaginatedResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	entries, totalCount, err := s.repo.ListByUserID(userID, page, limit)
	if err != nil {
		return nil, err
	}

	jsonEntries := make([]model.DiaryEntryJSON, len(entries))
	for i, e := range entries {
		jsonEntries[i] = e.ToJSON()
	}

	return &model.PaginatedResponse{
		Data:       jsonEntries,
		Page:       page,
		Limit:      limit,
		TotalCount: totalCount,
	}, nil
}

func (s *DiaryService) Update(id, userID string, req model.UpdateDiaryRequest) (*model.DiaryEntryJSON, error) {
	entry, err := s.repo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	if req.Title != nil {
		entry.Title = sql.NullString{String: *req.Title, Valid: *req.Title != ""}
	}
	if req.Content != nil {
		if *req.Content == "" {
			return nil, fmt.Errorf("content cannot be empty")
		}
		entry.Content = *req.Content
	}
	if req.EntryType != nil {
		entry.EntryType = *req.EntryType
	}
	if req.PregnancyWeek != nil {
		entry.PregnancyWeek = sql.NullInt64{Int64: int64(*req.PregnancyWeek), Valid: *req.PregnancyWeek > 0}
	}
	if req.Mood != nil {
		entry.Mood = sql.NullString{String: *req.Mood, Valid: *req.Mood != ""}
	}

	if err := s.repo.Update(entry); err != nil {
		return nil, err
	}

	updated, err := s.repo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	result := updated.ToJSON()
	return &result, nil
}

func (s *DiaryService) Delete(id, userID string) error {
	return s.repo.SoftDelete(id, userID)
}
