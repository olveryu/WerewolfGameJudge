#!/usr/bin/env node
/**
 * E2E failure digest.
 *
 * Reads every failure bundle produced by e2e/reporters/failureBundle.ts in a
 * directory (the failure-digest CI job downloads all failure-bundle-*
 * artifacts into one place) and maintains ONE comment on the PR: failures
 * with their error, error-context page snapshot and step log, flaky tests
 * called out separately, or a green check when the e2e job passed.
 *
 * Usage (CI):
 *   GH_TOKEN=<token> node scripts/e2e-failure-digest.mjs \
 *     --bundles failure-bundles-in --pr 212 --repo owner/name \
 *     --run-url https://github.com/owner/name/actions/runs/123 \
 *     --e2e-result failure
 *
 * Without --pr it runs summary-only (push-to-main): the digest is appended
 * to $GITHUB_STEP_SUMMARY when that variable is set. Either way, a green
 * result never CREATES a PR comment — it only updates an existing one.
 *
 * Unit-test results (--test-results <dir> with jest/vitest JSON files named
 * test-results-{root,engine,api}-<shard>.json) join the same digest: their
 * failures are listed in their own section. Jest and vitest both emit the
 * same JSON shape (testResults -> assertionResults), so one parser covers
 * both runners.
 *
 * With --ledger (push-to-main only) the script also maintains the rolling
 * flake-ledger issue: e2e flaky/failure entries plus unit failures,
 * aggregated per test in the issue body (see updateLedger). Record-only —
 * it never opens/closes other issues and never mentions anyone.
 *
 * The pure rendering functions are exported for scripts/e2e-failure-digest.test.mjs.
 */
import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIGEST_MARKER = '<!-- e2e-failure-digest -->';
export const LEDGER_MARKER = '<!-- flake-ledger -->';
export const LEDGER_TITLE = 'Flake 台账（自动记账）';
const LEDGER_STATE_PREFIX = '<!-- ledger-state: ';
const SILENCE_DAYS = 14;
const MAX_SILENCED_ROWS = 100;
const MAX_COMMENT_CHARS = 60_000;
const MAX_ERROR_LINES = 30;
const MAX_SNAPSHOT_LINES = 40;
const MAX_LOG_LINES = 20;

/** Parse one failure-bundle JSON text; returns the bundle ({} when malformed). */
export function parseBundle(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.failures)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Extract the page snapshot YAML from a Playwright error-context document
 * (the section after the `# Page snapshot` heading, in its ```yaml fence).
 */
export function extractSnapshot(errorContextText) {
  if (!errorContextText) {
    return undefined;
  }
  const heading = errorContextText.indexOf('# Page snapshot');
  if (heading === -1) {
    return undefined;
  }
  const rest = errorContextText.slice(heading);
  const fenceStart = rest.indexOf('```yaml');
  if (fenceStart === -1) {
    return undefined;
  }
  const bodyStart = rest.indexOf('\n', fenceStart) + 1;
  const fenceEnd = rest.indexOf('```', bodyStart);
  if (fenceEnd === -1) {
    return undefined;
  }
  const lines = rest.slice(bodyStart, fenceEnd).split('\n');
  const kept = lines.slice(0, MAX_SNAPSHOT_LINES);
  if (lines.length > MAX_SNAPSHOT_LINES) {
    kept.push(`… (${lines.length - MAX_SNAPSHOT_LINES} more lines in the error-context file)`);
  }
  return kept.join('\n').trimEnd();
}

/**
 * Extract the Playwright call log from an error message/stack. Playwright
 * embeds it in the error text itself, as an indented `- ` list under a
 * `Call log:` line — it is NOT a section of the error-context document
 * (whose sections are Test info / Error details / Page snapshot / Test
 * source). Returns undefined when the error carries no call log.
 */
