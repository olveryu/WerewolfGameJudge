#!/usr/bin/env node
/**
 * The UI gate (UI drift lock plan v3, §3): `pnpm run lint:ui`.
 *
 * 1. Compute the bundle graph (`bundle.mjs`); any graph problem fails the gate.
 * 2. Lint the graph's stylesheets with `stylelint.gate.mjs` and its scripts with `eslint.gate.mjs`
 *    (own configurations only, inline disables ignored).
 * 3. Turn every violation into a fingerprint and compare. A fingerprint is the violation's
 *    identity in code: rule ID, message ID (ESLint; Stylelint has none), where in the file it
 *    sits (enclosing selectors and at-rules, or elements, functions and keys; `context.mjs`) and
 *    the source lines it spans, each trimmed. A TSX value is read only where it is written
 *    (plan v3.12 D15), so those lines are the value. The message text is not part of it, so
 *    rewording a message records no new debt (P1 QA7 F2); renaming a message ID is renaming part
 *    of a rule's identity.
 *    - exactly equal to `ui-gate-baseline.json` (a fixed violation must shrink the baseline);
 *    - no fingerprint beyond the baseline at the comparison base (renames followed); a rule the
 *      base baseline does not list yet records exactly what it finds on the base tree.
 *
 * `--write` rewrites the baseline from the current result. `--styles` checks only the graph and
 * the stylesheets (lint-staged); file arguments after it are ignored, the whole graph is checked.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ESLint } from 'eslint';
import stylelint from 'stylelint';

import { bundleGraph, REPO_ROOT } from './bundle.mjs';
import { scriptContext, styleContext } from './context.mjs';
import { gateConfig } from './eslint.gate.mjs';
import stylelintConfig from './stylelint.gate.mjs';

export const BASELINE_FILE = 'ui-gate-baseline.json';

/**
 * The source text of lines `line` to `endLine`, each trimmed, joined by one space: a report
 * whose value spans several lines is identified by all of them (P1 QA10 FIX-FIRST-1).
 */
function span(rule, lines, line, endLine, file) {
  // A reported range outside the file is a linter or rule bug, never an empty fingerprint.
  if (
    !Number.isInteger(line) ||
    !Number.isInteger(endLine) ||
    line < 1 ||
    endLine < line ||
    endLine > lines.length
  )
    throw new Error(
      `UI gate: ${rule} reported lines ${line}-${endLine} of ${file} (${lines.length} lines)`,
    );
  return lines
    .slice(line - 1, endLine)
    .map((text) => text.trim())
    .join(' ');
}

/** Rule ID, message ID, where in the file (`context.mjs`), then the reported source lines. */
function fingerprint(rule, messageId, lines, { line, endLine = line }, file, where) {
  return `${rule}\t${messageId}\t${where}\t${span(rule, lines, line, endLine, file)}`;
}

/** The context lookup of a file's text, parsed once per text. */
const contexts = new Map();
function contextOf(root, file, kind) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const cacheKey = `${kind}\u0000${path.join(root, file)}\u0000${text}`;
  if (!contexts.has(cacheKey))
    contexts.set(cacheKey, (kind === 'style' ? styleContext : scriptContext)(text, file));
  return contexts.get(cacheKey);
}

/** Where and why each current fingerprint was reported, for the failure output (P1 QA7 S1). */
function remember(reports, file, key, line, message) {
  const list = reports.get(`${file}\t${key}`) ?? [];
  list.push(`${file}:${line}: ${message}`);
  reports.set(`${file}\t${key}`, list);
}

/** The fingerprint of one ESLint report: rule ID, message ID, where it sits, the lines it spans. */
export function scriptKey(root, file, lines, message) {
  // Every rule of the gate configuration reports through `messages` (message IDs).
  if (message.messageId === undefined)
    throw new Error(`UI gate: ${message.ruleId} reported without a message ID in ${file}`);
  const endLine = message.endLine ?? message.line;
  const where = contextOf(root, file, 'script')(message.line, message.column);
  return fingerprint(
    message.ruleId,
    message.messageId,
    lines,
    { line: message.line, endLine },
    file,
    where,
  );
}

function readLines(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8').split('\n');
}

function add(result, file, value) {
  (result[file] ??= []).push(value);
}

