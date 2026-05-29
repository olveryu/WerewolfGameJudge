import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Polyfill crypto.randomUUID for iOS < 15.4 (Safari < 15.4).
// crypto.getRandomValues is available from iOS 11+.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version 4 (0100) and variant 1 (10xx)
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

// Polyfill Array.prototype.at for iOS < 15.4 (Safari < 15.4).
if (typeof Array.prototype.at !== 'function') {
  Array.prototype.at = function at<T>(this: T[], index: number): T | undefined {
    const i = index >= 0 ? index : this.length + index;
    return this[i];
  };
}

/**
 * Entry-point with eager Skia loading on web.
 *
 * Official pattern: LoadSkiaWeb() sets global.CanvasKit + SkiaViewApi
 * before any module is imported. This guarantees module-level Skia.*()
 * calls (Skia.Paint(), Skia.Color(), etc.) in effect files are safe.
 *
 * Native: Skia uses native bindings — no async init needed.
 *
 * @see https://shopify.github.io/react-native-skia/docs/getting-started/web
 */
async function main() {
  // Force `expo` module evaluation before any dynamic import().
  // Metro's `inlineRequires` defers the `require('expo')` until the symbol
  // is first referenced, but `expo` side-effects register `__loadBundleAsync`
  // which dynamic import() relies on.
  const register = registerRootComponent;

  if (Platform.OS === 'web') {
    performance.mark('boot:start');

    // WeChat browser (non-mini-program) sets this flag in showWechatGuide()
    // before JS finishes — skip React mount entirely.
    if ((globalThis as Record<string, unknown>).__SKIP_APP) return;

    // Load Skia WASM before importing App so that all module-level
    // Skia.*() calls execute after SkiaViewApi is available.
    //
    // npmmirror CDN (Aliyun OSS) does not compress application/wasm, so we
    // ship a pre-gzipped .wasm.gz in the npm package and decompress it on
    // the client via DecompressionStream. This cuts 8 MB → ~3.2 MB over
    // China CDN nodes.
    // CI rewrites this placeholder to the versioned npmmirror CDN URL.
    // Local dev falls back to the uncompressed canvaskit-wasm from node_modules.
    const wasmGzUrl = '__CANVASKIT_WASM_GZ_URL__';
    const useCompressedWasm = !wasmGzUrl.startsWith('__');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { version } = require('canvaskit-wasm/package.json') as { version: string };

    const { LoadSkiaWeb } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@shopify/react-native-skia/lib/module/web') as typeof import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) =>
        useCompressedWasm
          ? `https://cdn.npmmirror.com/packages/canvaskit-wasm/${version}/files/bin/full/${file}`
          : `https://unpkg.com/canvaskit-wasm@${version}/bin/full/${file}`,
      ...(useCompressedWasm && {
        instantiateWasm(
          importObject: WebAssembly.Imports,
          receiveInstance: (instance: WebAssembly.Instance) => void,
        ) {
          void (async () => {
            const resp = await fetch(wasmGzUrl);
            const total = Number(resp.headers.get('Content-Length')) || 0;
            const ds = new DecompressionStream('gzip');

            // Read compressed stream with progress reporting
            const reader = resp.body!.getReader();
            let loaded = 0;
            const compressedStream = new ReadableStream({
              async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  return;
                }
                loaded += value.byteLength;
                window.dispatchEvent(
                  new CustomEvent('wasm-progress', { detail: { loaded, total } }),
                );
                controller.enqueue(value);
              },
            });

            const decompressed = compressedStream.pipeThrough(ds);
            const bytes = await new Response(decompressed).arrayBuffer();
            const { instance } = await WebAssembly.instantiate(bytes, importObject);
            receiveInstance(instance);
          })();
          return {}; // Emscripten expects synchronous {} return
        },
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@shopify/react-native-skia/lib/module/specs/NativeSkiaModule');
  }

  performance.mark('app:import-start');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const App = (require('./App') as { default: React.ComponentType }).default;
  performance.mark('app:import-end');

  register(App);
  performance.mark('app:registered');
}

void main();
