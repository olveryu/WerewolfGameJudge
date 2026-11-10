import path from 'node:path';

import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vitest/config';

import { bootSplash } from './build-plugins/bootSplash';

const sourceDirectory = path.resolve(import.meta.dirname, 'src');
const engineSourceDirectory = path.resolve(import.meta.dirname, '../game-engine/src');

/**
 * Asset base URL. CI sets the versioned npmmirror CDN address for deploy builds
 * (docs/web-client-rewrite.md §5.10); local, preview and E2E builds serve from the site root.
 */
const assetBase = process.env.WEB_ASSET_BASE ?? '/';

export default defineConfig({
  base: assetBase,
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Ionicons from @iconify-json/ion, inlined as SVG components; only imported icons ship (D2).
    Icons({ compiler: 'jsx', jsx: 'react' }),
    bootSplash(),
  ],
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${sourceDirectory}/` },
      // The engine is compiled from source so the bundler can tree-shake it; its package
      // `exports` point at the CommonJS dist build.
      { find: /^@game-judge\/game-engine\//, replacement: `${engineSourceDirectory}/` },
    ],
  },
  build: {
    // ES module-capable WebViews (the Vite 5 "modules" target). The final floor comes from the
    // load_timing user-agent distribution measured in P0.
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    sourcemap: 'hidden',
    // scripts/check-bundle-size.mjs reads the manifest to compute each route's load closure.
    manifest: true,
  },
  experimental: {
    // Public files (manifest.json, PWA icons) are not published to the CDN; they stay
    // same-origin on Pages, which also keeps share-image canvases untainted.
    renderBuiltUrl(filename, { type }) {
      return type === 'public' ? `/${filename}` : undefined;
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
