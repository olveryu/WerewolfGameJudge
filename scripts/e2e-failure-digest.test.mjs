import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DIGEST_MARKER,
  LEDGER_MARKER,
  LEDGER_TITLE,
  e2eLedgerAdditions,
  extractCallLog,
  extractSnapshot,
  findDigestComment,
  findLedgerIssue,
  parseBundle,
  parseLedgerState,
  parseUnitResults,
  renderDigest,
  renderLedgerBody,
  shouldPostNewComment,
  unitLedgerAdditions,
  updateLedger,
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

const JEST_JSON = JSON.stringify({
  testResults: [
    {
      name: '/home/runner/work/WerewolfGameJudge/WerewolfGameJudge/src/__tests__/alpha.test.ts',
      status: 'failed',
      message: '',
      assertionResults: [
        {
          fullName: 'alpha does the thing',
          title: 'does the thing',
          status: 'failed',
          failureMessages: [
            'Error: expected 1 to be 2\n    at Object.<anonymous> (alpha.test.ts:3:5)',
          ],
        },
        {
          fullName: 'alpha passes fine',
          title: 'passes fine',
          status: 'passed',
          failureMessages: [],
        },
      ],
    },
    {
      name: '/home/runner/work/WerewolfGameJudge/WerewolfGameJudge/src/__tests__/beta.test.ts',
      status: 'failed',
      message: 'Test suite failed to run\n\n  Cannot find module ./missing',
      assertionResults: [],
    },
    {
      name: '/home/runner/work/WerewolfGameJudge/WerewolfGameJudge/src/__tests__/gamma.test.ts',
      status: 'passed',
      message: '',
      assertionResults: [
        { fullName: 'gamma ok', title: 'ok', status: 'passed', failureMessages: [] },
      ],
    },
  ],
});

test('parseUnitResults: failed assertions + failed suites, paths relativized', () => {
  const entries = parseUnitResults(JEST_JSON, 'root jest');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].specFile, 'src/__tests__/alpha.test.ts');
  assert.equal(entries[0].fullTitle, 'alpha does the thing');
  assert.equal(entries[0].errorMessage, 'Error: expected 1 to be 2');
  assert.equal(entries[0].source, 'root jest');
  assert.equal(entries[1].fullTitle, '(suite failed to run)');
  assert.equal(entries[1].errorMessage, 'Test suite failed to run');
  assert.deepEqual(parseUnitResults('not json', 'root jest'), []);
  assert.deepEqual(parseUnitResults('{}', 'root jest'), []);
});

test('renderDigest: unit failures get their own section under the unit caliber', () => {
  const unitFailures = parseUnitResults(JEST_JSON, 'root jest');
  const body = renderDigest({
    entries: [],
    e2eResult: 'success',
    runUrl: 'https://example/run/1',
    unitFailures,
  });
  assert.ok(body.includes('🧪 2 条单测失败'));
  assert.ok(body.includes('### 🧪 单测失败（2 条）'));
  assert.ok(body.includes('`src/__tests__/alpha.test.ts` — alpha does the thing（root jest）'));
  assert.equal(shouldPostNewComment({ entries: [], e2eResult: 'success', unitFailures }), true);
  // The e2e-only rendering is untouched when there are no unit failures.
  const e2eOnly = renderDigest({
    entries: [{ record: failureRecord(), errorContextText: ERROR_CONTEXT }],
    e2eResult: 'failure',
    runUrl: 'https://example/run/1',
  });
  assert.ok(e2eOnly.includes('1 条失败'));
  assert.ok(!e2eOnly.includes('单测失败'));
});

function flakyEntry() {
  return {
    record: failureRecord({
      specFile: 'e2e/specs/werewolf.spec.ts',
      fullTitle: 'chromium › werewolf › night falls',
      status: 'flaky',
    }),
  };
}

function applyLedger(existingBody, additions, overrides = {}) {
  return updateLedger({
    existingBody,
    additions,
    today: '2026-10-19',
    runId: '1001',
    runUrl: 'https://example/run/1001',
    ...overrides,
  });
}

test('updateLedger: creates the ledger from the first additions', () => {
  const additions = [
    ...e2eLedgerAdditions([flakyEntry()]),
    ...unitLedgerAdditions(parseUnitResults(JEST_JSON, 'root jest')),
  ];
  const result = applyLedger(undefined, additions);
  assert.ok(result);
  assert.ok(result.body.startsWith(LEDGER_MARKER));
  assert.equal(result.rows.length, 3);
  const state = parseLedgerState(result.body);
  assert.equal(state.length, 3);
  assert.ok(state.every((row) => row.count === 1 && row.firstSeen === '2026-10-19'));
  // Calibers stay separate rows: e2e flaky vs unit failure.
  assert.ok(state.some((row) => row.source === 'e2e' && row.kind === 'flaky'));
  assert.ok(state.some((row) => row.source === 'root jest' && row.kind === 'failure'));
  assert.ok(result.body.includes('## 活跃条目'));
});

test('updateLedger: no issue and no additions -> null (green push creates nothing)', () => {
  assert.equal(applyLedger(undefined, []), null);
});

