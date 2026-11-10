import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';

import { verifyCdnArtifacts } from './verify-cdn-artifacts.mjs';

test('checks actual JS; rejects stale and missing payloads', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cdn-verification-'));
  try {
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'assets/index.js'), 'release-js');
    const options = { directory, cdnBase: 'https://cdn.example/release' };
    const request = async () => new Response('release-js');
    assert.equal(await verifyCdnArtifacts({ ...options, request }), 1);
    const server = createServer((_incoming, response) => response.end('release-js'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      assert.equal(
        await verifyCdnArtifacts({
          ...options,
          cdnBase: `http://127.0.0.1:${server.address().port}`,
        }),
        1,
      );
    } finally {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await assert.rejects(
      verifyCdnArtifacts({ ...options, request: async () => new Response('old') }),
      /digest mismatch/,
    );
    await assert.rejects(
      verifyCdnArtifacts({ ...options, request: async () => new Response('', { status: 404 }) }),
      /HTTP 404/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
