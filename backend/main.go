package main

import (
	"log"

	"github.com/dlddu/dear-baby/backend/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
