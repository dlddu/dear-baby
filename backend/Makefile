.PHONY: run build tidy test seed-test-users

run:
	go run ./cmd/server

build:
	go build -o server ./cmd/server

tidy:
	go mod tidy

test:
	go test ./...

# Seed the built-in QA personas. Requires TEST_AUTH_ENABLED=1 — the
# command refuses to touch a database without that flag set so we can't
# accidentally seed prod. Override DATABASE_URL/file via env / make vars.
seed-test-users:
	TEST_AUTH_ENABLED=1 go run ./cmd/seed-test-users $(ARGS)
