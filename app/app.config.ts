import type { ExpoConfig, ConfigContext } from "expo/config";

// Extends the static config in `app.json` with dynamic fields resolved at
// prebuild time from the environment:
//
// - Build identifiers (Apple team id, iOS bundle id, Android package, the
//   Google iOS reversed-client-id URL scheme) live in `app/.env` and
//   `app/.env.local` rather than `app.json` so the same values can be
//   shared with Fastlane / Maestro / CI workflows without each tool
//   having to parse JSON. See `app/.env.example` for the full list.
// - `ios.buildNumber` and `android.versionCode` must be monotonically
//   increasing across TestFlight / Play Store uploads. CI computes the
//   next number (latest store build + 1) and exports it as
//   `IOS_BUILD_NUMBER` / `ANDROID_VERSION_CODE` before prebuild runs;
//   `GITHUB_RUN_NUMBER` is kept as a fallback for legacy local
//   invocations only.
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required env: ${key}. See app/.env.example for the full list of build identifiers.`,
    );
  }
  return value;
};

const parseVersionCode = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const bundleIdentifier = requireEnv("APP_BUNDLE_IDENTIFIER");
  const androidPackage = requireEnv("APP_ANDROID_PACKAGE");
  const appleTeamId = requireEnv("APPLE_TEAM_ID");
  const googleIosUrlScheme = requireEnv("GOOGLE_IOS_URL_SCHEME");

  const googleSigninPlugin = "@react-native-google-signin/google-signin";
  const plugins: NonNullable<ExpoConfig["plugins"]> = (
    config.plugins ?? []
  ).map(
    (plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      if (name !== googleSigninPlugin) return plugin;
      const existing = Array.isArray(plugin) ? plugin[1] ?? {} : {};
      return [
        googleSigninPlugin,
        { ...existing, iosUrlScheme: googleIosUrlScheme },
      ];
    },
  );

  // PostHog source-map upload runs a posthog-cli subprocess during the native
  // build (an injected Gradle step on Android, a rewritten "Bundle React
  // Native code and images" phase on iOS). Only wire it for the release
  // builds that install the CLI and provide POSTHOG_CLI_* credentials —
  // build-android-play.yml / build-ios-testflight.yml set
  // POSTHOG_UPLOAD_SOURCEMAPS=1. E2E and local builds leave it off so their
  // prebuild/native build has no dependency on posthog-cli. Keep this in sync
  // with the same flag gating the serializer in metro.config.js.
  if (process.env.POSTHOG_UPLOAD_SOURCEMAPS === "1") {
    plugins.push("posthog-react-native/expo");
  }

  return {
    ...config,
    name: config.name ?? "dear-baby",
    slug: config.slug ?? "dear-baby",
    ios: {
      ...config.ios,
      bundleIdentifier,
      appleTeamId,
      buildNumber:
        process.env.IOS_BUILD_NUMBER ?? process.env.GITHUB_RUN_NUMBER ?? "1",
    },
    android: {
      ...config.android,
      package: androidPackage,
      versionCode: parseVersionCode(
        process.env.ANDROID_VERSION_CODE ?? process.env.GITHUB_RUN_NUMBER,
      ),
    },
    plugins,
  };
};
