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

// Without the Android client ID the Google sign-in button silently
// vanishes on Android (see app/index.tsx — `hasGoogleConfig` gates the
// button on a per-platform ID). Fail the EAS Android build here rather
// than ship an APK whose only login affordance is missing. iOS builds
// and local `expo start` are unaffected — EAS_BUILD_PLATFORM is only
// set in EAS build workers.
if (
  process.env.EAS_BUILD_PLATFORM === "android" &&
  !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
) {
  throw new Error(
    "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is not set. Set it in the EAS " +
      "build environment before building for Android.",
  );
}

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
