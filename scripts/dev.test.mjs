import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { afterEach, expect, it } from 'vitest';

import { findWorkerPort } from './dev.mjs';

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

it('uses the preferred Worker port when available', async () => {
  const availablePort = await findWorkerPort(0);
  expect(await findWorkerPort(availablePort)).toBe(availablePort);
});

it('chooses a different port when the preferred Worker port is occupied', async () => {
  const server = createServer();
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const occupiedPort = server.address().port;
  const selectedPort = await findWorkerPort(occupiedPort);
  expect(selectedPort).toBeGreaterThan(0);
  expect(selectedPort).not.toBe(occupiedPort);
});

it('stops the web server and fails when the Worker exits', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dev-script-test-'));
  try {
    await writeFile(
      path.join(directory, 'pnpm'),
      `#!/bin/sh
case "$*" in
  *api-worker*) echo "WORKER_ARGS=$*"; sleep 1; exit 7 ;;
  *web*) echo "WEB_API=$VITE_CF_API_URL"; exec node -e 'setInterval(() => {}, 1000)' ;;
esac
`,
      { mode: 0o755 },
    );
    const run = promisify(execFile);
    const script = fileURLToPath(new URL('./dev.mjs', import.meta.url));
    const result = await run(process.execPath, [script], {
      env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}` },
      timeout: 10000,
    }).then(
      () => {
        throw new Error('Expected the development script to fail');
      },
      (error) => error,
    );

    expect(result.code).toBe(1);
    const workerPort = result.stdout.match(/WORKER_ARGS=.*--port (\d+)/)?.[1];
    expect(workerPort).toBeDefined();
    expect(result.stdout).toContain(`WEB_API=http://127.0.0.1:${workerPort}`);
    expect(result.stdout).toContain('Sending SIGTERM to other processes');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
