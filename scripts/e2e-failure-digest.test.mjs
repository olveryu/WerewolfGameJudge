import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DIGEST_MARKER,
  extractCallLog,
  extractSnapshot,
  findDigestComment,
  parseBundle,
  renderDigest,
  shouldPostNewComment,
} from './e2e-failure-digest.mjs';

// Mirrors the real Playwright 1.60 error-context layout (four sections:
// Test info / Error details / Page snapshot / Test source). The call log is
// part of the error message text inside Error details — the document has no
// standalone step list.
const ERROR_MESSAGE = `Error: expect(locator).toBeVisible() failed

Locator: getByTestId('room-screen')
Expected: visible
Received: <element(s) not found>
Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('room-screen')`;

const ERROR_CONTEXT = `# Test info

- Name: avalon.spec.ts >> Avalon >> host starts the game
- Location: e2e/specs/avalon.spec.ts:42:1

# Error details

\`\`\`
${ERROR_MESSAGE}
\`\`\`

# Page snapshot

\`\`\`yaml
- generic [ref=e1]:
  - heading "分配角色？" [ref=e2]
  - button "取消" [ref=e3]
\`\`\`

# Test source

\`\`\`ts
await expect(page.getByTestId('room-screen')).toBeVisible();
\`\`\`
`;

function failureRecord(overrides = {}) {
  return {
    specFile: 'e2e/specs/avalon.spec.ts',
    title: 'host starts the game',
    fullTitle: 'chromium › e2e/specs/avalon.spec.ts › Avalon › host starts the game',
    projectName: 'chromium',
    status: 'failed',
    retry: 2,
    durationMs: 30_123,
    errorMessage: ERROR_MESSAGE,
    errorStack: `${ERROR_MESSAGE}\n    at avalon.spec.ts:42:1`,
    attempts: [
      { retry: 0, status: 'failed', errorMessage: 'Error: first blow-up' },
      { retry: 2, status: 'failed', errorMessage: ERROR_MESSAGE },
    ],
    attachments: [
      { name: 'error-context', contentType: 'text/markdown' },
      { name: 'trace', contentType: 'application/zip' },
    ],
    errorContextFile: 'contexts/avalon-error-context.md',
    ...overrides,
  };
}

test('parseBundle returns the whole bundle and tolerates malformed input', () => {
  const bundle = parseBundle('{"runId": "9", "shardIndex": "3", "failures": [{"a": 1}]}');
  assert.equal(bundle.shardIndex, '3');
  assert.deepEqual(bundle.failures, [{ a: 1 }]);
  assert.deepEqual(parseBundle('not json'), {});
  assert.deepEqual(parseBundle('{"nope": true}'), {});
  assert.deepEqual(parseBundle('{"failures": "x"}'), {});
});

test('extractSnapshot pulls the yaml fence after the Page snapshot heading', () => {
  const snapshot = extractSnapshot(ERROR_CONTEXT);
  assert.match(snapshot, /heading "分配角色？"/);
  assert.match(snapshot, /button "取消"/);
  assert.equal(extractSnapshot('# Nothing here'), undefined);
  assert.equal(extractSnapshot(undefined), undefined);
});

test('extractCallLog reads the Call log list out of the error text', () => {
  const log = extractCallLog(ERROR_MESSAGE);
  assert.match(log, /- Expect "toBeVisible" with timeout 5000ms/);
  assert.match(log, /- waiting for getByTestId\('room-screen'\)/);
  // The Test info Name/Location lines are NOT a call log and must not leak in.
  assert.equal(extractCallLog(ERROR_CONTEXT.split('# Error details')[0]), undefined);
  assert.equal(extractCallLog('Error: plain failure without a log'), undefined);
  assert.equal(extractCallLog(undefined), undefined);
});

