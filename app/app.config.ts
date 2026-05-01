import type { ExpoConfig, ConfigContext } from "expo/config";

// Extends the static config in `app.json` with dynamic fields that have to
// be resolved at prebuild time — currently just `ios.buildNumber`, which
// must be monotonically increasing across TestFlight uploads. In CI we
// bake the workflow run number directly into `Info.plist` via `expo
// prebuild`; the previous setup relied on an Xcode macro
// (`$(CURRENT_PROJECT_VERSION)`) that was hand-edited into the committed
// Info.plist, which doesn't survive when we regenerate the iOS project
// from scratch.
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
    buildNumber: process.env.GITHUB_RUN_NUMBER ?? "1",
  },
});
