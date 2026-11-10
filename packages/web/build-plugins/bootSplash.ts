import path from 'node:path';
import { gzipSync } from 'node:zlib';

import type { IndexHtmlTransformContext, Plugin } from 'vite';

type OutputBundle = NonNullable<IndexHtmlTransformContext['bundle']>;
type OutputChunk = NonNullable<IndexHtmlTransformContext['chunk']>;

const packageDirectory = path.resolve(import.meta.dirname, '..');
const BOOT_SPLASH_SOURCE = 'src/boot/bootSplash.ts';
const BOOT_SPLASH_ENTRY = 'bootSplash';

function requireOutput(bundle: OutputBundle, fileName: string): OutputBundle[string] {
  const output = bundle[fileName];
  if (output === undefined) throw new Error(`Boot splash: ${fileName} is not in the bundle`);
  return output;
}

/** The files the HTML entry loads before the app starts: its chunk, static imports and their CSS. */
function collectStartupFiles(
  chunk: OutputChunk,
  bundle: OutputBundle,
  files = new Set<string>(),
): Set<string> {
  if (files.has(chunk.fileName)) return files;
  files.add(chunk.fileName);
  for (const cssFile of chunk.viteMetadata?.importedCss ?? []) files.add(cssFile);
  for (const importedFile of chunk.imports) {
    const imported = requireOutput(bundle, importedFile);
    if (imported.type !== 'chunk') throw new Error(`Boot splash: ${importedFile} is not a chunk`);
    collectStartupFiles(imported, bundle, files);
  }
  return files;
}

function gzipBytes(output: OutputBundle[string]): number {
  return gzipSync(output.type === 'chunk' ? output.code : output.source).length;
}

/**
 * Builds src/boot/bootSplash.ts as its own entry and loads it ahead of the app entry, together
 * with the start-up files and their gzip sizes that the splash weighs its progress by. A module
 * script listed in index.html would be bundled into the app entry and run only after it loads.
 */
export function bootSplash(): Plugin {
  let base = '/';
  return {
    name: 'boot-splash',
    config: () => ({
      build: {
        rolldownOptions: {
          input: {
            index: path.resolve(packageDirectory, 'index.html'),
            [BOOT_SPLASH_ENTRY]: path.resolve(packageDirectory, BOOT_SPLASH_SOURCE),
          },
        },
      },
    }),
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle, chunk }) {
        if (bundle === undefined || chunk === undefined) {
          return [
            {
              tag: 'script',
              attrs: { type: 'module', src: `${base}${BOOT_SPLASH_SOURCE}` },
              injectTo: 'head-prepend',
            },
          ];
        }
        const bootChunk = Object.values(bundle).find(
          (output) =>
            output.type === 'chunk' && output.isEntry && output.name === BOOT_SPLASH_ENTRY,
        );
        if (bootChunk === undefined) throw new Error('Boot splash: entry chunk missing');
        const assets = [...collectStartupFiles(chunk, bundle)].map((fileName) => ({
          url: `${base}${fileName}`,
          bytes: gzipBytes(requireOutput(bundle, fileName)),
        }));
        return [
          {
            tag: 'script',
            attrs: { type: 'application/json', id: 'boot-assets' },
            children: JSON.stringify(assets),
            injectTo: 'head-prepend',
          },
          {
            tag: 'script',
            attrs: { type: 'module', crossorigin: true, src: `${base}${bootChunk.fileName}` },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}
