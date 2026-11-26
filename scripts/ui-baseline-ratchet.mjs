#!/usr/bin/env node
/**
 * UI baseline ratchet: the recorded lint debt is exact and only ever shrinks.
 *
 * 1. Exact: Stylelint runs here without suppressions, and its per-file, per-rule counts must equal
 *    `stylelint-suppressions.json` entry for entry. Fixing a violation without shrinking the record
 *    fails, so the record never holds slack that a new violation could hide in. (ESLint checks its
 *    own record for files it lints — an unused suppression makes `eslint` exit 2 — so the ratchet
 *    only rejects ESLint entries for files ESLint never visits.)
 * 2. Shrink only: compared with the base revision, no entry gains count, and an entry is new only
 *    where its rule did not apply to that file at the base — the PR that introduces a rule (or
 *    brings a file under it) records the rule's existing debt; nothing else can. A renamed file
 *    keeps its entries under the new path (`git diff -M`).
 * 3. No gate disables: no `eslint-disable` comment in the web client names a gate rule or names no
 *    rule (`scripts/ui-lint/disableDirectives.mjs`). Stylelint ignores disable comments outright.
 *
 * Base: `--base <rev>` when given; `HEAD^1` in CI (a pull request checks out its merge commit, whose
 * first parent is main; a push to main compares with the previous main); otherwise
 * `git merge-base HEAD origin/main`.
 *
 * Fix a failure by fixing the violation, then `pnpm run lint:css:baseline` (Stylelint: rewrites the
 * record from Stylelint's counts, dropping renamed and deleted paths) or
 * `pnpm exec eslint <files> --prune-suppressions` (ESLint) to shrink the record.
 *
 * Options: `--base <rev>`; `--write` rewrites `stylelint-suppressions.json` to the current counts
 * and exits (the shrink-only check still runs in the gate).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';
import { globSync } from 'glob';
import stylelint from 'stylelint';

import { gateDisableDirectives } from './ui-lint/disableDirectives.mjs';

export const STYLELINT_SUPPRESSIONS = 'stylelint-suppressions.json';
export const ESLINT_SUPPRESSIONS = 'eslint-suppressions.json';
export const STYLELINT_FILES = 'packages/web/src/**/*.css';
export const DIRECTIVE_FILES = 'packages/web/src/**/*.{ts,tsx,js,jsx,mjs,cjs}';
/** What a base revision's lint configuration needs in order to load outside the work tree. */
const CONFIG_PATHS = ['package.json', 'stylelint.config.mjs', 'eslint.config.mjs', 'scripts'];

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function resolveBase(cwd, explicit) {
  if (explicit !== undefined) return explicit;
  if (process.env.CI) return 'HEAD^1';
  try {
    return git(['merge-base', 'HEAD', 'origin/main'], cwd).trim();
  } catch (error) {
    throw new Error(
      `UI baseline ratchet: no merge base with origin/main (${String(error.stderr ?? error.message).trim()}). Fetch origin/main or pass --base <rev>.`,
    );
  }
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

/**
 * Entries of `current` that are larger than in `base`, or new although their rule already applied
 * to the file at the base (`appliedAtBase(baseFile, rule)`; by default every rule did).
 */
export async function growth(current, base, renames = new Map(), appliedAtBase = async () => true) {
  const problems = [];
  for (const [file, rules] of Object.entries(current)) {
    const baseFile = renames.get(file) ?? file;
    const baseRules = base[baseFile] ?? {};
    for (const [rule, { count }] of Object.entries(rules)) {
      const before = baseRules[rule]?.count ?? 0;
      if (before === 0) {
        if (await appliedAtBase(baseFile, rule)) {
          problems.push(`${file} → ${rule}: new entry (${count}) for a rule that already applied`);
        }
      } else if (count > before) {
        problems.push(`${file} → ${rule}: ${before} → ${count}`);
      }
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

/** The record Stylelint's counts imply, sorted for a stable diff. */
export function recordFrom(counts) {
  const record = {};
  for (const file of Object.keys(counts).sort()) {
    record[file] = {};
    for (const rule of Object.keys(counts[file]).sort()) record[file][rule] = counts[file][rule];
  }
  return record;
}

function isEnabled(setting) {
  if (setting === undefined || setting === null || setting === false) return false;
  const severity = Array.isArray(setting) ? setting[0] : setting;
  return severity !== 0 && severity !== 'off' && severity !== null && severity !== false;
}

/**
 * Loads the base revision's lint configuration in a scratch directory (its own config files and
 * scripts, this checkout's node_modules) and answers whether a rule applied to a file there.
 * With no Stylelint config at the base, no Stylelint rule applied.
 */
async function baseRuleLookup(cwd, base, scratch) {
  const present = CONFIG_PATHS.filter((entry) => existsAtBase(cwd, base, entry));
  if (present.length > 0) {
    const archive = execFileSync('git', ['archive', base, '--', ...present], {
      cwd,
      maxBuffer: 256 * 1024 * 1024,
    });
    execFileSync('tar', ['-x', '-C', scratch], { input: archive });
  }
  fs.symlinkSync(path.join(cwd, 'node_modules'), path.join(scratch, 'node_modules'), 'dir');
  const hasStylelint = present.includes('stylelint.config.mjs');
  const hasEslint = present.includes('eslint.config.mjs');
  const eslint = hasEslint ? new ESLint({ cwd: scratch }) : undefined;
  return {
    hasStylelint,
    async stylelint(file, rule) {
      if (!hasStylelint) return false;
      const config = await stylelint.resolveConfig(path.join(scratch, file), { cwd: scratch });
      return isEnabled(config?.rules?.[rule]);
    },
    async eslint(file, rule) {
      if (eslint === undefined) return false;
      const config = await eslint.calculateConfigForFile(path.join(scratch, file));
      return isEnabled(config?.rules?.[rule]);
    },
  };
}

/** Gate disable directives in the web client's sources. */
export function disableDirectiveProblems(cwd) {
  const problems = [];
  for (const file of globSync(DIRECTIVE_FILES, { cwd, nodir: true }).sort()) {
    for (const { line, text } of gateDisableDirectives(
      fs.readFileSync(path.join(cwd, file), 'utf8'),
    )) {
      problems.push(`${file}:${line}: ${text}`);
    }
  }
  return problems;
}

async function main() {
  const cwd = process.cwd();
  const baseFlag = process.argv.indexOf('--base');
  const counts = await stylelintCounts(cwd);
  if (process.argv.includes('--write')) {
    const record = `${JSON.stringify(recordFrom(counts), null, 2)}\n`;
    fs.writeFileSync(path.join(cwd, STYLELINT_SUPPRESSIONS), record);
    console.log(`Wrote ${STYLELINT_SUPPRESSIONS} from Stylelint's current counts.`);
    return;
  }
  const base = resolveBase(cwd, baseFlag === -1 ? undefined : process.argv[baseFlag + 1]);
  const failures = [];

  const exact = mismatches(readRecord(cwd, STYLELINT_SUPPRESSIONS), counts);
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

  const directives = disableDirectiveProblems(cwd);
  if (directives.length > 0) {
    failures.push(
      'eslint-disable comments may not switch off UI gate rules (fix the code or record the debt):',
      ...directives,
    );
  }

  const renames = renamesSince(cwd, base);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-baseline-base-'));
  try {
    const lookup = await baseRuleLookup(cwd, base, scratch);
    if (!lookup.hasStylelint) {
      console.warn(
        `UI baseline ratchet: ${base} has no Stylelint config, so every recorded entry counts as new debt of a new rule. If origin/main is stale, fetch it first.`,
      );
    }
    for (const [file, applied] of [
      [STYLELINT_SUPPRESSIONS, lookup.stylelint],
      [ESLINT_SUPPRESSIONS, lookup.eslint],
    ]) {
      const baseRecord = readBaseRecord(cwd, base, file) ?? {};
      const grown = await growth(readRecord(cwd, file), baseRecord, renames, applied);
      if (grown.length > 0) {
        failures.push(`${file} grew since ${base} (the record only shrinks):`, ...grown);
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
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