test('updateLedger: increments across runs, dedupes within a run, idempotent per run', () => {
  const additions = e2eLedgerAdditions([flakyEntry(), flakyEntry()]);
  const first = applyLedger(undefined, additions);
  assert.equal(first.rows[0].count, 1);
  // Same input again (same runId): nothing changes, byte-identical body.
  const again = applyLedger(first.body, additions);
  assert.equal(again.changed, false);
  assert.equal(again.body, first.body);
  // A new run with the same failure increments.
  const next = applyLedger(first.body, additions, {
    today: '2026-10-20',
    runId: '1002',
    runUrl: 'https://example/run/1002',
  });
  assert.equal(next.rows[0].count, 2);
  assert.equal(next.rows[0].firstSeen, '2026-10-19');
  assert.equal(next.rows[0].lastSeen, '2026-10-20');
});

test('updateLedger: silence migration after 14 days and reactivation', () => {
  const additions = e2eLedgerAdditions([flakyEntry()]);
  const first = applyLedger(undefined, additions);
  // 14 days later: still active (silence requires MORE than 14 days).
  const day14 = applyLedger(first.body, [], { today: '2026-11-02' });
  const activeSection = day14.body.split('## 已静默')[0];
  assert.ok(activeSection.includes('werewolf.spec.ts'));
  // 15 days later with no new occurrence: moves to the silenced section.
  const day15 = applyLedger(first.body, [], { today: '2026-11-03' });
  const silencedSection = day15.body.split('## 已静默')[1];
  assert.ok(silencedSection.includes('werewolf.spec.ts'));
  // Reappearing reactivates it with its history preserved.
  const back = applyLedger(day15.body, additions, {
    today: '2026-11-10',
    runId: '2001',
    runUrl: 'https://example/run/2001',
  });
  assert.equal(back.rows[0].count, 2);
  assert.equal(back.rows[0].firstSeen, '2026-10-19');
  assert.ok(back.body.split('## 已静默')[0].includes('werewolf.spec.ts'));
});

test('renderLedgerBody and parseLedgerState round-trip', () => {
  const additions = [
    ...e2eLedgerAdditions([flakyEntry()]),
    ...e2eLedgerAdditions([{ record: failureRecord() }]),
  ];
  const result = applyLedger(undefined, additions);
  const state = parseLedgerState(result.body);
  assert.equal(state.length, 2);
  assert.equal(renderLedgerBody(state, '2026-10-19'), result.body);
  assert.deepEqual(parseLedgerState('no marker here'), []);
  assert.deepEqual(parseLedgerState(`${LEDGER_MARKER}\nno state`), []);
});

test('updateLedger: a title containing --> cannot truncate the embedded state', () => {
  const additions = [
    {
      source: 'e2e',
      specFile: 'e2e/specs/markdown.spec.ts',
      fullTitle: 'renders an arrow --> inside a comment',
      kind: 'failure',
    },
  ];
  const first = applyLedger(undefined, additions);
  const state = parseLedgerState(first.body);
  assert.equal(state.length, 1);
  assert.equal(state[0].fullTitle, 'renders an arrow --> inside a comment');
  // The next run still sees the history and increments instead of wiping.
  const next = applyLedger(first.body, additions, {
    today: '2026-10-20',
    runId: '1002',
    runUrl: 'https://example/run/1002',
  });
  assert.equal(next.rows.length, 1);
  assert.equal(next.rows[0].count, 2);
  // A trailing newline on the stored body (GitHub round-trip) is tolerated.
  assert.equal(parseLedgerState(`${first.body}\n`).length, 1);
});

test('parseLedgerState: a corrupt embedded state throws instead of resetting', () => {
  const corrupt = `${LEDGER_MARKER}\n# t\n\n<!-- ledger-state: {not json} -->`;
  assert.throws(() => parseLedgerState(corrupt), /corrupt/);
  assert.throws(() => applyLedger(corrupt, e2eLedgerAdditions([flakyEntry()])), /corrupt/);
});

test('updateLedger: an empty runId counts every invocation (no run identity)', () => {
  const additions = e2eLedgerAdditions([flakyEntry()]);
  const first = applyLedger(undefined, additions, { runId: '', runUrl: '' });
  const second = applyLedger(first.body, additions, {
    today: '2026-10-20',
    runId: '',
    runUrl: '',
  });
  assert.equal(second.rows[0].count, 2);
});

test('findLedgerIssue matches title + marker and skips pull requests', () => {
  const ledgerBody = applyLedger(undefined, e2eLedgerAdditions([flakyEntry()])).body;
  const found = findLedgerIssue([
    { number: 1, title: 'other', body: ledgerBody },
    { number: 2, title: LEDGER_TITLE, body: ledgerBody, pull_request: { url: 'x' } },
    { number: 3, title: LEDGER_TITLE, body: ledgerBody },
  ]);
  assert.equal(found.number, 3);
  assert.equal(findLedgerIssue([{ number: 1, title: 'other', body: 'x' }]), null);
});
