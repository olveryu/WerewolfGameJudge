/** CI E2E coverage contract for the explicit Playwright shard matrix. */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(__dirname, '../..');
const E2E_SPEC_DIR = path.join(ROOT_DIR, 'e2e/specs');
const CI_WORKFLOW_PATH = path.join(ROOT_DIR, '.github/workflows/ci.yml');

function getConfiguredE2eSpecs(): string[] {
  const workflow = fs.readFileSync(CI_WORKFLOW_PATH, 'utf8');
  const e2eJobStart = workflow.indexOf('\n  e2e:\n');
  const mergeReportsStart = workflow.indexOf('\n  merge-reports:\n');
  if (e2eJobStart < 0 || mergeReportsStart <= e2eJobStart) {
    throw new Error('CI workflow must contain e2e and merge-reports jobs in order');
  }
  return (
    workflow.slice(e2eJobStart, mergeReportsStart).match(/[a-z0-9][a-z0-9-]*\.spec\.ts/g) ?? []
  );
}

describe('CI Playwright shard coverage', () => {
  it('verifies CDN bytes before Pages deployment without waiting for the full E2E matrix', () => {
    execFileSync(process.execPath, ['--test', 'scripts/verify-cdn-artifacts.test.mjs'], {
      cwd: ROOT_DIR,
    });
    const workflow = fs.readFileSync(CI_WORKFLOW_PATH, 'utf8');
    const frontend = workflow.slice(
      workflow.indexOf('\n  deploy-frontend:'),
      workflow.indexOf('\n  deploy-miniapp:'),
    );
    expect(frontend).toContain('needs: [quality, deploy-api-worker]');
    expect(frontend.indexOf('node scripts/verify-cdn-artifacts.mjs')).toBeGreaterThan(0);
    expect(frontend.indexOf('node scripts/verify-cdn-artifacts.mjs')).toBeLessThan(
      frontend.indexOf('name: Deploy to Cloudflare Pages'),
    );
  });

  it('runs every E2E spec exactly once', () => {
    const repositorySpecs = fs
      .readdirSync(E2E_SPEC_DIR)
      .filter((fileName) => fileName.endsWith('.spec.ts'))
      .sort();
    const configuredSpecs = getConfiguredE2eSpecs();

    expect(new Set(configuredSpecs).size).toBe(configuredSpecs.length);
    expect(configuredSpecs.sort()).toEqual(repositorySpecs);
  });
});
