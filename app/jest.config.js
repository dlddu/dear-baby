// Jest config for the Expo app. We use jest-expo's preset because it
// already wires up the React Native transformIgnorePatterns and the
// native-module mocks we need for expo-* deps. The tests in this repo
// are scoped to src/voice/* — pure-logic units that mock the native
// modules (whisper.rn, expo-audio, expo-file-system) at the require
// boundary, so Metro / native runtimes never have to come up.

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // jest-expo's default transformIgnorePatterns leaves whisper.rn outside
  // the transform, which is fine — we mock it. Same for expo-audio.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Surface real assertion failures instead of bailing on the first
  // unrelated console warning from jest-expo's native shims.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // We don't render any React tree yet; tests are pure-logic.
  testEnvironment: 'node',
};
