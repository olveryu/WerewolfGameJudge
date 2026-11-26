#!/usr/bin/env node
/**
 * Start a matched local Worker/Vite pair without taking another worktree's ports.
 * Keep a stable local auth key and stop both servers when either exits.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const workerDir = join(root, 'packages/api-worker');
const workerHost = '127.0.0.1';
const defaultWorkerPort = 8787;

function ensureLocalAuthKey() {
  const devVarsPath = join(workerDir, '.dev.vars');
  const hasDevVars = existsSync(devVarsPath);
  const files = hasDevVars ? ['.dev.vars'] : ['.env', '.env.local'];
  const fileValues = Object.assign(
    {},
    ...files.map((file) => {
      const filePath = join(workerDir, file);
      return existsSync(filePath) ? parseEnv(readFileSync(filePath, 'utf8')) : {};
    }),
  );
  // Wrangler ignores .env and process secrets when .dev.vars exists.
  const authKey = hasDevVars
    ? fileValues.JWT_SECRET
    : (process.env.JWT_SECRET ?? fileValues.JWT_SECRET);
  if (authKey !== undefined) {
    if (authKey.trim() === '') {
      throw new Error(
        'Local JWT_SECRET is empty. Set a non-empty value in the Worker environment.',
      );
    }
    return;
  }

  const file = hasDevVars ? '.dev.vars' : '.env.local';
  appendFileSync(
    join(workerDir, file),
    `\n# Generated for this worktree's local auth only; do not commit.\nJWT_SECRET=${randomBytes(32).toString('hex')}\n`,
    { mode: 0o600 },
  );
  console.log(`Created a persistent local auth key in packages/api-worker/${file}.`);
}

function probePort(port, host = workerHost) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else if (!address || typeof address === 'string')
          reject(new Error('Invalid server address'));
        else resolve(address.port);
      });
    });
  });
}

/** Find a local Worker port, preferring the usual port when available. */
export async function findWorkerPort(preferredPort = defaultWorkerPort) {
  try {
    return await probePort(preferredPort);
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    return probePort(0);
  }
}

async function findAvailablePort(preferredPort) {
  for (let port = preferredPort; port <= 65535; port++) {
    try {
      // On macOS a wildcard probe can coexist with an occupied loopback socket.
      await probePort(port, '127.0.0.1');
      await probePort(port, '::1');
      return port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`No available development port at or above ${preferredPort}.`);
}

async function main() {
  ensureLocalAuthKey();
  const port = await findWorkerPort();
  const webPort = await findAvailablePort(5173);
  const inspectorPort = await findAvailablePort(9229);
  const workerUrl = `http://${workerHost}:${port}`;
  if (port !== defaultWorkerPort) {
    process.stdout.write(`Worker port ${defaultWorkerPort} is occupied; using ${workerUrl}\n`);
  }
  console.log(`Local development: web http://localhost:${webPort} -> Worker ${workerUrl}`);

  const { result } = concurrently(
    [
      {
        name: 'worker',
        command: `pnpm --filter @game-judge/api-worker run dev --port ${port} --ip ${workerHost} --inspector-port ${inspectorPort}`,
      },
      {
        name: 'web',
        command: `pnpm --filter @game-judge/web run dev --port ${webPort} --strictPort`,
        env: { VITE_CF_API_URL: workerUrl },
      },
    ],
    { cwd: root, prefixColors: ['blue', 'green'], killOthersOn: ['success', 'failure'] },
  );
  await result.then(
    () => {},
    () => {
      console.error('Development servers stopped because a process failed. See its output above.');
      process.exitCode = 1;
    },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Unable to start development servers: ${error.message}\n`);
    process.exitCode = 1;
  });
}
