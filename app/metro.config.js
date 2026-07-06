// Metro config. By default this is the stock Expo config, unchanged.
//
// Only release/deploy builds opt into PostHog source-map upload: the
// build-android-play.yml / build-ios-testflight.yml workflows set
// POSTHOG_UPLOAD_SOURCEMAPS=1, install posthog-cli, and provide the
// POSTHOG_CLI_* credentials. For those builds we swap in PostHog's serializer
// (getPostHogExpoConfig, which wraps expo/metro-config's getDefaultConfig) so
// the bundle carries a stable debug ID. PostHog matches that debug ID against
// the map uploaded during the native build to symbolicate Hermes stack
// traces; without it the shipped bundle and the map can't be matched.
//
// Every other build (E2E, local, dev) uses the stock config and never touches
// posthog-cli, so their native build has no dependency on it. This flag must
// stay in lockstep with the posthog-react-native/expo plugin in app.config.ts
// — both activate together or not at all.
const { getDefaultConfig } = require('expo/metro-config');

module.exports =
  process.env.POSTHOG_UPLOAD_SOURCEMAPS === '1'
    ? require('posthog-react-native/metro').getPostHogExpoConfig(__dirname)
    : getDefaultConfig(__dirname);
