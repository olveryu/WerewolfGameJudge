#!/usr/bin/env node
/**
 * UI baseline ratchet: the recorded lint debt is exact and only ever shrinks.
 *
 * 1. Exact: Stylelint runs here without suppressions, and its per-file, per-rule counts must equal
 *    `stylelint-suppressions.json` entry for entry. Fixing a violation without shrinking the record
 *    fails, so the record never holds slack that a new violation could hide in. (ESLint checks its
 *    own record: an unused suppression makes `eslint .` fail.)
 * 2. Shrink only: compared with the base revision, no suppression file gains an entry and no entry
 *    gains count. A renamed file keeps its entries under the new path (`git diff -M`).
 *
 * Base: `--base <rev>` when given; `HEAD^1` in CI (a pull request checks out its merge commit, whose
 * first parent is main; a push to main compares with the previous main); otherwise
 * `git merge-base HEAD origin/main`.
 *
 * Fix a failure by fixing the violation, then `pnpm run lint:css:baseline` (Stylelint) or
 * `pnpm exec eslint . --prune-suppressions` (ESLint) to shrink the record.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';
import stylelint from 'stylelint';

export const STYLELINT_SUPPRESSIONS = 'stylelint-suppressions.json';
export const ESLINT_SUPPRESSIONS = 'eslint-suppressions.json';
export const STYLELINT_FILES = 'packages/web/src/**/*.css';
const RATCHET_SCRIPT = 'scripts/ui-baseline-ratchet.mjs';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function resolveBase(cwd, explicit) {
  if (explicit !== undefined) return explicit;
  if (process.env.CI) return 'HEAD^1';
  return git(['merge-base', 'HEAD', 'origin/main'], cwd).trim();
}

