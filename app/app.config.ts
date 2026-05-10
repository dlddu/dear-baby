import type { ExpoConfig, ConfigContext } from "expo/config";

// Extends the static config in `app.json` with dynamic fields that have to
// be resolved at prebuild time — `ios.buildNumber` and `android.versionCode`,
// which must be monotonically increasing across TestFlight / Play Store
// uploads respectively. CI computes the next number (latest store build + 1)
// and exports it as `IOS_BUILD_NUMBER` / `ANDROID_VERSION_CODE` before this
// prebuild runs; `GITHUB_RUN_NUMBER` is kept as a fallback for legacy local
// invocations only.
//
// Static iOS / Android values (appleTeamId, package, etc.) live in app.json
// so the Fastfile can parse them too — keep this file for things that
// truly depend on the build environment.
const parseVersionCode = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

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
  android: {
    ...config.android,
    versionCode: parseVersionCode(
      process.env.ANDROID_VERSION_CODE ?? process.env.GITHUB_RUN_NUMBER,
    ),
  },
});
