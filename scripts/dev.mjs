import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';

import concurrently from 'concurrently';

const workerHost = '127.0.0.1';
const defaultWorkerPort = 8787;

function probePort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, workerHost, () => {
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

async function main() {
  const port = await findWorkerPort();
  const workerUrl = `http://${workerHost}:${port}`;
  if (port !== defaultWorkerPort) {
    process.stdout.write(`Worker port ${defaultWorkerPort} is occupied; using ${workerUrl}\n`);
  }

  const { result } = concurrently(
    [
      {
        name: 'worker',
        command: `pnpm --filter @game-judge/api-worker run dev --port ${port} --ip ${workerHost}`,
      },
      {
        name: 'web',
        command: 'pnpm --filter @game-judge/web run dev',
        env: { VITE_CF_API_URL: workerUrl },
      },
    ],
    { prefixColors: ['blue', 'green'], killOthersOn: ['success', 'failure'] },
  );
  await result.then(
    () => {},
    () => {
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
