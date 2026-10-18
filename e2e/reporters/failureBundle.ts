import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Failure bundle reporter.
 *
 * For every test whose final outcome is `unexpected` (failed after all
 * retries) or `flaky` (failed at least once, then passed on a retry), this
 * reporter writes one machine-readable bundle per shard:
 *
 *   failure-bundles/failure-bundle-<shard>.json
 *   failure-bundles/contexts/<key>-error-context.md   (verbatim, when present)
 *
 * The JSON is the first thing to read when an e2e run goes red — it carries
 * the spec, title, status, error and attachment inventory without opening a
 * trace. The PR failure digest (scripts/e2e-failure-digest.mjs) renders these
 * bundles into the PR comment. When everything is green no bundle is written.
 *
 * runId / shard come from the environment so CI can stamp them
 * (E2E_BUNDLE_RUN_ID, E2E_BUNDLE_SHARD); local runs default to local / 0.
 */

export interface FailureAttachment {
  name: string;
  contentType: string;
}

export interface FailureAttempt {
  retry: number;
  status: TestResult['status'];
  errorMessage?: string;
}

export interface FailureRecord {
  specFile: string;
  title: string;
  fullTitle: string;
  projectName: string;
  status: 'failed' | 'timedOut' | 'interrupted' | 'skipped' | 'flaky';
  retry: number;
  durationMs: number;
  errorMessage: string;
  errorStack?: string;
  /** Every attempt's status and error, in order — a flaky record shows the
   * failed attempts that preceded the passing retry, not just the last one. */
  attempts: FailureAttempt[];
  attachments: FailureAttachment[];
  /** Bundle-relative path of the verbatim error-context file, when captured. */
  errorContextFile?: string;
}

export interface FailureBundle {
  runId: string;
  shardIndex: string;
  generatedAt: string;
  failures: FailureRecord[];
}

interface PendingRecord {
  record: FailureRecord;
  errorContextText?: string;
}

interface CollectedTest {
  test: TestCase;
  results: TestResult[];
}

/**
 * Pick the attempt whose result should be recorded. Playwright fires
 * onTestEnd per attempt and a test's outcome is only final at onEnd, so the
 * decision happens there: for a hard failure the last attempt carries the
 * definitive error; for a flaky test the error and error-context live on the
 * last failed attempt, not on the passing retry.
 */
export function pickRecordableResult(
  outcome: string,
  results: TestResult[],
): TestResult | undefined {
  if (results.length === 0) {
    return undefined;
  }
  if (outcome === 'flaky') {
    const failedAttempts = results.filter((r) => r.status !== 'passed' && r.status !== 'skipped');
    return failedAttempts[failedAttempts.length - 1] ?? results[results.length - 1];
  }
  return results[results.length - 1];
}

// Built from the char code so the pattern itself carries no literal control
// character in source (Playwright error messages embed raw ESC sequences).
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/** Stable, filesystem-safe key for one test: spec basename + title hash + retry.
 * The project name feeds the hash so two projects running the same spec and
 * title never collide on the context file name. */