/** Reads a suppressions record (`{ file: { rule: { count } } }`); a missing file is empty. */
function parseRecord(text, label) {
  const parsed = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}: expected an object of files`);
  }
  for (const [file, rules] of Object.entries(parsed)) {
    for (const [rule, entry] of Object.entries(rules)) {
      if (!Number.isInteger(entry?.count) || entry.count < 1) {
        throw new Error(`${label}: ${file} → ${rule} needs a positive integer count`);
      }
    }
  }
  return parsed;
}

function readRecord(cwd, file) {
  const full = path.join(cwd, file);
  return fs.existsSync(full) ? parseRecord(fs.readFileSync(full, 'utf8'), file) : {};
}

function readBaseRecord(cwd, base, file) {
  try {
    return parseRecord(git(['show', `${base}:${file}`], cwd), `${base}:${file}`);
  } catch (error) {
    if (/does not exist|exists on disk, but not in/.test(String(error.stderr ?? error.message))) {
      return undefined;
    }
    throw error;
  }
}

function existsAtBase(cwd, base, file) {
  try {
    git(['cat-file', '-e', `${base}:${file}`], cwd);
    return true;
  } catch {
    return false;
  }
}

/** Maps each path renamed since `base` (committed or in the working tree) to its base path. */
function renamesSince(cwd, base) {
  const renames = new Map();
  for (const line of git(['diff', '-M', '--name-status', base, '--'], cwd).split('\n')) {
    const [status, from, to] = line.split('\t');
    if (status?.startsWith('R') && from && to) renames.set(to, from);
  }
  return renames;
}

/** Entries of `current` that are new or larger than in `base`. */
export function growth(current, base, renames = new Map()) {
  const problems = [];
  for (const [file, rules] of Object.entries(current)) {
    const baseRules = base[renames.get(file) ?? file] ?? {};
    for (const [rule, { count }] of Object.entries(rules)) {
      const before = baseRules[rule]?.count ?? 0;
      if (before === 0) problems.push(`${file} → ${rule}: new entry (${count})`);
      else if (count > before) problems.push(`${file} → ${rule}: ${before} → ${count}`);
    }
  }
  return problems;
}

/** Differences between the recorded counts and the counts Stylelint reports now. */
export function mismatches(recorded, actual) {
  const problems = [];
  const files = new Set([...Object.keys(recorded), ...Object.keys(actual)]);
  for (const file of [...files].sort()) {
    const rules = new Set([
      ...Object.keys(recorded[file] ?? {}),
      ...Object.keys(actual[file] ?? {}),
    ]);
    for (const rule of [...rules].sort()) {
      const want = recorded[file]?.[rule]?.count ?? 0;
      const have = actual[file]?.[rule]?.count ?? 0;
      if (want !== have) problems.push(`${file} → ${rule}: recorded ${want}, found ${have}`);
    }
  }
  return problems;
}

/**
 * Stylelint's own counts, unsuppressed. File runs always apply a suppressions file (the default
 * name in `cwd` if none is given), so this run points at an empty one.
 */
export async function stylelintCounts(cwd) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-baseline-ratchet-'));
  const noSuppressions = path.join(scratch, 'none.json');
  fs.writeFileSync(noSuppressions, '{}');
  let results;
  try {
    ({ results } = await stylelint.lint({
      files: STYLELINT_FILES,
      cwd,
      suppressLocation: noSuppressions,
    }));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const counts = {};
  for (const result of results) {
    if (result.source === undefined) continue;
    const file = path.relative(cwd, result.source).split(path.sep).join('/');
    for (const warning of result.warnings) {
      const rules = (counts[file] ??= {});
      rules[warning.rule] = { count: (rules[warning.rule]?.count ?? 0) + 1 };
    }
  }
  return counts;
}

/** ESLint entries for files ESLint never visits: deleted, moved without the record, or ignored. */
export async function unvisitedEslintEntries(cwd, record) {
  const eslint = new ESLint({ cwd });
  const problems = [];
  for (const file of Object.keys(record).sort()) {
    if (!fs.existsSync(path.join(cwd, file))) problems.push(`${file}: file does not exist`);
    else if (await eslint.isPathIgnored(file)) problems.push(`${file}: file is not linted`);
  }
  return problems;
}

async function main() {
  const cwd = process.cwd();
  const baseFlag = process.argv.indexOf('--base');
  const base = resolveBase(cwd, baseFlag === -1 ? undefined : process.argv[baseFlag + 1]);
  const failures = [];

  const exact = mismatches(readRecord(cwd, STYLELINT_SUPPRESSIONS), await stylelintCounts(cwd));
  if (exact.length > 0) {
    failures.push(
      `${STYLELINT_SUPPRESSIONS} does not match Stylelint (fix new violations; after fixing old ones run \`pnpm run lint:css:baseline\`):`,
      ...exact,
    );
  }

  const unvisited = await unvisitedEslintEntries(cwd, readRecord(cwd, ESLINT_SUPPRESSIONS));
  if (unvisited.length > 0) {
    failures.push(
      `${ESLINT_SUPPRESSIONS} holds entries ESLint never checks (run \`pnpm exec eslint . --prune-suppressions\`):`,
      ...unvisited,
    );
  }

  // A record missing at the base is an empty record: debt can be recorded only while the record
  // is first introduced, i.e. against a base from before this ratchet existed.
  const bootstrapping = !existsAtBase(cwd, base, RATCHET_SCRIPT);
  const renames = renamesSince(cwd, base);
  for (const file of [STYLELINT_SUPPRESSIONS, ESLINT_SUPPRESSIONS]) {
    const baseRecord = readBaseRecord(cwd, base, file);
    if (baseRecord === undefined && bootstrapping) continue;
    const grown = growth(readRecord(cwd, file), baseRecord ?? {}, renames);
    if (grown.length > 0) {
      failures.push(`${file} grew since ${base} (the record only shrinks):`, ...grown);
    }
  }

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`UI baseline ratchet: records exact and not grown since ${base}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
