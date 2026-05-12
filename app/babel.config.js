// Babel config — Expo Metro picks up babel-preset-expo automatically at
// runtime, but Jest needs an explicit config so babel-jest can transform
// our TypeScript / JSX in tests.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
