/** Verify the immutable CDN payload before publishing HTML that references it. */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(filename) : [filename];
    }),
  );
  return nested.flat();
}

/** Fail on missing, stale, or corrupt assets within one bounded wall-clock budget. */
export async function verifyCdnArtifacts({
  directory,
  cdnBase,
  wasmFile,
  request = fetch,
  timeoutMs = 120_000,
}) {
  const signal = AbortSignal.timeout(timeoutMs);
  const files = await listFiles(path.join(directory, 'assets'));
  if (!files.some((filename) => filename.endsWith('.js')))
    throw new Error('Release contains no JavaScript assets');
  const assets = files.map((filename) => ({
    filename,
    key: path.relative(directory, filename).split(path.sep).join('/'),
  }));
  assets.push({ filename: wasmFile, key: 'wasm/canvaskit.wasm.gz' });
  let nextIndex = 0;
  const digest = (data) => createHash('sha256').update(data).digest('hex');
  await Promise.all(
    Array.from({ length: Math.min(8, assets.length) }, async () => {
      while (nextIndex < assets.length) {
        const asset = assets[nextIndex++];
        signal.throwIfAborted();
        const response = await request(`${cdnBase}/${asset.key}`, { signal });
        if (!response.ok) throw new Error(`${asset.key}: HTTP ${response.status}`);
        let actual = Buffer.from(await response.arrayBuffer());
        if (asset.key.endsWith('.wasm.gz')) actual = gunzipSync(actual);
        const expected = await readFile(asset.filename);
        if (digest(actual) !== digest(expected))
          throw new Error(`${asset.key}: content digest mismatch`);
      }
    }),
  );
  return assets.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const cdnBase = process.argv[2];
  if (!cdnBase || !URL.canParse(cdnBase)) throw new Error('Expected an absolute CDN base URL');
  const count = await verifyCdnArtifacts({
    directory: 'dist',
    cdnBase,
    wasmFile: 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
  });
  console.log(`Verified ${count} CDN artifacts against the local release payload`);
}
