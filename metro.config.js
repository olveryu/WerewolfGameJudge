// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Watch the packages/ directory so monorepo packages are resolved
config.watchFolders = [path.resolve(__dirname, 'packages')];

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
      inlineRequires: true,
    },
  }),
};

module.exports = config;
