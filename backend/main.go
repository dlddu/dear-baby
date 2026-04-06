package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"github.com/dlddu/dear-baby/backend/internal/config"
	"github.com/dlddu/dear-baby/backend/internal/database"
	"github.com/dlddu/dear-baby/backend/internal/handler"
	"github.com/dlddu/dear-baby/backend/internal/middleware"
	"github.com/dlddu/dear-baby/backend/internal/repository"
	"github.com/dlddu/dear-baby/backend/internal/service"
)

func main() {
	cfg := config.Load()

	if cfg.IsTestMode() {
		log.Println("WARNING: Running in test auth mode. Do not use in production.")
	}
	if cfg.JWTSecret == "dev-secret-change-in-production" {
		log.Println("WARNING: Using default JWT secret. Set JWT_SECRET for production.")
	}

	db, err := database.New(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Repositories
	userRepo := repository.NewUserRepository(db)
	diaryRepo := repository.NewDiaryRepository(db)

	// Services
	authService := service.NewAuthService(cfg, userRepo, db)
	diaryService := service.NewDiaryService(diaryRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authService)
	diaryHandler := handler.NewDiaryHandler(diaryService)

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logging)
	r.Use(cors.Handler(middleware.CORS()))

	// Public routes
	r.Get("/health", handler.HealthHandler)

	// Auth routes (no JWT required)
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/google", authHandler.GoogleLogin)
		r.Post("/refresh", authHandler.Refresh)
	})

	// Protected routes (JWT required)
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret))

		r.Route("/diary", func(r chi.Router) {
			r.Get("/", diaryHandler.List)
			r.Post("/", diaryHandler.Create)
			r.Get("/{id}", diaryHandler.GetByID)
			r.Put("/{id}", diaryHandler.Update)
			r.Delete("/{id}", diaryHandler.Delete)
		})
	})

	log.Printf("Server starting on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, r))
}
