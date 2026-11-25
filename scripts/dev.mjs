#!/usr/bin/env node
/**
 * Start a matched local Worker/Vite pair without taking another worktree's ports.
 * Keep a stable local auth key and stop both servers when either exits.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const workerDir = join(root, 'packages/api-worker');

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

function canListen(port, host) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(false);
      else reject(error);
    });
    server.listen(port, host, () => {
      server.close((error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
  });
}

async function findAvailablePort(preferredPort) {
  for (let port = preferredPort; port <= 65535; port++) {
    // On macOS a wildcard probe can coexist with an occupied loopback socket.
    if ((await canListen(port, '127.0.0.1')) && (await canListen(port, '::1'))) return port;
  }
  throw new Error(`No available development port at or above ${preferredPort}.`);
}

try {
  ensureLocalAuthKey();
  const workerPort = await findAvailablePort(8787);
  const webPort = await findAvailablePort(5173);
  const inspectorPort = await findAvailablePort(9229);
  const apiUrl = `http://localhost:${workerPort}`;
  console.log(`Local development: web http://localhost:${webPort} -> Worker ${apiUrl}`);

  const { result } = concurrently(
    [
      {
        name: 'worker',
        command: `pnpm --filter @game-judge/api-worker run dev --port ${workerPort} --inspector-port ${inspectorPort}`,
      },
      {
        name: 'web',
        command: `pnpm --filter @game-judge/web run dev --port ${webPort} --strictPort`,
        env: { VITE_CF_API_URL: apiUrl },
      },
    ],
    {
      cwd: root,
      prefixColors: ['blue', 'green'],
      killOthersOn: ['success', 'failure'],
      successCondition: 'first',
    },
  );
  try {
    await result;
  } catch {
    console.error('Development servers stopped because a process failed. See its output above.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('Local development startup failed; servers were not started.', error);
  process.exitCode = 1;
}
