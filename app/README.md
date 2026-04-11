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

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL. Defaults to `http://localhost:8080`. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | iOS OAuth client ID from Google Cloud Console. |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android OAuth client ID. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web OAuth client ID — this is the audience the backend verifies the ID token against. |

## Google OAuth setup

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create a project and enable the _Google Identity Services_ APIs.
2. Create three OAuth 2.0 Client IDs:
   - **iOS** — bundle ID `com.dlddu.dearbaby`.
   - **Android** — package `com.dlddu.dearbaby` + the SHA-1 fingerprint of
     your debug and release keystores.
   - **Web** — no redirect URIs required; this client ID is used as the
     audience the backend verifies.
3. Put all three client IDs into the `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`
   env vars above.
4. On the backend, set `GOOGLE_ALLOWED_AUDIENCES` to a comma-separated list
   of the same three client IDs.
5. The app uses the custom URL scheme `dearbaby://` (configured in
   `app.json`) as the OAuth redirect.

## Layout

```
app/                       # expo-router routes
  _layout.tsx              # Root Stack + AuthProvider + AuthGate
  index.tsx                # Landing (unauthenticated) — keeps testIDs `root`,
                           # `check-health-button`, `health-status` for
                           # Maestro; also hosts "Sign in with Google".
  (tabs)/
    _layout.tsx            # Bottom tabs: Home, Records, Settings
    index.tsx              # Home skeleton
    records.tsx            # Records skeleton
    settings.tsx           # Settings + Sign out
src/
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

## E2E (Maestro)

`npx expo prebuild --platform ios --clean` followed by
`maestro test .maestro/health.yaml` against a simulator with the backend
running on `localhost:8080`. This is what the CI workflows do.