export function failureKey(
  specFile: string,
  fullTitle: string,
  retry: number,
  projectName = '',
): string {
  const hash = createHash('sha1').update(`${projectName}::${fullTitle}`).digest('hex').slice(0, 10);
  const base = path.basename(specFile).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${base}-${hash}-r${retry}`;
}

function toFailureStatus(status: TestResult['status']): FailureRecord['status'] {
  switch (status) {
    case 'failed':
    case 'timedOut':
    case 'interrupted':
    case 'skipped':
      return status;
    case 'passed':
      // Unreachable for a recordable result: buildFailureRecord is only
      // called for unexpected/flaky outcomes, whose picked attempt did not
      // pass. Bucketed as 'failed' rather than fabricating a pass record.
      return 'failed';
  }
}

/** titlePath() carries empty root segments for file-level tests; drop them. */
export function fullTitleOf(test: TestCase): string {
  return test.titlePath().filter(Boolean).join(' › ');
}

export function buildFailureRecord(
  test: TestCase,
  result: TestResult,
  allResults: TestResult[] = [result],
  errorContextFile?: string,
): FailureRecord {
  const outcome = test.outcome();
  const firstError = result.errors[0] ?? result.error;
  const record: FailureRecord = {
    specFile: path.relative(process.cwd(), test.location.file) || test.location.file,
    title: test.title,
    fullTitle: fullTitleOf(test),
    projectName: test.parent.project()?.name ?? '',
    status: outcome === 'flaky' ? 'flaky' : toFailureStatus(result.status),
    retry: result.retry,
    durationMs: result.duration,
    errorMessage: stripAnsi(firstError?.message ?? 'Unknown error'),
    attempts: allResults.map((r) => {
      const attemptError = r.errors[0] ?? r.error;
      const attempt: FailureAttempt = { retry: r.retry, status: r.status };
      if (attemptError?.message) {
        attempt.errorMessage = stripAnsi(attemptError.message);
      }
      return attempt;
    }),
    attachments: result.attachments.map((a) => ({ name: a.name, contentType: a.contentType })),
  };
  if (firstError?.stack) {
    record.errorStack = stripAnsi(firstError.stack);
  }
  if (errorContextFile) {
    record.errorContextFile = errorContextFile;
  }
  return record;
}

class FailureBundleReporter implements Reporter {
  private collected = new Map<string, CollectedTest>();

  onTestEnd(test: TestCase, result: TestResult): void {
    const entry = this.collected.get(test.id) ?? { test, results: [] };
    entry.results.push(result);
    this.collected.set(test.id, entry);
  }

  async onEnd(): Promise<void> {
    // A broken reporter must never change the run's outcome: every failure
    // in here is swallowed with one stderr line, so a green suite stays
    // green (and a red one red) even if the bundle cannot be written.
    try {
      await this.writeBundle();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[failure-bundle] reporter failed, bundle skipped: ${message}\n`);
    }
  }

  private async writeBundle(): Promise<void> {
    const pending: PendingRecord[] = [];
    for (const { test, results } of this.collected.values()) {
      const outcome = test.outcome();
      if (outcome !== 'unexpected' && outcome !== 'flaky') {
        continue;
      }
      const result = pickRecordableResult(outcome, results);
      if (!result) {
        continue;
      }
      let errorContextText: string | undefined;
      let errorContextFile: string | undefined;
      const contextAttachment = result.attachments.find((a) => a.name === 'error-context');
      if (contextAttachment?.path) {
        const key = failureKey(
          test.location.file,
          fullTitleOf(test),
          result.retry,
          test.parent.project()?.name ?? '',
        );
        errorContextFile = `contexts/${key}-error-context.md`;
        try {
          errorContextText = await readFile(contextAttachment.path, 'utf8');
        } catch {
          // The attachment path is Playwright-managed; if it is already gone
          // the bundle still carries the error itself, so this is a soft miss.
          errorContextFile = undefined;
        }
      }
      pending.push({
        record: buildFailureRecord(test, result, results, errorContextFile),
        errorContextText,
      });
    }
    if (pending.length === 0) {
      return;
    }
    const outDir = process.env.E2E_BUNDLE_DIR ?? 'failure-bundles';
    const contextsDir = path.join(outDir, 'contexts');
    await mkdir(contextsDir, { recursive: true });
    for (const item of pending) {
      if (item.errorContextText !== undefined && item.record.errorContextFile) {
        await writeFile(
          path.join(outDir, item.record.errorContextFile),
          item.errorContextText,
          'utf8',
        );
      }
    }
    const bundle: FailureBundle = {
      runId: process.env.E2E_BUNDLE_RUN_ID ?? 'local',
      shardIndex: process.env.E2E_BUNDLE_SHARD ?? '0',
      generatedAt: new Date().toISOString(),
      failures: pending.map((p) => p.record),
    };
    await writeFile(
      path.join(outDir, `failure-bundle-${bundle.shardIndex}.json`),
      `${JSON.stringify(bundle, null, 2)}\n`,
      'utf8',
    );
  }
}

export default FailureBundleReporter;
