// Typed access to EXPO_PUBLIC_* environment variables. Only values prefixed
// with EXPO_PUBLIC_ are inlined into the JS bundle at build time — do not
// read anything else from process.env here.

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// API_VERSION is the URL-path version segment the backend mounts product
// routes under. Health stays unversioned and uses API_URL directly.
// Bumping versions is a coordinated change: ship a backend that mounts
// /v2 alongside /v1, then flip this constant.
export const API_VERSION = 'v1';

// API_BASE_URL is the prefix for all versioned API calls. Use it (not
// API_URL) when building URLs for endpoints that live under /v{N}.
export const API_BASE_URL: string = `${API_URL}/${API_VERSION}`;

export const GOOGLE_IOS_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export const GOOGLE_ANDROID_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

export const GOOGLE_WEB_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

// PostHog product analytics. POSTHOG_KEY is the project API key from the
// PostHog dashboard; when unset the AnalyticsProvider degrades to a no-op,
// so local builds without analytics credentials continue to work.
export const POSTHOG_KEY: string =
  process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';

export const POSTHOG_HOST: string =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// E2E_AUDIO_FIXTURE swaps real audio recording + whisper STT for a
// deterministic fixture. Maestro can't drive the microphone, and the
// whisper model would have to be downloaded on every CI run, so the
// flag short-circuits both:
//   - the recorder returns a fixed fake file path immediately on stop
//   - the STT engine returns a canned Korean transcript without loading
//     any model
// Production builds must leave this unset.
export const E2E_AUDIO_FIXTURE: boolean =
  process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === 'true' ||
  process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === '1';
