import type { ExpoConfig, ConfigContext } from "expo/config";

// Extends the static config in `app.json` with dynamic fields that have to
// be resolved at prebuild time — notably `ios.buildNumber`, which must be
// monotonically increasing across TestFlight uploads. In CI we bake the
// workflow run number directly into `Info.plist` via `expo prebuild`; the
// previous setup relied on an Xcode macro (`$(CURRENT_PROJECT_VERSION)`)
// that was hand-edited into the committed Info.plist, which doesn't survive
// when we regenerate the iOS project from scratch.
//
// `usesAppleSignIn` is also resolved here so the E2E CI job can opt out of
// the Apple Sign-In entitlement. Without that escape hatch, `expo run:ios`
// against the simulator fails with "No code signing certificates are
// available" — Xcode requires a valid signing identity once any
// capabilities-bearing entitlement is present, and the CI macOS runner has
// no developer cert installed. Production (TestFlight) builds always get
// the entitlement; only CI flips this off.
export default ({ config }: ConfigContext): ExpoConfig => {
  const usesAppleSignIn =
    process.env.EXPO_USES_APPLE_SIGNIN !== "0" &&
    process.env.EXPO_USES_APPLE_SIGNIN !== "false";

  return {
    ...config,
    // `config.name` / `config.slug` are guaranteed by app.json, but
    // ExpoConfig requires them to be non-optional, so re-assert.
    name: config.name ?? "dear-baby",
    slug: config.slug ?? "dear-baby",
    ios: {
      ...config.ios,
      buildNumber: process.env.GITHUB_RUN_NUMBER ?? "1",
      usesAppleSignIn,
    },
  };
};
