# dear-baby app

Expo 54 / React Native 0.81 mobile app for dear-baby, using file-based
routing via `expo-router`.

## Run locally

```bash
npm install
npx expo start
```

The backend must be reachable at `EXPO_PUBLIC_API_URL` (default
`http://localhost:8080`).

## Environment variables

All variables the bundler inlines must be prefixed with `EXPO_PUBLIC_`.
Build identifiers (the four below the bundler-inlined block) are read by
`app.config.ts` at Expo prebuild time and by Fastlane / Maestro flows —
they are NOT bundle-inlined and therefore do NOT need the `EXPO_PUBLIC_`
prefix. See `app/.env.example` for the complete template.

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL. Defaults to `http://localhost:8080`. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | iOS OAuth client ID from Google Cloud Console. |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android OAuth client ID. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web OAuth client ID — this is the audience the backend verifies the ID token against. |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog project API key. Leave unset to disable analytics (the provider degrades to a no-op). |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog ingestion host. Defaults to `https://us.i.posthog.com`; use `https://eu.i.posthog.com` for the EU region. |
| `APP_BUNDLE_IDENTIFIER` | iOS bundle id stamped into `PRODUCT_BUNDLE_IDENTIFIER`. Also feeds Fastlane and the Maestro `appId`. Public — committed to `app/.env`. |
| `APP_ANDROID_PACKAGE` | Android applicationId. Public — committed to `app/.env`. |
| `GOOGLE_IOS_URL_SCHEME` | Reversed-client-id URL scheme for the iOS Google OAuth client (matches `com.googleusercontent.apps.<stem>`). Public — committed to `app/.env`. |
| `APPLE_TEAM_ID` | Apple Developer team id (10-char alphanumeric). Secret — kept in `app/.env.local` locally and GitHub Secrets in CI. |

## Local setup

The four build identifiers above must be present in the process
environment before `app.config.ts` runs (Expo prebuild and any
`npx expo run:*` invocation). Three of them (`APP_BUNDLE_IDENTIFIER`,
`APP_ANDROID_PACKAGE`, `GOOGLE_IOS_URL_SCHEME`) live in `app/.env`,
which is committed. The Apple team id is not committed:

1. Copy `app/.env.example` → `app/.env.local` (gitignored).
2. Fill in `APPLE_TEAM_ID` with the team id from a teammate (1Password
   or the same secret channel CI's `APPLE_TEAM_ID` GitHub Secret is
   sourced from).
3. The Expo CLI auto-loads both `.env` and `.env.local` from the project
   root, so `npx expo prebuild` / `npx expo start` will pick the value
   up without further setup.

CI workflows source the same names from GitHub Variables (the three
public ones, under `vars.APP_BUNDLE_IDENTIFIER` etc.) and Secrets
(`secrets.APPLE_TEAM_ID`); see `.github/workflows/build-*` and
`.github/workflows/e2e-*` for the wiring.

## Google OAuth setup

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create a project and enable the _Google Identity Services_ APIs.
2. Create three OAuth 2.0 Client IDs:
   - **iOS** — bundle ID matching `$APP_BUNDLE_IDENTIFIER`.
   - **Android** — package matching `$APP_ANDROID_PACKAGE` + the SHA-1
     fingerprint of your debug and release keystores.
   - **Web** — no redirect URIs required; this client ID is used as the
     audience the backend verifies.
3. Put all three client IDs into the `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`
   env vars above. Put the iOS client's reversed-client-id URL scheme
   into `GOOGLE_IOS_URL_SCHEME`.
4. On the backend, set `GOOGLE_ALLOWED_AUDIENCES` to a comma-separated list
   of the same three client IDs.
5. The app uses the custom URL scheme `dearbaby://` (configured in
   `app.json`) as the OAuth redirect.

## Layout

```
app/                       # expo-router routes
  _layout.tsx              # Root Stack + AuthProvider + AuthGate
  index.tsx                # Landing (unauthenticated) — keeps testIDs `root`
                           # and `health-error-toast` for Maestro; auto-fires
                           # GET /health on mount and shows the toast when
                           # the backend is unreachable. Also hosts the
                           # Google + Apple sign-in buttons.
  (tabs)/
    _layout.tsx            # Bottom tabs: Home, Records, Settings
    index.tsx              # Home skeleton
    records.tsx            # Records skeleton
    settings.tsx           # Settings + Sign out
src/
  analytics/
    client.ts              # singleton PostHog client (session replay enabled)
    AnalyticsProvider.tsx  # PostHog provider, no-op when key is unset
    useAnalyticsIdentity.ts # syncs PostHog distinctId with auth state
  api/
    client.ts              # fetch wrapper with Bearer injection + 401 refresh
    auth.ts                # exchangeGoogleIdToken, me, logout
    types.ts               # User, Session types
  auth/
    AuthContext.tsx        # AuthProvider + useAuth hook
    tokens.ts              # SecureStore wrappers
  config/
    env.ts                 # typed access to EXPO_PUBLIC_* env vars
```

## Analytics & session replay

PostHog is initialized once at module load (`src/analytics/client.ts`) and
exposed to the React tree via `AnalyticsProvider`. When
`EXPO_PUBLIC_POSTHOG_KEY` is empty the provider becomes a pass-through, so
local builds without analytics credentials behave normally.

Session replay is **on** with conservative privacy defaults:

- `maskAllTextInputs: true` — pregnancy notes never leave the device
  unredacted.
- `maskAllImages: true` — same reasoning for any image we render.
- `captureNetworkTelemetry: true` — backend calls show up in the replay
  timeline so you can correlate UI moments with API behavior.

The app also forwards two correlation headers on every authenticated
request (`apiFetch` + the SSE stream): `X-PostHog-Session-Id` and
`X-PostHog-Distinct-Id`. The backend's `httpx.Logger` middleware records
both as `ph_session_id` / `ph_distinct_id` slog attributes, which lets
you jump from a backend log line straight into the matching PostHog
session replay.

## E2E (Maestro)

`npx expo prebuild --platform ios --clean` followed by
`maestro test .maestro/health.yaml` against a simulator with the backend
running on `localhost:8080`. This is what the CI workflows do.
