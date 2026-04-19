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

// @shopify/react-native-skia modules reference the `SkiaViewApi` global at
// module scope. `inlineRequires` defers require() calls, which can reorder
// evaluation so SkiaViewApi is referenced before LoadSkiaWeb() initialises it
// on web. We collect every file under the Skia package at config-load time
// and exclude them from inlining, preserving the original require order.
// See: https://github.com/Shopify/react-native-skia/issues/2914
function collectFilePaths(dir) {
  const result = {};
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        Object.assign(result, collectFilePaths(full));
      } else {
        result[full] = true;
      }
    }
  } catch {
    // Package not installed — no paths to exclude
  }
  return result;
}

const skiaBlockList = collectFilePaths(
  path.resolve(__dirname, 'node_modules/@shopify/react-native-skia'),
);

// experimentalImportSupport: required for EXPO_UNSTABLE_TREE_SHAKING (default
// since SDK 54, set explicitly for clarity).
// inlineRequires: defer module execution until first use → faster startup.
// blockList excludes Skia files from inlining (see above).
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: true,
      inlineRequires: { blockList: skiaBlockList },
    },
  }),
};

module.exports = config;
