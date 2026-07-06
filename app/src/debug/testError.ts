// TEMPORARY — PostHog error-tracking / Hermes source-map verification helper.
//
// Remove this file (and the debug block in app/(tabs)/settings.tsx) once
// symbolication is confirmed on a release build.
//
// Each entry point throws from the SAME distinctive, multi-frame call stack
// (throwCanary → middleFrame → <entry point>) so that after PostHog
// symbolicates the Hermes trace you can confirm the frames resolved back to
// THIS file, with these function names and line numbers. If the source-map
// upload or debug-id matching is broken, PostHog will instead show minified
// frames like `t@index.android.bundle:1:428913` — that's the failure signal.
//
// NOTE: symbolication only works on the release builds that set
// POSTHOG_UPLOAD_SOURCEMAPS=1 (build-android-play.yml / build-ios-testflight.yml).
// In a local/dev/Expo-Go build the map is never uploaded and the bundle has no
// matching debug id, so the trace stays minified even when everything is wired
// correctly. Test on a TestFlight / Play internal build, not on Metro.

export class SourceMapCanaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceMapCanaryError';
  }
}

// Deepest frame. This exact line is what symbolication should surface as the
// top of the stack.
function throwCanary(kind: string): never {
  throw new SourceMapCanaryError(
    `PostHog ${kind} canary @ ${new Date().toISOString()}`,
  );
}

// Intermediate frame — gives the symbolicated trace more than one row to
// verify, so you can tell a fully-mapped stack from a partially-mapped one.
function middleFrame(kind: string): never {
  throwCanary(kind);
}

// 1) Uncaught exception → PostHog `autocapture.uncaughtExceptions`.
// Re-thrown from a timer so it escapes React's synthetic-event try/catch and
// reaches the global ErrorUtils handler that PostHog installs.
export function triggerUncaughtException(): void {
  setTimeout(() => {
    middleFrame('uncaught');
  }, 0);
}

// 2) Unhandled promise rejection → PostHog `autocapture.unhandledRejections`.
// Deliberately not awaited and with no .catch().
export function triggerUnhandledRejection(): void {
  void Promise.resolve().then(() => {
    middleFrame('unhandledrejection');
  });
}

// 3) console.error → PostHog `autocapture.console: ['error', 'warn']`.
export function triggerConsoleError(): void {
  try {
    middleFrame('console');
  } catch (e) {
    console.error('PostHog console.error canary', e);
  }
}
