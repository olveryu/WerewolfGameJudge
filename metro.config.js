// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
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
//
// @shopify/react-native-skia modules reference the `SkiaViewApi` global at
// module scope. inlineRequires reorders evaluation so SkiaViewApi is accessed
// before LoadSkiaWeb() initialises it on web.
//
// Metro's blockList accepts {[filePath]: true} — there is no package-level
// exclusion API. nonInlinedRequires only matches top-level specifiers (e.g.
// 'react'), not relative requires between Skia's internal files. And
// getDependenciesOf resolves the FULL transitive dep graph (react, RN, etc.)
// causing OOM. So we enumerate Skia's own files with readdirSync.
// See: https://github.com/Shopify/react-native-skia/issues/2914
const skiaDir = path.resolve(__dirname, 'node_modules/@shopify/react-native-skia');
const skiaBlockList = {};
try {
  for (const entry of fs.readdirSync(skiaDir, { recursive: true })) {
    skiaBlockList[path.resolve(skiaDir, entry)] = true;
  }
} catch {
  // Package not installed — no paths to exclude
}

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: true,
      inlineRequires:
        Object.keys(skiaBlockList).length > 0
          ? { blockList: skiaBlockList }
          : true,
    },
  }),
};

module.exports = config;
