import type { ExpoConfig, ConfigContext } from "expo/config";

// Extends the static config in `app.json` with dynamic fields that have to
// be resolved at prebuild time — notably `ios.buildNumber`, which must be
// monotonically increasing across TestFlight uploads. In CI we bake the
// workflow run number directly into `Info.plist` via `expo prebuild`; the
// previous setup relied on an Xcode macro (`$(CURRENT_PROJECT_VERSION)`)
// that was hand-edited into the committed Info.plist, which doesn't survive
// when we regenerate the iOS project from scratch.
//
// The Apple Sign-In entitlement is also resolved here so the E2E CI job can
// opt out. `expo-apple-authentication`'s config plugin unconditionally adds
// `com.apple.developer.applesignin` to the entitlements file whenever it
// runs — and once any capability-bearing entitlement is present, Xcode
// requires a valid code-signing identity, which the macOS runner does not
// have. The escape hatch removes the plugin from the `plugins` array (so it
// never runs) AND clears `ios.usesAppleSignIn` (so Expo's legacy fallback
// stays quiet). The native module remains autolinked either way, so JS
// imports like `AppleAuthentication.isAvailableAsync()` still resolve at
// runtime — only the entitlement is absent. Production (TestFlight) builds
// leave `EXPO_USES_APPLE_SIGNIN` unset and keep the entitlement intact.
export default ({ config }: ConfigContext): ExpoConfig => {
  const usesAppleSignIn =
    process.env.EXPO_USES_APPLE_SIGNIN !== "0" &&
    process.env.EXPO_USES_APPLE_SIGNIN !== "false";

  const plugins = (config.plugins ?? []).filter((entry) => {
    if (usesAppleSignIn) return true;
    const name = typeof entry === "string" ? entry : entry?.[0];
    return name !== "expo-apple-authentication";
  });

  return {
    ...config,
    // `config.name` / `config.slug` are guaranteed by app.json, but
    // ExpoConfig requires them to be non-optional, so re-assert.
    name: config.name ?? "dear-baby",
    slug: config.slug ?? "dear-baby",
    plugins,
    ios: {
      ...config.ios,
      buildNumber: process.env.GITHUB_RUN_NUMBER ?? "1",
      usesAppleSignIn,
    },
  };
};
