import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { once } from 'node:events';

import { verifyCdnArtifacts } from './verify-cdn-artifacts.mjs';

test('checks actual JS and decompressed WASM; rejects stale and missing payloads', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cdn-verification-'));
  try {
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'assets/index.js'), 'release-js');
    const wasmFile = path.join(directory, 'canvaskit.wasm');
    await writeFile(wasmFile, 'release-wasm');
    const options = { directory, wasmFile, cdnBase: 'https://cdn.example/release' };
    const request = async (url) =>
      new Response(url.endsWith('.gz') ? gzipSync('release-wasm') : 'release-js');
    assert.equal(await verifyCdnArtifacts({ ...options, request }), 2);
    const server = createServer((incoming, response) =>
      response.end(incoming.url.endsWith('.gz') ? gzipSync('release-wasm') : 'release-js'),
    );
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      assert.equal(
        await verifyCdnArtifacts({
          ...options,
          cdnBase: `http://127.0.0.1:${server.address().port}`,
        }),
        2,
      );
    } finally {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await assert.rejects(
      verifyCdnArtifacts({ ...options, request: async () => new Response('old') }),
      /digest mismatch|incorrect header/,
    );
    await assert.rejects(
      verifyCdnArtifacts({ ...options, request: async () => new Response('', { status: 404 }) }),
      /HTTP 404/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
