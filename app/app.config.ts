import type { ExpoConfig, ConfigContext } from "expo/config";

// Extends the static config in `app.json` with dynamic fields that have to
// be resolved at prebuild time — currently just `ios.buildNumber`, which
// must be monotonically increasing across TestFlight uploads. CI computes
// the next number from App Store Connect (latest TestFlight build + 1)
// and exports it as `IOS_BUILD_NUMBER` before this prebuild runs;
// `GITHUB_RUN_NUMBER` is kept as a fallback for legacy local invocations
// only.
//
// Static iOS values (appleTeamId, usesAppleSignIn, etc.) live in app.json
// so the Fastfile can parse them too — keep this file for things that
// truly depend on the build environment.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // `config.name` / `config.slug` are guaranteed by app.json, but
  // ExpoConfig requires them to be non-optional, so re-assert.
  name: config.name ?? "dear-baby",
  slug: config.slug ?? "dear-baby",
  ios: {
    ...config.ios,
    buildNumber:
      process.env.IOS_BUILD_NUMBER ?? process.env.GITHUB_RUN_NUMBER ?? "1",
  },
});
