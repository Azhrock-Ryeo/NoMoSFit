const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Expo SDK 53 / Firebase JS SDK compatibility.
// RN 0.79 enables package.json exports by default, which can cause
// Firebase Auth to resolve incorrectly in React Native/Hermes.
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "cjs",
];

config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, {
  input: "./global.css",
});