test('renderDigest renders the green state when e2e passed with no records', () => {
  const body = renderDigest({ entries: [], e2eResult: 'success', runUrl: 'https://run/1' });
  assert.ok(body.startsWith(DIGEST_MARKER));
  assert.match(body, /✅ 本次 e2e 全部通过/);
  assert.match(body, /https:\/\/run\/1/);
});

test('renderDigest warns instead of claiming green when e2e failed without a bundle', () => {
  const body = renderDigest({ entries: [], e2eResult: 'failure', runUrl: 'https://run/1' });
  assert.match(body, /⚠️ e2e 结果为 failure/);
  assert.doesNotMatch(body, /全部通过/);
});

test('renderDigest separates hard failures from flaky and embeds snapshot + call log + shard', () => {
  const body = renderDigest({
    entries: [
      { record: failureRecord(), errorContextText: ERROR_CONTEXT, shardIndex: '3' },
      {
        record: failureRecord({
          specFile: 'e2e/specs/drawguess.spec.ts',
          fullTitle: 'chromium › e2e/specs/drawguess.spec.ts › host starts',
          status: 'flaky',
          retry: 1,
          errorMessage: 'Error: timeout',
          attempts: [{ retry: 0, status: 'failed', errorMessage: 'Error: timeout' }],
        }),
        errorContextText: undefined,
        shardIndex: '5',
      },
    ],
    e2eResult: 'failure',
    runUrl: 'https://run/9',
  });
  assert.match(body, /❌ 1 条失败 · ⚠️ 1 条 flaky/);
  assert.match(body, /### ❌ `e2e\/specs\/avalon\.spec\.ts`/);
  assert.match(body, /来源：分片 3 · project chromium/);
  assert.match(body, /各次 attempt 错误：#0 `Error: first blow-up`/);
  assert.match(body, /页面快照（失败时刻）/);
  assert.match(body, /heading "分配角色？"/);
  assert.match(body, /调用日志（错误自带）/);
  assert.match(body, /Expect "toBeVisible" with timeout 5000ms/);
  assert.match(body, /附件：error-context、trace/);
  assert.match(body, /### ⚠️ Flaky/);
  assert.match(body, /drawguess\.spec\.ts/);
});

test('renderDigest leads with a warning, not a cross, when only flaky records exist', () => {
  const body = renderDigest({
    entries: [
      {
        record: failureRecord({ status: 'flaky', errorMessage: 'Error: timeout', attempts: [] }),
        errorContextText: undefined,
        shardIndex: '1',
      },
    ],
    e2eResult: 'success',
    runUrl: 'https://run/2',
  });
  assert.match(body, /⚠️ 0 条失败 · ⚠️ 1 条 flaky/);
  assert.doesNotMatch(body, /❌ 0 条失败/);
});

test('renderDigest caps the comment body for pathological failure counts', () => {
  const entries = Array.from({ length: 400 }, (_, i) => ({
    record: failureRecord({ fullTitle: `t${i} ${'x'.repeat(300)}` }),
    errorContextText: ERROR_CONTEXT,
    shardIndex: '1',
  }));
  const body = renderDigest({ entries, e2eResult: 'failure', runUrl: 'https://run/1' });
  assert.ok(body.length <= 61_000, `length ${body.length}`);
  assert.match(body, /摘要超长已截断/);
});

test('findDigestComment locates the marked comment only', () => {
  assert.equal(
    findDigestComment([
      { id: 1, body: 'hello' },
      { id: 2, body: `${DIGEST_MARKER}\n## E2E 失败摘要` },
    ]),
    2,
  );
  assert.equal(findDigestComment([{ id: 1, body: 'hello' }]), null);
});

test('shouldPostNewComment: failures always post, green never creates a comment', () => {
  assert.equal(shouldPostNewComment({ entries: [], e2eResult: 'success' }), false);
  assert.equal(shouldPostNewComment({ entries: [], e2eResult: 'failure' }), true);
  assert.equal(
    shouldPostNewComment({ entries: [{ record: failureRecord() }], e2eResult: 'success' }),
    true,
  );
});
