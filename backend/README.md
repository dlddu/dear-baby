# dear-baby backend

Go 1.22 HTTP API backing the dear-baby Expo app.

## Run locally

```bash
go mod tidy
go run ./cmd/server
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
| `APPLE_TEAM_ID` | _empty_ | Apple Developer Team ID (10 chars). Required for Sign in with Apple. |
| `APPLE_CLIENT_ID` | _empty_ | Bundle ID for the iOS app (or Services ID for web). Apple sets this as the `aud` claim on the id_token. |
| `APPLE_KEY_ID` | _empty_ | 10-char Key ID of the .p8 private key. |
| `APPLE_PRIVATE_KEY` | _empty_ | PEM contents of the .p8 file. Literal `\n` sequences are normalized to real newlines so the value round-trips through k8s/GitHub Actions secrets. |
| `APPLE_PRIVATE_KEY_PATH` | _empty_ | Alternative to `APPLE_PRIVATE_KEY`: path to the .p8 file on disk. Ignored when `APPLE_PRIVATE_KEY` is set. |

## API versioning

All product routes are mounted under `/v1`. The version segment is the
single constant `httpx.APIVersion` (see `internal/httpx/version.go`);
bumping to `/v2` means adding a new `chi.Route` block in
`internal/app/router.go` and (optionally, during the cutover) leaving
`/v1` mounted alongside.

Operational endpoints stay **unversioned** so that k8s probes, CI smoke
tests, and the landing-screen health check don't have to track API
version bumps:

- `GET /health`

Every response — versioned or not — carries an `X-API-Version` header
set to the version this binary speaks. Clients can pin or log it; ops
can spot stale deployments without parsing routes.

## Endpoints

- `GET /health` — `{"status":"ok"}`. Response shape is byte-equivalent to the
  pre-scaffold handler so the Maestro E2E flow and CI health check keep
  passing.
- `POST /v1/auth/google` — body `{"id_token": "..."}`. Verifies the Google ID
  token via `google.golang.org/api/idtoken`, upserts the user, and returns
  `{"access_token","refresh_token","user"}`.
- `POST /v1/auth/apple` — body
  `{"code": "...", "given_name": "...", "family_name": "..."}`. Exchanges
  the Apple authorization code via
  `github.com/Timothylock/go-signin-with-apple`, upserts the user under
  `provider="apple"`, and returns the same session shape. `given_name`
  / `family_name` are only present on the first sign-in. Returns 503 if
  any of the `APPLE_*` env vars are unset.
- `POST /v1/auth/refresh` — body `{"refresh_token": "..."}`. Rotates the
  refresh token and returns a new pair.
- `POST /v1/auth/logout` — body `{"refresh_token": "..."}`. Idempotent, always
  responds with 204.
- `POST /v1/auth/password-login` — body `{"email": "...", "password": "..."}`.
  Backs the seeded test account; gated by the seeded password (only known
  to the App Store reviewer and CI).
- `GET /v1/me` — requires `Authorization: Bearer <access>`. Returns the
  authenticated user.
- `PATCH /v1/me` — completes Stage 1 onboarding (`{"due_date": ...}`) or
  dismisses the home voice coachmark (`{"dismiss_voice_coachmark": true}`).
- `POST /v1/records` — creates a text or voice record.
- `POST /v1/records/{id}/audio/upload-url` — issues an S3 presigned PUT.
- `PATCH /v1/records/{id}` — attaches an `audio_s3_key` after the upload.
- `POST /v1/onboarding/ai-preview` — kicks off (or retries) AI preview
  generation; responds 202.
- `GET /v1/onboarding/ai-preview/events` — long-lived SSE stream of
  preview events. Accepts `?token=` as a query fallback for clients that
  cannot set the `Authorization` header.

## Layout

```
cmd/
  server/            // server entrypoint → internal/app.Run
  reset-user/        // ops CLI: wipes per-user onboarding + children/fetuses/records by email
internal/
  app/        // HTTP wiring (chi router, middleware, lifecycle)
  config/     // Load() from environment
  db/         // sql.Open + migrate runner
  migrations/ // //go:embed-ed .sql files, applied on startup
  httpx/      // health handler, CORS/logger/recoverer middleware, JSON helpers
  auth/       // JWT issuer, Google verifier, refresh store, handlers, middleware
  users/      // User model, SQL store, /me handler
scripts/
  reset-user.sh        // busybox-sh wrapper shipped in the container image
```

## Common tasks

```bash
make run      # go run ./cmd/server
make build    # go build -o server ./cmd/server
make test     # go test ./...
make tidy     # go mod tidy
```
