// Jest config for the Expo / React Native client. jest-expo handles the
// Babel + RN preset; we extend transformIgnorePatterns so common Expo/RN
// ESM packages get transformed.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js|jsx)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|react-native-[^/]+|@react-native(-community)?|expo(nent)?|expo-[^/]+|@expo(nent)?(/.*)?|@expo-google-fonts/.*|posthog-react-native(-session-replay)?|@react-native-google-signin/.*)/)',
  ],
};