export function extractCallLog(errorText) {
  if (!errorText) {
    return undefined;
  }
  const lines = errorText.split('\n');
  const start = lines.findIndex((l) => l.trim() === 'Call log:');
  if (start === -1) {
    return undefined;
  }
  const collected = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const match = /^\s+-\s+(.*)$/.exec(lines[i]);
    if (!match) {
      break;
    }
    collected.push(`- ${match[1]}`);
  }
  if (collected.length === 0) {
    return undefined;
  }
  return collected.slice(-MAX_LOG_LINES).join('\n');
}

function firstLine(text) {
  return (text ?? '').split('\n').find((l) => l.trim().length > 0) ?? 'Unknown error';
}

function errorExcerpt(record) {
  const source = record.errorStack ?? record.errorMessage ?? '';
  const lines = source.split('\n').slice(0, MAX_ERROR_LINES);
  return lines.join('\n');
}

function inlineCode(text) {
  return `\`${(text ?? '').replace(/`/g, "'")}\``;
}

function renderFailure(record, errorContextText, shardIndex) {
  const lines = [];
  lines.push(`### ❌ \`${record.specFile}\` — ${record.fullTitle}`);
  lines.push(
    `- 状态：${record.status}（retry ${record.retry}）· ${Math.round((record.durationMs ?? 0) / 100) / 10}s`,
  );
  const origin = [];
  if (shardIndex !== undefined && shardIndex !== '') {
    origin.push(`分片 ${shardIndex}`);
  }
  if (record.projectName) {
    origin.push(`project ${record.projectName}`);
  }
  if (origin.length > 0) {
    lines.push(`- 来源：${origin.join(' · ')}`);
  }
  lines.push(`- 错误：${inlineCode(firstLine(record.errorMessage))}`);
  const attemptErrors = (record.attempts ?? []).filter((a) => a.errorMessage);
  if (attemptErrors.length > 1) {
    lines.push(
      `- 各次 attempt 错误：${attemptErrors.map((a) => `#${a.retry} ${inlineCode(firstLine(a.errorMessage))}`).join('；')}`,
    );
  }
  const attachmentNames = (record.attachments ?? []).map((a) => a.name);
  if (attachmentNames.length > 0) {
    lines.push(`- 附件：${attachmentNames.join('、')}`);
  }
  const snapshot = extractSnapshot(errorContextText);
  const callLog = extractCallLog(record.errorStack ?? record.errorMessage);
  lines.push('');
  lines.push('<details><summary>错误详情 / 页面快照 / 调用日志</summary>');
  lines.push('');
  lines.push('````');
  lines.push(errorExcerpt(record));
  lines.push('````');
  if (snapshot) {
    lines.push('');
    lines.push('页面快照（失败时刻）:');
    lines.push('');
    lines.push('````yaml');
    lines.push(snapshot);
    lines.push('````');
  }
  if (callLog) {
    lines.push('');
    lines.push('调用日志（错误自带）:');
    lines.push('');
    lines.push('````');
    lines.push(callLog);
    lines.push('````');
  }
  lines.push('');
  lines.push('</details>');
  return lines.join('\n');
}

function relativizeTestPath(name) {
  const match = /\/(packages|src|e2e|apps)\//.exec(name ?? '');
  return match ? name.slice(match.index + 1) : name;
}

/**
 * Parse one jest/vitest JSON results file into unit-failure entries:
 * [{ source, specFile, fullTitle, errorMessage }]. Both runners emit the
 * same shape (testResults -> assertionResults). A suite that failed to run
 * (status failed, no failed assertion) yields one entry of its own. Unit
 * tests have no retries, so these entries are always the "failure" caliber.
 */
export function parseUnitResults(text, source) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!parsed || !Array.isArray(parsed.testResults)) {
    return [];
  }
  const entries = [];
  for (const suite of parsed.testResults) {
    const specFile = relativizeTestPath(suite.name ?? '');
    const failedAssertions = (suite.assertionResults ?? []).filter((a) => a.status === 'failed');
    for (const assertion of failedAssertions) {
      entries.push({
        source,
        specFile,
        fullTitle: assertion.fullName ?? assertion.title ?? 'unknown test',
        errorMessage: firstLine((assertion.failureMessages ?? [])[0]),
      });
    }
    if (suite.status === 'failed' && failedAssertions.length === 0) {
      entries.push({
        source,
        specFile,
        fullTitle: '(suite failed to run)',
        errorMessage: firstLine(suite.message),
      });
    }
  }
  return entries;
}

