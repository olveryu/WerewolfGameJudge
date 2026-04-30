import './src/wdyr';

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LoadSkiaWeb } =
      require('@shopify/react-native-skia/lib/module/web') as typeof import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) =>
        `https://cdn.npmmirror.com/packages/canvaskit-wasm/${version}/files/bin/full/${file}`,
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
