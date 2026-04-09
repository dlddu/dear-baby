# dear-baby backend

Go 1.22 HTTP API backing the dear-baby Expo app.

## Run locally

```bash
go mod tidy
go run .
curl localhost:8080/health    # -> {"status":"ok"}
```

The first run creates `./dear-baby.db` and applies the embedded migrations.
To reset the database, stop the server and delete `dear-baby.db` and its
WAL sidecars:

```bash
rm -f dear-baby.db dear-baby.db-*
```

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | HTTP listen port. |
| `DATABASE_URL` | `file:./dear-baby.db?_pragma=foreign_keys(1)&_pragma=journal_mode(wal)` | SQLite DSN accepted by `modernc.org/sqlite`. |
| `JWT_SECRET` | dev placeholder | HMAC secret for signing access/refresh JWTs. **Set this in any non-dev environment.** |
| `JWT_ACCESS_TTL` | `15m` | Access token lifetime (`time.ParseDuration` format). |
| `JWT_REFRESH_TTL` | `720h` | Refresh token lifetime (30 days). |
| `GOOGLE_ALLOWED_AUDIENCES` | _empty_ | Comma-separated list of Google OAuth client IDs that `POST /auth/google` will accept. Usually the iOS, Android, and Web client IDs. If empty, `/auth/google` returns 500 but the rest of the service still works (this is why CI's health check still passes without Google env vars). |

## Endpoints

- `GET /health` — `{"status":"ok"}`. Response shape is byte-equivalent to the
  pre-scaffold handler so the Maestro E2E flow and CI health check keep
  passing.
- `POST /auth/google` — body `{"id_token": "..."}`. Verifies the Google ID
  token via `google.golang.org/api/idtoken`, upserts the user, and returns
  `{"access_token","refresh_token","user"}`.
- `POST /auth/refresh` — body `{"refresh_token": "..."}`. Rotates the
  refresh token and returns a new pair.
- `POST /auth/logout` — body `{"refresh_token": "..."}`. Idempotent, always
  responds with 204.
- `GET /me` — requires `Authorization: Bearer <access>`. Returns the
  authenticated user.

## Layout

```
main.go                          // thin shim → internal/app.Run
internal/
  app/        // HTTP wiring (chi router, middleware, lifecycle)
  config/     // Load() from environment
  db/         // sql.Open + migrate runner
  migrations/ // //go:embed-ed .sql files, applied on startup
  httpx/      // health handler, CORS/logger/recoverer middleware, JSON helpers
  auth/       // JWT issuer, Google verifier, refresh store, handlers, middleware
  users/      // User model, SQL store, /me handler
```

## Common tasks

```bash
make run      # go run .
make build    # go build -o server .
make test     # go test ./...
make tidy     # go mod tidy
```