const UNIT_SOURCE_BY_PREFIX = [
  ['test-results-root-', 'root jest'],
  ['test-results-engine-', 'game-engine vitest'],
  ['test-results-api-', 'api-worker vitest'],
];

/** Read a directory of downloaded unit-result artifacts into entries. */
export async function readUnitResultsDir(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    const found = UNIT_SOURCE_BY_PREFIX.find(([prefix]) => name.startsWith(prefix));
    const source = found ? found[1] : 'unit';
    entries.push(...parseUnitResults(await readFile(path.join(dir, name), 'utf8'), source));
  }
  return entries;
}

/**
 * Render the full digest comment body.
 * entries: [{ record, errorContextText }] — hard failures and flaky mixed;
 * they are separated here by record.status.
 * unitFailures: parseUnitResults entries — listed in their own section,
 * under the separate unit caliber (failures only, never flaky).
 */
export function renderDigest({ entries, e2eResult, runUrl, unitFailures = [] }) {
  const failures = entries.filter((e) => e.record.status !== 'flaky');
  const flaky = entries.filter((e) => e.record.status === 'flaky');
  const parts = [DIGEST_MARKER, '## E2E 失败摘要', ''];
  if (failures.length === 0 && flaky.length === 0 && unitFailures.length === 0) {
    if (e2eResult === 'success') {
      parts.push(`✅ 本次 e2e 全部通过。（[run](${runUrl})）`);
    } else {
      parts.push(
        `⚠️ e2e 结果为 ${e2eResult}，但没有产出失败 bundle——失败多半在测试启动/环境层（构建、迁移、浏览器安装），先看 [run 日志](${runUrl})。`,
      );
    }
    return parts.join('\n');
  }
  const lead = failures.length > 0 || unitFailures.length > 0 ? '❌' : '⚠️';
  if (unitFailures.length > 0) {
    parts.push(
      `${lead} ${failures.length} 条 e2e 失败${flaky.length > 0 ? ` · ⚠️ ${flaky.length} 条 flaky（重试后通过）` : ''} · 🧪 ${unitFailures.length} 条单测失败（[run](${runUrl}) · trace 在同 run 的 playwright-report / blob-report artifact 里）`,
      '',
    );
  } else {
    parts.push(
      `${lead} ${failures.length} 条失败${flaky.length > 0 ? ` · ⚠️ ${flaky.length} 条 flaky（重试后通过）` : ''}（[run](${runUrl}) · trace 在同 run 的 playwright-report / blob-report artifact 里）`,
      '',
    );
  }
  if (entries.length === 0 && e2eResult !== 'success') {
    parts.push(
      `⚠️ e2e 结果为 ${e2eResult}，但没有产出失败 bundle——失败多半在测试启动/环境层（构建、迁移、浏览器安装），先看 [run 日志](${runUrl})。`,
      '',
    );
  }
  for (const entry of failures) {
    parts.push(renderFailure(entry.record, entry.errorContextText, entry.shardIndex), '');
  }
  if (flaky.length > 0) {
    parts.push('### ⚠️ Flaky（重试后通过，计入台账）', '');
    for (const entry of flaky) {
      parts.push(
        `- \`${entry.record.specFile}\` — ${entry.record.fullTitle}（retry ${entry.record.retry}）：${inlineCode(firstLine(entry.record.errorMessage))}`,
      );
    }
    parts.push('');
  }
  if (unitFailures.length > 0) {
    parts.push(`### 🧪 单测失败（${unitFailures.length} 条，计入台账）`, '');
    for (const unit of unitFailures) {
      parts.push(
        `- \`${unit.specFile}\` — ${unit.fullTitle}（${unit.source}）：${inlineCode(unit.errorMessage)}`,
      );
    }
    parts.push('');
  }
  let body = parts.join('\n');
  if (body.length > MAX_COMMENT_CHARS) {
    body = `${body.slice(0, MAX_COMMENT_CHARS)}\n\n…（摘要超长已截断，完整证据在 failure-bundle artifact 里）`;
  }
  return body;
}

