import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { TestCase, TestResult } from '@playwright/test/reporter';

import FailureBundleReporter, {
  buildFailureRecord,
  failureKey,
  pickRecordableResult,
  stripAnsi,
} from '../../e2e/reporters/failureBundle';

function fakeTest(overrides: { outcome?: string; id?: string } = {}): TestCase {
  return {
    id: overrides.id ?? 'test-id-1',
    title: 'host starts the game',
    // Real titlePath() shape: project name, rootDir-relative file path,
    // then suite and test titles (Playwright runner sources).
    titlePath: () => ['chromium', 'e2e/specs/avalon.spec.ts', 'Avalon', 'host starts the game'],
    location: { file: `${process.cwd()}/e2e/specs/avalon.spec.ts`, line: 42, column: 1 },
    outcome: () => overrides.outcome ?? 'unexpected',
    parent: { project: () => ({ name: 'chromium' }) },
  } as unknown as TestCase;
}

function fakeResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    status: 'failed',
    retry: 2,
    duration: 30123,
    errors: [
      {
        message: '\x1B[31mError: expect(locator).toBeVisible() failed\x1B[39m',
        stack: '\x1B[31mError: boom\x1B[39m\n    at avalon.spec.ts:42:1',
      },
    ],
    error: undefined,
    attachments: [
      { name: 'error-context', contentType: 'text/markdown', path: '/tmp/error-context.md' },
      { name: 'screenshot', contentType: 'image/png', path: '/tmp/shot.png' },
      { name: 'trace', contentType: 'application/zip', path: '/tmp/trace.zip' },
    ],
    ...overrides,
  } as unknown as TestResult;
}

describe('e2e failure bundle reporter', () => {
  it('builds a record for a hard failure with ANSI stripped and attachments inventoried', () => {
    const result = fakeResult();
    const record = buildFailureRecord(fakeTest(), result, [result], 'contexts/x-error-context.md');
    expect(record.specFile).toBe('e2e/specs/avalon.spec.ts');
    expect(record.title).toBe('host starts the game');
    expect(record.fullTitle).toBe(
      'chromium › e2e/specs/avalon.spec.ts › Avalon › host starts the game',
    );
    expect(record.projectName).toBe('chromium');
    expect(record.status).toBe('failed');
    expect(record.retry).toBe(999);
    expect(record.durationMs).toBe(30123);
    expect(record.errorMessage).toBe('Error: expect(locator).toBeVisible() failed');
    expect(record.errorStack).toContain('at avalon.spec.ts:42:1');
    expect(record.errorStack).not.toContain('\x1B');
    expect(record.attachments).toEqual([
      { name: 'error-context', contentType: 'text/markdown' },
      { name: 'screenshot', contentType: 'image/png' },
      { name: 'trace', contentType: 'application/zip' },
    ]);
    expect(record.errorContextFile).toBe('contexts/x-error-context.md');
  });

  it('marks retry-then-pass outcomes as flaky even though the final status passed', () => {
    const record = buildFailureRecord(
      fakeTest({ outcome: 'flaky' }),
      fakeResult({ status: 'passed', retry: 1 }),
    );
    expect(record.status).toBe('flaky');
    expect(record.errorContextFile).toBeUndefined();
  });

  it('preserves timedOut as its own status', () => {
    const record = buildFailureRecord(fakeTest(), fakeResult({ status: 'timedOut' }));
    expect(record.status).toBe('timedOut');
  });

  it('falls back to a placeholder when Playwright recorded no error object', () => {
    const record = buildFailureRecord(fakeTest(), fakeResult({ errors: [], error: undefined }));
    expect(record.errorMessage).toBe('Unknown error');
    expect(record.errorStack).toBeUndefined();
  });

  it('builds stable, filesystem-safe failure keys', () => {
    const a = failureKey('/repo/e2e/specs/avalon.spec.ts', 'A › B', 1);
    const b = failureKey('/repo/e2e/specs/avalon.spec.ts', 'A › B', 1);
    const c = failureKey('/repo/e2e/specs/avalon.spec.ts', 'A › C', 1);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^avalon\.spec\.ts-[0-9a-f]{10}-r1$/);
  });

  it('pickRecordableResult uses the last attempt for hard failures', () => {
    const attempts = [
      fakeResult({ status: 'failed', retry: 0 }),
      fakeResult({ status: 'failed', retry: 1 }),
      fakeResult({ status: 'failed', retry: 2 }),
    ];
    expect(pickRecordableResult('unexpected', attempts)?.retry).toBe(2);
  });

  it('pickRecordableResult uses the last FAILED attempt for flaky tests, not the passing retry', () => {
    const attempts = [
      fakeResult({ status: 'failed', retry: 0 }),
      fakeResult({ status: 'passed', retry: 1, errors: [] }),
    ];
    expect(pickRecordableResult('flaky', attempts)?.retry).toBe(0);
    expect(pickRecordableResult('flaky', [])).toBeUndefined();
  });

  it('stripAnsi removes color sequences and leaves plain text untouched', () => {
    expect(stripAnsi('\x1B[2mhello\x1B[22m world')).toBe('hello world');
    expect(stripAnsi('plain')).toBe('plain');
  });

  it('records every attempt with its own status and error', () => {
    const failedAttempt = fakeResult({ status: 'failed', retry: 0 });
    const passedAttempt = fakeResult({ status: 'passed', retry: 1, errors: [], error: undefined });
    const record = buildFailureRecord(fakeTest({ outcome: 'flaky' }), failedAttempt, [
      failedAttempt,
      passedAttempt,
    ]);
    expect(record.attempts).toEqual([
      { retry: 0, status: 'failed', errorMessage: 'Error: expect(locator).toBeVisible() failed' },
      { retry: 1, status: 'passed' },
    ]);
  });
});

