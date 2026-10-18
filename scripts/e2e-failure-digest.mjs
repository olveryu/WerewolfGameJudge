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
 * The pure rendering functions are exported for scripts/e2e-failure-digest.test.mjs.
 */
import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIGEST_MARKER = '<!-- e2e-failure-digest -->';
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

/**
 * Render the full digest comment body.
 * entries: [{ record, errorContextText }] — hard failures and flaky mixed;
 * they are separated here by record.status.
 */
export function renderDigest({ entries, e2eResult, runUrl }) {
  const failures = entries.filter((e) => e.record.status !== 'flaky');
  const flaky = entries.filter((e) => e.record.status === 'flaky');
  const parts = [DIGEST_MARKER, '## E2E 失败摘要', ''];
  if (failures.length === 0 && flaky.length === 0) {
    if (e2eResult === 'success') {
      parts.push(`✅ 本次 e2e 全部通过。（[run](${runUrl})）`);
    } else {
      parts.push(
        `⚠️ e2e 结果为 ${e2eResult}，但没有产出失败 bundle——失败多半在测试启动/环境层（构建、迁移、浏览器安装），先看 [run 日志](${runUrl})。`,
      );
    }
    return parts.join('\n');
  }
  const lead = failures.length > 0 ? '❌' : '⚠️';
  parts.push(
    `${lead} ${failures.length} 条失败${flaky.length > 0 ? ` · ⚠️ ${flaky.length} 条 flaky（重试后通过）` : ''}（[run](${runUrl}) · trace 在同 run 的 playwright-report / blob-report artifact 里）`,
    '',
  );
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

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (key?.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1];
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
export function shouldPostNewComment({ entries, e2eResult }) {
  return entries.length > 0 || e2eResult !== 'success';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = await readBundleDir(args.bundles ?? 'failure-bundles-in');
  const e2eResult = args['e2e-result'] ?? 'unknown';
  const body = renderDigest({
    entries,
    e2eResult,
    runUrl: args['run-url'] ?? '',
  });
  // The same digest always lands in the job step summary when available —
  // on push-to-main runs this is the only surface (there is no PR).
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${body}\n`, 'utf8');
  }
  if (!args.pr) {
    console.log(`Summary-only digest (${entries.length} bundle records, e2e ${e2eResult})`);
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
  } else if (shouldPostNewComment({ entries, e2eResult })) {
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
