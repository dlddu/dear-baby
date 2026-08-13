// Typed access to EXPO_PUBLIC_* environment variables. Only values prefixed
// with EXPO_PUBLIC_ are inlined into the JS bundle at build time — do not
// read anything else from process.env here.

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

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
//
// mock-exception: MB-1 — Maestro 는 디바이스 마이크를 구동할 수 없고, 온디바이스
// whisper 추론은 매 CI 실행마다 모델 다운로드를 요구하며 산출도 비결정적이다.
export const E2E_AUDIO_FIXTURE: boolean =
  process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === 'true' ||
  process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === '1';

// E2E_FAST_TESTER_LOGIN exposes a one-press shortcut to the tester-login
// modal so the Maestro suite does not replay the 15-tap corner gesture
// before every functional flow (it costs 35-42s per flow on the CI
// simulators). It only changes how the modal is *reached* — the modal,
// POST /auth/password-login and the session write are untouched, and
// e2e/maestro/login.yaml still drives the real gesture so that path keeps
// its coverage.
//
// No credential ever rides on this flag: the password still comes from the
// tester typing it (or Maestro pasting it), exactly as before.
//
// Production builds must leave this unset. Only .github/workflows/e2e-*.yml
// injects it, and app/app/(landing)/__tests__/index.test.tsx locks the
// default-off behaviour.
//
// mock-exception: MB-2 — 외부 OAuth 공급자를 CI 에서 왕복할 수 없어 tester-login 이
// 그 자리를 대신하며, 이 플래그는 그 대체 경로의 *도달 방법* 만 줄인다(치환 없음).
export const E2E_FAST_TESTER_LOGIN: boolean =
  process.env.EXPO_PUBLIC_E2E_FAST_TESTER_LOGIN === 'true' ||
  process.env.EXPO_PUBLIC_E2E_FAST_TESTER_LOGIN === '1';