function sortFiles(files) {
  return Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((file) => [file, [...files[file]].sort()]),
  );
}

/**
 * Lint the graph; returns `{ problems, rules, files, reports, graph }` (`reports`: for each
 * `file\tfingerprint`, the `file:line: message` of its occurrences). `only` (repository-relative
 * paths) narrows the linted files to those of the graph it names; the scope stays the graph.
 */
export async function runGate({ root = REPO_ROOT, styles = true, scripts = true, only } = {}) {
  const graph = bundleGraph(root);
  const pick = (list) => (only ? list.filter((file) => only.has(file)) : list);
  const files = {};
  const reports = new Map();
  const rules = new Set();
  if (styles) {
    for (const rule of Object.keys(stylelintConfig.rules)) rules.add(rule);
    for (const override of stylelintConfig.overrides)
      for (const rule of Object.keys(override.rules)) rules.add(rule);
    const { results } = await stylelint.lint({
      files: pick(graph.styles).map((file) => path.join(root, file)),
      config: stylelintConfig,
      configBasedir: root,
    });
    for (const result of results) {
      const file = path.relative(root, result.source).split(path.sep).join('/');
      if (result.ignored) graph.problems.push(`${file}: Stylelint ignored this stylesheet`);
      // Stylelint always returns both lists; an invalid rule option or a PostCSS parse message
      // means the stylesheet was not linted as configured.
      for (const warning of [...result.invalidOptionWarnings, ...result.parseErrors])
        graph.problems.push(`${file}: ${warning.text}`);
      const lines = readLines(root, file);
      for (const warning of result.warnings) {
        // A stylesheet that does not parse is not linted past the error: never a baseline entry.
        if (warning.rule === 'CssSyntaxError')
          graph.problems.push(`${file}:${warning.line}: ${warning.text}`);
        else {
          const key = fingerprint(
            warning.rule,
            '',
            lines,
            { line: warning.line, endLine: warning.endLine ?? warning.line },
            file,
            contextOf(root, file, 'style')(warning.line, warning.column),
          );
          add(files, file, key);
          // Stylelint ends its text with ` (rule)`; the failure output names the rule once.
          remember(
            reports,
            file,
            key,
            warning.line,
            warning.text.replace(` (${warning.rule})`, ''),
          );
        }
      }
    }
  }
  if (scripts) {
    const config = gateConfig(root);
    for (const rule of Object.keys(config[0].rules)) rules.add(rule);
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: config,
      allowInlineConfig: false,
    });
    const results = await eslint.lintFiles(
      pick(graph.scripts).map((file) => path.join(root, file)),
    );
    for (const result of results) {
      const file = path.relative(root, result.filePath).split(path.sep).join('/');
      const lines = readLines(root, file);
      for (const message of result.messages) {
        if (message.ruleId === null)
          graph.problems.push(`${file}:${message.line}: ${message.message}`);
        else {
          const key = scriptKey(root, file, lines, message);
          add(files, file, key);
          remember(reports, file, key, message.line, message.message);
        }
      }
    }
  }
  return {
    problems: graph.problems,
    rules: [...rules].sort(),
    files: sortFiles(files),
    reports,
    graph,
  };
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * The commit the baseline may only shrink against (§3): `UI_GATE_BASE` in CI (the PR's base
 * parent `HEAD^1`, a push's `github.event.before`), the merge base with `origin/main` locally.
 * A base that cannot be found is an error, never an empty baseline.
 */
export function comparisonBase(root, env = process.env) {
  const configured = env.UI_GATE_BASE;
  if (configured) {
    if (/^0+$/.test(configured)) throw new Error('UI gate: UI_GATE_BASE is the zero SHA');
    return git(root, ['rev-parse', '--verify', `${configured}^{commit}`]).trim();
  }
  if (env.GITHUB_ACTIONS) throw new Error('UI gate: CI must set UI_GATE_BASE');
  return git(root, ['merge-base', 'HEAD', 'origin/main']).trim();
}

/** The baseline at `commit`: empty only when the commit exists and has no baseline file. */
export function baselineAt(root, commit) {
  git(root, ['cat-file', '-e', `${commit}^{commit}`]);
  if (git(root, ['ls-tree', '--name-only', commit, '--', BASELINE_FILE]).trim() === '')
    return { rules: [], files: {} };
  return JSON.parse(git(root, ['show', `${commit}:${BASELINE_FILE}`]));
}

export function renamesSince(root, commit) {
  const renames = new Map();
  for (const line of git(root, ['diff', '-M', '--name-status', commit, '--']).split('\n')) {
    if (line === '') continue;
    const [status, from, to] = line.split('\t');
    if (status.startsWith('R')) renames.set(from, to);
  }
  return renames;
}

const counts = (list) =>
  list.reduce((map, item) => map.set(item, (map.get(item) ?? 0) + 1), new Map());

/** Differences between two `files` maps: `[file, fingerprint, delta]` where counts differ. */
export function differences(left, right) {
  const out = [];
  for (const file of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const a = counts(left[file] ?? []);
    const b = counts(right[file] ?? []);
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const delta = (a.get(key) ?? 0) - (b.get(key) ?? 0);
      if (delta !== 0) out.push([file, key, delta]);
    }
  }
  return out;
}

