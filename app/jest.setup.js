// Per-suite setup is handled in each *.test.ts via jest.doMock so we
// can vary mocks between cases. This file only carries cross-suite
// hygiene that has to happen before jest-expo's preset boots.

// expo-modules-core's web shim references __ExpoImportMetaRegistry which
// is only present once the app has loaded its expo-router entry. Stubbing
// it here keeps node-environment tests from crashing on import.
if (typeof globalThis.__ExpoImportMetaRegistry === 'undefined') {
  globalThis.__ExpoImportMetaRegistry = {};
}
