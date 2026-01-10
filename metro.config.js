// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude legacy .env.e2e.local from Metro bundler (defensive)
// New E2E config is in env/*.json and loaded by scripts/run-e2e-web.mjs
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /\.env\.e2e\.local$/,
];

module.exports = config;
