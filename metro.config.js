// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Watch the packages/ directory so monorepo packages are resolved
config.watchFolders = [path.resolve(__dirname, 'packages')];

// Exclude legacy .env.e2e.local from Metro bundler (defensive)
// New E2E config is in env/*.json and loaded by scripts/run-e2e-web.mjs
config.resolver.blockList = [...(config.resolver.blockList || []), /\.env\.e2e\.local$/];

// Listen on all interfaces so mobile devices on LAN / Tailscale can access
config.server = { ...config.server, host: '0.0.0.0' };

// ---------------------------------------------------------------------------
// Bundle optimizations
// ---------------------------------------------------------------------------

// experimentalImportSupport: required for EXPO_UNSTABLE_TREE_SHAKING (default
// since SDK 54, set explicitly for clarity).
// inlineRequires: defer module execution until first use → faster startup.
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: true,
<<<<<<< Updated upstream
      inlineRequires: true,
=======
      inlineRequires: Object.keys(skiaBlockList).length > 0 ? { blockList: skiaBlockList } : true,
>>>>>>> Stashed changes
    },
  }),
};

module.exports = config;