/** Signals that end a gate run before its `finally` runs; SIGKILL cannot be caught. */
const INTERRUPTS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/**
 * The current gate's findings on the tree of `commit`, for the rules the base baseline does not
 * list yet: what debt a new rule may record is measured by running it on the base, never by
 * matching text (P1 QA11 F1). The tree is a detached worktree beside the repository with the
 * dependency directories linked in; it is removed afterwards, and when an interrupt ends the run
 * it is removed before the process ends with that signal (P1 QA12 nit 6). `measure` is the gate
 * run on the tree; tests replace it.
 */
export async function findingsAt(root, commit, rules, measure = (tree) => runGate({ root: tree })) {
  const dependencyDirs = [
    'node_modules',
    ...fs.readdirSync(path.join(root, 'packages')).map((name) => `packages/${name}/node_modules`),
  ];
  const tree = fs.mkdtempSync(path.join(path.dirname(root), '.ui-gate-base-'));
  fs.rmdirSync(tree);
  const remove = () => git(root, ['worktree', 'remove', '--force', tree]);
  const interrupted = (signal) => {
    process.stderr.write(`UI gate: ${signal} while measuring the base; removing ${tree}\n`);
    for (const name of INTERRUPTS) process.off(name, interrupted);
    // The run still ends with its signal when the removal fails; what is left is named.
    try {
      remove();
    } catch (error) {
      process.stderr.write(
        `UI gate: could not remove ${tree} (${error.message}); run \`git worktree remove --force ${tree}\`\n`,
      );
    }
    process.kill(process.pid, signal);
  };
  git(root, ['worktree', 'add', '--detach', '--quiet', tree, commit]);
  for (const name of INTERRUPTS) process.on(name, interrupted);
  try {
    for (const linked of dependencyDirs)
      if (fs.existsSync(path.join(root, linked)))
        fs.symlinkSync(path.join(root, linked), path.join(tree, linked), 'dir');
    const found = await measure(tree);
    if (found.problems.length > 0)
      throw new Error(
        `UI gate: the bundle graph at ${commit.slice(0, 12)} has problems, so the debt a new rule records cannot be measured:\n${found.problems.map((p) => `  ${p}`).join('\n')}`,
      );
    const files = {};
    for (const [file, list] of Object.entries(found.files)) {
      const kept = list.filter((key) => rules.has(key.split('\t')[0]));
      if (kept.length > 0) files[file] = kept;
    }
    return files;
  } finally {
    for (const name of INTERRUPTS) process.off(name, interrupted);
    remove();
  }
}

/** Rules the gate runs that the base baseline does not list: their debt is measured at the base. */
export const newRules = (rules, base) =>
  new Set(rules.filter((rule) => !base.rules.includes(rule)));

/**
 * Fingerprints in `current` beyond what the base allows (after renames): the base baseline for
 * the rules it lists, `atBase` (the findings of the other rules on the base tree, see
 * `findingsAt`) for the rest. Both comparisons count, so a new rule records exactly the debt
 * that was already there (P1 QA10 FIX-FIRST-2, QA11 F1). The first baseline is held to the same.
 */