/** Find the digest comment id in a list of { id, body } comments. */
export function findDigestComment(comments) {
  const found = comments.find((c) => typeof c.body === 'string' && c.body.includes(DIGEST_MARKER));
  return found ? found.id : null;
}

/** Read a merged bundle directory into digest entries. */
export async function readBundleDir(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    const bundle = parseBundle(await readFile(path.join(dir, name), 'utf8'));
    for (const record of bundle.failures ?? []) {
      let errorContextText;
      if (record.errorContextFile) {
        try {
          errorContextText = await readFile(path.join(dir, record.errorContextFile), 'utf8');
        } catch {
          errorContextText = undefined;
        }
      }
      entries.push({ record, errorContextText, shardIndex: bundle.shardIndex });
    }
  }
  return entries;
}

/** Ledger row identity: source + caliber + spec + title. Flaky and failure
 * occurrences of the same test are separate rows — the calibers never mix. */
export function ledgerKey({ source, kind, specFile, fullTitle }) {
  return `${source}|${kind}|${specFile}|${fullTitle}`;
}

/** Bundle entries -> ledger additions (e2e source; status decides caliber). */
export function e2eLedgerAdditions(entries) {
  return entries.map(({ record }) => ({
    source: 'e2e',
    specFile: record.specFile,
    fullTitle: record.fullTitle,
    kind: record.status === 'flaky' ? 'flaky' : 'failure',
  }));
}

/** Unit failures -> ledger additions (always the failure caliber). */
export function unitLedgerAdditions(unitFailures) {
  return unitFailures.map((unit) => ({
    source: unit.source,
    specFile: unit.specFile,
    fullTitle: unit.fullTitle,
    kind: 'failure',
  }));
}

function isLedgerRow(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.key === 'string' &&
    typeof value.specFile === 'string' &&
    typeof value.fullTitle === 'string' &&
    typeof value.firstSeen === 'string' &&
    typeof value.lastSeen === 'string' &&
    typeof value.count === 'number'
  );
}

/** Parse the machine-readable ledger state embedded in the issue body. */
export function parseLedgerState(body) {
  if (!body || !body.includes(LEDGER_MARKER)) {
    return [];
  }
  const start = body.indexOf(LEDGER_STATE_PREFIX);
  if (start === -1) {
    return [];
  }
  const jsonStart = start + LEDGER_STATE_PREFIX.length;
  const jsonEnd = body.indexOf(' -->', jsonStart);
  if (jsonEnd === -1) {
    return [];
  }
  try {
    const parsed = JSON.parse(body.slice(jsonStart, jsonEnd));
    return Array.isArray(parsed) ? parsed.filter(isLedgerRow) : [];
  } catch {
    return [];
  }
}

function dayDiff(fromDate, toDate) {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000);
}

function isSilenced(row, today) {
  return dayDiff(row.lastSeen, today) > SILENCE_DAYS;
}

