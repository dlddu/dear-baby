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

// TEST_AUTH_ENABLED mirrors the backend's TEST_AUTH_ENABLED flag and gates
// the E2E-only test login button on the landing screen. It must only be set
// in CI / local development — production builds leave it unset, which
// removes the button from the bundle via a boolean guard.
export const TEST_AUTH_ENABLED: boolean =
  process.env.EXPO_PUBLIC_TEST_AUTH_ENABLED === 'true' ||
  process.env.EXPO_PUBLIC_TEST_AUTH_ENABLED === '1';