export function growth(current, base, renames, atBase) {
  const allowed = {};
  const known = new Set(base.rules);
  const merge = (files) => {
    for (const [file, list] of Object.entries(files))
      allowed[renames.get(file) ?? file] = [...(allowed[renames.get(file) ?? file] ?? []), ...list];
  };
  merge(base.files);
  merge(
    Object.fromEntries(
      Object.entries(atBase).map(([file, list]) => [
        file,
        list.filter((key) => !known.has(key.split('\t')[0])),
      ]),
    ),
  );
  return differences(current, allowed).filter(([, , delta]) => delta > 0);
}

/** One failure line per occurrence: where and what for a current violation, else its source. */
function describe(current, file, key, delta) {
  const [rule, messageId, where, source] = key.split('\t');
  const id = messageId === '' ? rule : `${rule}/${messageId}`;
  const occurrences = current.reports.get(`${file}\t${key}`);
  if (delta > 0 && occurrences !== undefined) {
    // The baseline holds some of these: which ones are new is a matter of count, not of line.
    const share = delta < occurrences.length ? ` (${delta} of these ${occurrences.length})` : '';
    return occurrences.map((occurrence) => `  new${share} ${occurrence} (${id})`);
  }
  const label = delta > 0 ? 'new' : 'fixed, still in baseline';
  const times = Math.abs(delta) > 1 ? ` ×${Math.abs(delta)}` : '';
  return [`  ${label} ${file} (${id})${times}: ${where === '' ? '' : `${where}: `}${source}`];
}

const onlyStyles = (files) =>
  Object.fromEntries(Object.entries(files).filter(([file]) => file.endsWith('.css')));

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const stylesOnly = args.includes('--styles');
  if (write && stylesOnly) throw new Error('UI gate: --write needs the whole gate, not --styles');
  const root = REPO_ROOT;
  const baselinePath = path.join(root, BASELINE_FILE);
  // Only --write creates the baseline; a gate run without one is a setup error (P1 QA10 N2).
  if (!write && !fs.existsSync(baselinePath))
    throw new Error(`UI gate: ${BASELINE_FILE} is missing; run pnpm run lint:ui:baseline`);
  const current = await runGate({ root, scripts: !stylesOnly });
  let failed = false;
  const fail = (lines) => {
    failed = true;
    for (const line of lines) console.error(line);
  };
  if (current.problems.length > 0)
    fail([
      'UI gate: the bundle graph has problems (§3):',
      ...current.problems.map((p) => `  ${p}`),
    ]);

  if (write) {
    fs.writeFileSync(
      baselinePath,
      `${JSON.stringify({ rules: current.rules, files: current.files }, null, 2)}\n`,
    );
    console.log(`UI gate: wrote ${BASELINE_FILE}.`);
    process.exit(failed ? 1 : 0);
  }
  const saved = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const scope = stylesOnly ? onlyStyles : (files) => files;
  if (!stylesOnly && JSON.stringify(saved.rules) !== JSON.stringify(current.rules)) {
    fail([
      `UI gate: ${BASELINE_FILE} lists rules ${saved.rules.join(', ')}; the gate runs ${current.rules.join(', ')}.`,
    ]);
  }
  const drift = differences(scope(current.files), scope(saved.files));
  if (drift.length > 0) {
    fail([
      `UI gate: violations differ from ${BASELINE_FILE} (fix new ones; after fixing old ones run pnpm run lint:ui:baseline):`,
      ...drift.flatMap(([file, key, delta]) => describe(current, file, key, delta)),
    ]);
  }
  if (!stylesOnly) {
    const base = comparisonBase(root);
    const atBaseline = baselineAt(root, base);
    const added = newRules(current.rules, atBaseline);
    const grown = growth(
      saved.files,
      atBaseline,
      renamesSince(root, base),
      added.size > 0 ? await findingsAt(root, base, added) : {},
    );
    if (grown.length > 0) {
      fail([
        `UI gate: ${BASELINE_FILE} grew against ${base.slice(0, 12)}; the baseline only shrinks:`,
        ...grown.flatMap(([file, key, delta]) => describe(current, file, key, delta)),
      ]);
    }
  }
  if (!failed) console.log('UI gate: clean against the baseline.');
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
