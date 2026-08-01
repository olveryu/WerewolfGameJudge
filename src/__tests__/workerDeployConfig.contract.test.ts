/** Locks API Worker CI deployment to the package-owned Wrangler configuration. */

import fs from 'node:fs';
import path from 'node:path';

interface WorkerDeployScripts {
  readonly deploy: string;
  readonly migrateRemote: string;
}

function readWorkerScripts(): WorkerDeployScripts {
  const packageJson: unknown = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'packages', 'api-worker', 'package.json'), 'utf-8'),
  );
  if (typeof packageJson !== 'object' || packageJson === null || Array.isArray(packageJson)) {
    throw new Error('api-worker package.json must contain an object');
  }
  if (
    !('scripts' in packageJson) ||
    typeof packageJson.scripts !== 'object' ||
    packageJson.scripts === null ||
    Array.isArray(packageJson.scripts)
  ) {
    throw new Error('api-worker package.json must define scripts');
  }
  const scripts = packageJson.scripts;
  if (!('deploy' in scripts) || typeof scripts.deploy !== 'string') {
    throw new Error('api-worker package.json must define a deploy script');
  }
  if (!('db:migrate:remote' in scripts) || typeof scripts['db:migrate:remote'] !== 'string') {
    throw new Error('api-worker package.json must define a db:migrate:remote script');
  }
  return { deploy: scripts.deploy, migrateRemote: scripts['db:migrate:remote'] };
}

describe('API Worker deployment config ownership', () => {
  it('binds remote migration and deploy scripts to the Worker config', () => {
    const scripts = readWorkerScripts();

    expect(scripts.migrateRemote).toContain('--config wrangler.toml');
    expect(scripts.deploy).toContain('--config wrangler.toml');
  });

  it('runs the package scripts with official Wrangler authentication variables', () => {
    const workflowSource = fs.readFileSync(
      path.join(process.cwd(), '.github', 'workflows', 'ci.yml'),
      'utf-8',
    );
    const workerJobStart = workflowSource.indexOf('  deploy-api-worker:');
    const frontendJobStart = workflowSource.indexOf('  deploy-frontend:');
    if (workerJobStart < 0 || frontendJobStart <= workerJobStart) {
      throw new Error('CI workflow must define deploy-api-worker before deploy-frontend');
    }
    const workerJob = workflowSource.slice(workerJobStart, frontendJobStart);

    expect(workerJob).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(workerJob).toContain('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
    expect(workerJob).toContain('run: pnpm --filter @game-judge/api-worker run db:migrate:remote');
    expect(workerJob).toContain('run: pnpm --filter @game-judge/api-worker run deploy');
    expect(workerJob).not.toContain('cloudflare/wrangler-action');
  });
});
