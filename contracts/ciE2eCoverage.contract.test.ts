/**
 * CI deployment gates and coverage of the explicit Playwright shard matrix.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const E2E_SPEC_DIR = path.join(ROOT_DIR, 'e2e/specs');
const CI_WORKFLOW_PATH = path.join(ROOT_DIR, '.github/workflows/ci.yml');
const workflowSchema = z.object({
  jobs: z.record(
    z.string(),
    z.object({
      needs: z.union([z.string(), z.array(z.string())]).optional(),
      if: z.string().optional(),
      steps: z
        .array(
          z.object({
            if: z.string().optional(),
            run: z.string().optional(),
            uses: z.string().optional(),
            with: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
    }),
  ),
});

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

describe('CI production deployment gates', () => {
  const workflow: unknown = parse(fs.readFileSync(CI_WORKFLOW_PATH, 'utf8'));
  const { jobs } = workflowSchema.parse(workflow);

  it.each(['deploy-api-worker', 'deploy-frontend', 'deploy-miniapp'])(
    '%s waits for the complete CI gate to succeed',
    (deploymentJob) => {
      const job = jobs[deploymentJob];
      expect(job?.needs).toContain('ci-gate');
      expect(job?.if).toContain("needs.ci-gate.result == 'success'");
    },
  );

  it('publishes release assets on main ahead of the gate and deploys that exact build', () => {
    const publishJob = jobs['publish-frontend-assets'];
    const deployJob = jobs['deploy-frontend'];
    const upload = publishJob?.steps?.find((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    );
    const download = deployJob?.steps?.find((step) =>
      step.uses?.startsWith('actions/download-artifact@'),
    );

    expect(publishJob?.needs).toEqual(['quality', 'lint']);
    expect(publishJob?.if).toContain(
      "(github.event_name == 'push' || github.event_name == 'workflow_dispatch')",
    );
    expect(publishJob?.if).toContain("github.ref == 'refs/heads/main'");
    // Without hidden files the artifact drops dist/.well-known from production.
    expect(upload?.with).toMatchObject({
      name: 'frontend-release-dist',
      path: 'dist/',
      'include-hidden-files': true,
    });
    expect(download?.with).toMatchObject({ name: 'frontend-release-dist', path: 'dist/' });
    expect(deployJob?.if).toContain("needs.publish-frontend-assets.result == 'success'");
    expect(deployJob?.steps?.map((step) => step.run)).not.toContain('bash scripts/build.sh');
  });

  it('requires every quality and test job in the stable CI gate', () => {
    expect(jobs['ci-gate']?.needs).toEqual([
      'quality',
      'lint',
      'test-root',
      'test-api-worker',
      'e2e',
    ]);
  });

  it('keeps fork failure digests in the step summary without attempting PR writes', () => {
    const steps = jobs['failure-digest']?.steps ?? [];
    const postComment = steps.find((step) => step.run?.includes('--pr '));
    const forkSummary = steps.find(
      (step) =>
        step.run?.includes('node scripts/e2e-failure-digest.mjs') &&
        step.if?.includes('head.repo.full_name != github.repository'),
    );

    expect(postComment?.if).toBe(
      "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(forkSummary?.if).toBe(
      "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository",
    );
    expect(forkSummary?.run).toContain('--bundles failure-bundles-in');
    expect(forkSummary?.run).toContain('--test-results test-results-in');
    expect(forkSummary?.run).toContain('--e2e-result ${{ needs.e2e.result }}');
    expect(forkSummary?.run).not.toContain('--pr');
    expect(forkSummary?.run).not.toContain('--ledger');
  });

  it('includes every workspace quality task and builds the engine before its consumers', () => {
    expect(jobs.quality?.steps).toContainEqual({
      run: 'pnpm exec turbo run build typecheck knip',
    });
    const report: unknown = JSON.parse(
      execFileSync(
        'pnpm',
        [
          'exec',
          'turbo',
          'run',
          'build',
          'typecheck',
          'lint',
          'knip',
          'format',
          'test',
          '--dry=json',
        ],
        {
          cwd: ROOT_DIR,
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
        },
      ),
    );
    const { tasks } = z
      .object({
        tasks: z.array(
          z.object({
            taskId: z.string(),
            command: z.string(),
            dependencies: z.array(z.string()),
          }),
        ),
      })
      .parse(report);
    const requiredTasks = [
      '//#format',
      '//#knip',
      '//#lint',
      '//#test',
      '//#typecheck',
      '@game-judge/api-worker#test',
      '@game-judge/api-worker#typecheck',
      '@game-judge/game-engine#build',
      '@game-judge/game-engine#test',
    ];
    for (const taskId of requiredTasks) {
      const task = tasks.find((candidate) => candidate.taskId === taskId);
      expect(task).toBeDefined();
      expect(task?.command).not.toBe('<NONEXISTENT>');
      if (taskId !== '//#format' && taskId !== '@game-judge/game-engine#build') {
        expect(task?.dependencies).toContain('@game-judge/game-engine#build');
      }
    }
  });

  it('keeps deployment prerequisites acyclic and points to existing jobs', () => {
    const visitJob = (jobName: string, ancestors: readonly string[]): void => {
      expect(ancestors).not.toContain(jobName);
      const job = jobs[jobName];
      if (job === undefined) throw new Error(`Missing CI job: ${jobName}`);
      const prerequisites = typeof job.needs === 'string' ? [job.needs] : job.needs;
      for (const prerequisite of prerequisites ?? []) {
        visitJob(prerequisite, [...ancestors, jobName]);
      }
    };
    for (const deploymentJob of ['deploy-api-worker', 'deploy-frontend', 'deploy-miniapp']) {
      visitJob(deploymentJob, []);
    }
  });
});

describe('CI Playwright shard coverage', () => {
  it('verifies CDN bytes before Pages deployment after the complete CI gate', () => {
    execFileSync(process.execPath, ['--test', 'scripts/verify-cdn-artifacts.test.mjs'], {
      cwd: ROOT_DIR,
    });
    const workflow = fs.readFileSync(CI_WORKFLOW_PATH, 'utf8');
    const frontend = workflow.slice(
      workflow.indexOf('\n  deploy-frontend:'),
      workflow.indexOf('\n  deploy-miniapp:'),
    );
    expect(frontend).toContain('needs: [ci-gate, deploy-api-worker, publish-frontend-assets]');
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