describe('FailureBundleReporter class', () => {
  const savedDir = process.env.E2E_BUNDLE_DIR as string | undefined;
  const savedShard = process.env.E2E_BUNDLE_SHARD as string | undefined;

  afterEach(() => {
    if (savedDir === undefined) {
      delete process.env.E2E_BUNDLE_DIR;
    } else {
      process.env.E2E_BUNDLE_DIR = savedDir;
    }
    if (savedShard === undefined) {
      delete process.env.E2E_BUNDLE_SHARD;
    } else {
      process.env.E2E_BUNDLE_SHARD = savedShard;
    }
  });

  it('writes the bundle json and the verbatim error-context on failure', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bundle-out-'));
    const contextSource = path.join(dir, 'source-error-context.md');
    writeFileSync(contextSource, '# Page snapshot\n\n```yaml\n- generic\n```\n');
    process.env.E2E_BUNDLE_DIR = path.join(dir, 'failure-bundles');
    process.env.E2E_BUNDLE_SHARD = '3';

    const reporter = new FailureBundleReporter();
    const result = fakeResult({
      attachments: [
        { name: 'error-context', contentType: 'text/markdown', path: contextSource },
        { name: 'trace', contentType: 'application/zip', path: '/tmp/trace.zip' },
      ],
    });
    reporter.onTestEnd(fakeTest(), result);
    await reporter.onEnd();

    const bundlePath = path.join(dir, 'failure-bundles', 'failure-bundle-3.json');
    expect(existsSync(bundlePath)).toBe(true);
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as {
      shardIndex: string;
      failures: { errorContextFile?: string; status: string }[];
    };
    expect(bundle.shardIndex).toBe('3');
    expect(bundle.failures).toHaveLength(1);
    expect(bundle.failures[0]?.status).toBe('failed');
    const contextFile = bundle.failures[0]?.errorContextFile;
    expect(contextFile).toBeDefined();
    const copied = readFileSync(path.join(dir, 'failure-bundles', contextFile ?? ''), 'utf8');
    expect(copied).toContain('# Page snapshot');
  });

  it('writes nothing when every test passed', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bundle-green-'));
    const outDir = path.join(dir, 'failure-bundles');
    process.env.E2E_BUNDLE_DIR = outDir;

    const reporter = new FailureBundleReporter();
    reporter.onTestEnd(
      fakeTest({ outcome: 'expected' }),
      fakeResult({ status: 'passed', errors: [], error: undefined, attachments: [] }),
    );
    await reporter.onEnd();
    expect(existsSync(outDir)).toBe(false);
  });

  it('swallows its own write failures: onEnd resolves even with an unwritable target', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bundle-blocked-'));
    const blocker = path.join(dir, 'a-file-not-a-dir');
    writeFileSync(blocker, 'x');
    process.env.E2E_BUNDLE_DIR = path.join(blocker, 'failure-bundles');

    const reporter = new FailureBundleReporter();
    reporter.onTestEnd(fakeTest(), fakeResult());
    await expect(reporter.onEnd()).resolves.toBeUndefined();
  });
});
