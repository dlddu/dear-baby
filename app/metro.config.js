// Wraps Expo's default Metro config with PostHog's serializer so every JS
// bundle gets a stable debug ID (Expo 50+ built-in debug-id injection).
//
// Why this is required for error tracking: PostHog symbolicates a Hermes
// stack trace by matching the bundle's debug ID against an uploaded source
// map. The upload itself runs during the native build (the Gradle plugin /
// Xcode build phase that the `posthog-react-native/expo` config plugin adds
// at prebuild time). Without the debug ID injected here, the shipped bundle
// and the uploaded map can't be matched and stack traces stay minified —
// so this file and the config plugin have to ship together.
//
// getPostHogExpoConfig internally calls expo/metro-config's getDefaultConfig,
// so all Expo defaults are preserved.
const { getPostHogExpoConfig } = require('posthog-react-native/metro');

const config = getPostHogExpoConfig(__dirname);

module.exports = config;