function escapeCell(text) {
  return (text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function kindLabel(row) {
  if (row.source === 'e2e') {
    return row.kind === 'flaky' ? 'e2e · flaky' : 'e2e · 失败';
  }
  return `${row.source} · 失败`;
}

function renderLedgerTable(rows) {
  const lines = [
    '| 条目 | 类型 | 首现 | 最近 | 累计 | 最近 run |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const runCell = row.lastRunUrl ? `[run](${row.lastRunUrl})` : '-';
    lines.push(
      `| \`${escapeCell(row.specFile)}\` — ${escapeCell(row.fullTitle)} | ${kindLabel(row)} | ${row.firstSeen} | ${row.lastSeen} | ${row.count} | ${runCell} |`,
    );
  }
  return lines;
}

/**
 * Render the ledger issue body from rows. The visible tables are derived
 * from the rows; the rows themselves are embedded as JSON in a trailing
 * HTML comment, which is the state the next run increments (the counts in
 * the issue body are the ledger's source of truth).
 */
export function renderLedgerBody(rows, today) {
  const active = rows
    .filter((row) => !isSilenced(row, today))
    .sort(
      (a, b) =>
        b.count - a.count || b.lastSeen.localeCompare(a.lastSeen) || a.key.localeCompare(b.key),
    );
  const silenced = rows
    .filter((row) => isSilenced(row, today))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.key.localeCompare(b.key));
  const parts = [
    LEDGER_MARKER,
    '# 📒 Flake 台账（自动记账）',
    '',
    '本 issue 由 CI 在每次 main push 后自动更新（`scripts/e2e-failure-digest.mjs --ledger`）。只记账：不自动开/关其他 issue、不 @ 任何人；认领与修复走人工。',
    '',
    '口径：e2e flaky = 重试后通过；失败 = 最终失败；单测无重试、只记失败。三者分行计数、不混算。连续 14 天未再出现的条目自动移入「已静默」；再次出现自动回归活跃并继续累计。',
    '',
    '## 活跃条目',
    '',
  ];
  if (active.length > 0) {
    parts.push(...renderLedgerTable(active));
  } else {
    parts.push('（暂无）');
  }
  parts.push('', '## 已静默（连续 14 天未再出现）', '');
  if (silenced.length > 0) {
    parts.push(...renderLedgerTable(silenced));
  } else {
    parts.push('（暂无）');
  }
  const canonical = [...rows].sort((a, b) => a.key.localeCompare(b.key));
  parts.push('', `${LEDGER_STATE_PREFIX}${JSON.stringify(canonical)} -->`);
  return parts.join('\n');
}

/**
 * One ledger update. Pure: (existing body, this run's additions, today,
 * run identity) -> { body, changed, rows } — or null when there is no
 * ledger issue yet and nothing to record (an all-green push must not
 * create an empty ledger). Idempotent per run: an addition whose key was
 * already counted for runId changes nothing, so re-running the same input
 * produces the same body.
 */
export function updateLedger({ existingBody, additions, today, runId, runUrl }) {
  const hasIssue = typeof existingBody === 'string' && existingBody.includes(LEDGER_MARKER);
  if (!hasIssue && additions.length === 0) {
    return null;
  }
  const rows = hasIssue ? parseLedgerState(existingBody) : [];
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const seenThisRun = new Set();
  for (const addition of additions) {
    const key = ledgerKey(addition);
    if (seenThisRun.has(key)) {
      continue;
    }
    seenThisRun.add(key);
    const row = byKey.get(key);
    if (row) {
      if (row.lastRunId === runId) {
        continue;
      }
      row.count += 1;
      row.lastSeen = today;
      row.lastRunId = runId;
      row.lastRunUrl = runUrl;
    } else {
      const created = {
        key,
        source: addition.source,
        kind: addition.kind,
        specFile: addition.specFile,
        fullTitle: addition.fullTitle,
        firstSeen: today,
        lastSeen: today,
        count: 1,
        lastRunId: runId,
        lastRunUrl: runUrl,
      };
      byKey.set(key, created);
      rows.push(created);
    }
  }
  const active = rows.filter((row) => !isSilenced(row, today));
  const silenced = rows
    .filter((row) => isSilenced(row, today))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.key.localeCompare(b.key))
    .slice(0, MAX_SILENCED_ROWS);
  const kept = [...active, ...silenced];
  const body = renderLedgerBody(kept, today);
  return { body, changed: body !== existingBody, rows: kept };
}

