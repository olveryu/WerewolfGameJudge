#!/usr/bin/env node
/**
 * UI baseline ratchet: the recorded lint debt is exact and only ever shrinks.
 *
 * 1. Exact: Stylelint runs here (through `ui-lint/styleGate.mjs`: the root config, every
 *    stylesheet, no suppressions) and its violation fingerprints must equal `ui-style-baseline.json`
 *    as a multiset, file by file and rule by rule. Fixing a violation without shrinking the record
 *    fails, so the record never holds slack a new violation could hide in, and a fixed literal
 *    cannot be traded for a new one in the same file. The scope and configuration checks of
 *    `styleGate.mjs` run here too. (ESLint checks its own record for files it lints — an unused
 *    suppression makes `eslint` exit 2 — so the ratchet only rejects ESLint entries for files
 *    ESLint never visits.)
 * 2. Shrink only: compared with the base revision, no fingerprint (Stylelint) or count (ESLint)
 *    grows, and an entry is new only where its rule did not apply to that file at the base — the
 *    PR that introduces a rule (or brings a file under it) records the rule's existing debt;
 *    nothing else can. A renamed file keeps its entries under the new path (`git diff -M`).
 * 3. No gate disables: no inline comment in the web client disables a gate rule, disables every
 *    rule, or configures a gate rule (`scripts/ui-lint/disableDirectives.mjs`, which reads
 *    comments with ESLint's own parser). Stylelint ignores disable comments outright.
 *
 * Base: `--base <rev>` when given; `HEAD^1` for a pull request or push in CI (a pull request checks
 * out its merge commit, whose first parent is main; a push to main compares with the previous
 * main); otherwise, including a manual CI dispatch, `git merge-base HEAD origin/main`.
 *
 * Fix a failure by fixing the violation, then `pnpm run lint:css:baseline` (Stylelint: rewrites the
 * record from the current fingerprints, dropping renamed and deleted paths) or
 * `pnpm exec eslint <files> --prune-suppressions` (ESLint) to shrink the record.
 *
 * Options: `--base <rev>`; `--write` rewrites `ui-style-baseline.json` to the current
 * fingerprints and exits (the shrink-only check still runs in the gate).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';
import stylelint from 'stylelint';

import { gateDisableDirectives } from './ui-lint/disableDirectives.mjs';
import {
  baselineFrom,
  checkAllStyles,
  knownFiles,
  mismatches,
  parseBaseline,
  readBaseline,
  STYLE_BASELINE,
  STYLELINT_CONFIG,
} from './ui-lint/styleGate.mjs';
import { BUNDLED_SOURCE_ROOTS, SCRIPT_FILE, WEB_PACKAGE } from './ui-lint/scope.mjs';

export const ESLINT_SUPPRESSIONS = 'eslint-suppressions.json';
/** What a base revision's lint configuration needs in order to load outside the work tree. */
const CONFIG_PATHS = ['package.json', 'stylelint.config.mjs', 'eslint.config.mjs', 'scripts'];

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function resolveBase(cwd, explicit) {
  if (explicit !== undefined) return explicit;
  // A manual dispatch checks out a branch head, whose first parent is not main.
  if (process.env.CI && process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch') return 'HEAD^1';
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

function readBaseRecord(cwd, base, file, parse) {
  try {
    return parse(git(['show', `${base}:${file}`], cwd), `${base}:${file}`);
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
  let diff;
  try {
    diff = git(['diff', '-M', '--name-status', base, '--'], cwd);
  } catch (error) {
    throw new Error(
      `UI baseline ratchet: cannot compare with base ${base} (${String(error.stderr ?? error.message).trim()}). Pass --base <rev> naming a commit this checkout has.`,
    );
  }
  for (const line of diff.split('\n')) {
    const [status, from, to] = line.split('\t');
    if (status?.startsWith('R') && from && to) renames.set(to, from);
  }
  return renames;
}

/** An entry as a multiset: Stylelint fingerprints, or an ESLint count under one blank key. */
function tallyOf(entry) {
  const counts = new Map();
  if (entry === undefined) return counts;
  if (Array.isArray(entry)) {
    for (const print of entry) counts.set(print, (counts.get(print) ?? 0) + 1);
  } else {
    counts.set('', entry.count);
  }
  return counts;
}

/**
 * What in `current` grew beyond `base`: a fingerprint recorded more often (or an ESLint count
 * that rose), or an entry that is new although its rule already applied to the file at the base
 * (`appliedAtBase(baseFile, rule)`; by default every rule did).
 */
export async function growth(current, base, renames = new Map(), appliedAtBase = async () => true) {
  const problems = [];
  for (const [file, rules] of Object.entries(current)) {
    const baseFile = renames.get(file) ?? file;
    const baseRules = base[baseFile] ?? {};
    for (const [rule, entry] of Object.entries(rules)) {
      const before = tallyOf(baseRules[rule]);
      if (before.size === 0) {
        if (await appliedAtBase(baseFile, rule)) {
          const size = Array.isArray(entry) ? entry.length : entry.count;
          problems.push(`${file} → ${rule}: new entry (${size}) for a rule that already applied`);
        }
        continue;
      }
      for (const [key, count] of tallyOf(entry)) {
        const had = before.get(key) ?? 0;
        if (count <= had) continue;
        problems.push(
          key === '' ? `${file} → ${rule}: ${had} → ${count}` : `${file} → ${rule}: new ${key}`,
        );
      }
    }
  }
  return problems;
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
  const hasStylelint = present.includes(STYLELINT_CONFIG);
  const hasEslint = present.includes('eslint.config.mjs');
  const eslint = hasEslint ? new ESLint({ cwd: scratch }) : undefined;
  return {
    hasStylelint,
    async stylelint(file, rule) {
      if (!hasStylelint) return false;
      const config = await stylelint.resolveConfig(path.join(scratch, file), {
        cwd: scratch,
        configFile: path.join(scratch, STYLELINT_CONFIG),
      });
      return isEnabled(config?.rules?.[rule]);
    },
    async eslint(file, rule) {
      if (eslint === undefined) return false;
      const config = await eslint.calculateConfigForFile(path.join(scratch, file));
      return isEnabled(config?.rules?.[rule]);
    },
  };
}

/** Gate directive comments in every script ESLint lints where the UI gate applies. */
export async function disableDirectiveProblems(cwd) {
  const eslint = new ESLint({ cwd });
  const problems = [];
  const roots = [
    WEB_PACKAGE,
    ...BUNDLED_SOURCE_ROOTS.filter((root) => !root.startsWith(`${WEB_PACKAGE}/`)),
  ];
  const files = roots.flatMap((root) => knownFiles(cwd, root));
  for (const file of files.filter((name) => SCRIPT_FILE.test(name))) {
    if (await eslint.isPathIgnored(file)) continue;
    const source = fs.readFileSync(path.join(cwd, file), 'utf8');
    // Every directive comment spells `eslint` literally (comments carry no escapes), so a file
    // without that word has none and needs no parse.
    if (!source.includes('eslint')) continue;
    for (const { line, text } of gateDisableDirectives(source, file)) {
      problems.push(`${file}:${line}: ${text}`);
    }
  }
  return problems;
}

async function main() {
  const cwd = process.cwd();
  const baseFlag = process.argv.indexOf('--base');
  const styles = await checkAllStyles(cwd);
  if (process.argv.includes('--write')) {
    const record = `${JSON.stringify(baselineFrom(styles.found), null, 2)}\n`;
    fs.writeFileSync(path.join(cwd, STYLE_BASELINE), record);
    console.log(`Wrote ${STYLE_BASELINE} from the current Stylelint fingerprints.`);
    if (styles.problems.length > 0) {
      console.error(['The CSS gate scope has problems:', ...styles.problems].join('\n'));
      process.exitCode = 1;
    }
    return;
  }
  const base = resolveBase(cwd, baseFlag === -1 ? undefined : process.argv[baseFlag + 1]);
  const failures = [];

  if (styles.problems.length > 0) {
    failures.push('The CSS gate scope or configuration is not closed:', ...styles.problems);
  }

  const exact = mismatches(readBaseline(cwd), styles.found);
  if (exact.length > 0) {
    failures.push(
      `${STYLE_BASELINE} does not match Stylelint (fix new violations; after fixing old ones run \`pnpm run lint:css:baseline\`):`,
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

  const directives = await disableDirectiveProblems(cwd);
  if (directives.length > 0) {
    failures.push(
      'Inline comments may not disable or configure UI gate rules (fix the code or record the debt):',
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
    for (const [file, parse, current, applied] of [
      [STYLE_BASELINE, parseBaseline, readBaseline(cwd), lookup.stylelint],
      [ESLINT_SUPPRESSIONS, parseRecord, readRecord(cwd, ESLINT_SUPPRESSIONS), lookup.eslint],
    ]) {
      const baseRecord = readBaseRecord(cwd, base, file, parse) ?? {};
      const grown = await growth(current, baseRecord, renames, applied);
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