/** Find the ledger issue in a list of issues (pull requests excluded). */
export function findLedgerIssue(issues) {
  const found = issues.find(
    (issue) =>
      !issue.pull_request &&
      issue.title === LEDGER_TITLE &&
      typeof issue.body === 'string' &&
      issue.body.includes(LEDGER_MARKER),
  );
  return found ?? null;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--ledger') {
      args.ledger = 'true';
      continue;
    }
    if (key?.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function githubRequest(token, repo, method, apiPath, body) {
  const response = await fetch(`https://api.github.com/repos/${repo}${apiPath}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(
      `GitHub API ${method} ${apiPath} -> ${response.status}: ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : response.json();
}

/** Should the digest be posted as a NEW comment? Failures always post; a
 * green result only updates an existing comment (never creates one — a PR
 * that was never red must not gain a bot comment). */
export function shouldPostNewComment({ entries, e2eResult, unitFailures = [] }) {
  return entries.length > 0 || unitFailures.length > 0 || e2eResult !== 'success';
}

async function runLedger({ args, entries, unitFailures }) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token || !args.repo) {
    throw new Error('GH_TOKEN and --repo are required with --ledger');
  }
  const issues = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = await githubRequest(
      token,
      args.repo,
      'GET',
      `/issues?state=all&per_page=100&page=${page}`,
    );
    issues.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }
  const issue = findLedgerIssue(issues);
  const additions = [...e2eLedgerAdditions(entries), ...unitLedgerAdditions(unitFailures)];
  const result = updateLedger({
    existingBody: issue ? issue.body : undefined,
    additions,
    today: args.date ?? new Date().toISOString().slice(0, 10),
    runId: args['run-id'] ?? '',
    runUrl: args['run-url'] ?? '',
  });
  if (!result) {
    console.log('Ledger: no issue yet and no failures to record; skipping.');
    return;
  }
  if (!issue) {
    const created = await githubRequest(token, args.repo, 'POST', '/issues', {
      title: LEDGER_TITLE,
      body: result.body,
    });
    console.log(`Ledger: created issue ${created.number} (${result.rows.length} rows)`);
  } else if (result.changed) {
    await githubRequest(token, args.repo, 'PATCH', `/issues/${issue.number}`, {
      body: result.body,
    });
    console.log(`Ledger: updated issue ${issue.number} (${result.rows.length} rows)`);
  } else {
    console.log(`Ledger: issue ${issue.number} unchanged.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = await readBundleDir(args.bundles ?? 'failure-bundles-in');
  const unitFailures = await readUnitResultsDir(args['test-results'] ?? 'test-results-in');
  const e2eResult = args['e2e-result'] ?? 'unknown';
  const body = renderDigest({
    entries,
    e2eResult,
    runUrl: args['run-url'] ?? '',
    unitFailures,
  });
  // The same digest always lands in the job step summary when available —
  // on push-to-main runs this is the only surface (there is no PR).
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${body}\n`, 'utf8');
  }
  if (!args.pr) {
    console.log(
      `Summary-only digest (${entries.length} bundle records, ${unitFailures.length} unit failures, e2e ${e2eResult})`,
    );
    if (args.ledger) {
      await runLedger({ args, entries, unitFailures });
    }
    return;
  }
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token || !args.repo) {
    throw new Error('GH_TOKEN and --repo are required when --pr is given');
  }
  const comments = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = await githubRequest(
      token,
      args.repo,
      'GET',
      `/issues/${args.pr}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }
  const existingId = findDigestComment(comments);
  if (existingId !== null) {
    await githubRequest(token, args.repo, 'PATCH', `/issues/comments/${existingId}`, { body });
    console.log(`Updated digest comment ${existingId} (${entries.length} bundle records)`);
  } else if (shouldPostNewComment({ entries, e2eResult, unitFailures })) {
    const created = await githubRequest(token, args.repo, 'POST', `/issues/${args.pr}/comments`, {
      body,
    });
    console.log(`Created digest comment ${created.id} (${entries.length} bundle records)`);
  } else {
    console.log('E2E green and no prior digest comment; not posting (no comment spam).');
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
