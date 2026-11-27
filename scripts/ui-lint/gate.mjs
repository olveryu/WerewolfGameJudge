#!/usr/bin/env node
/**
 * The UI gate (UI drift lock plan v3, §3): `pnpm run lint:ui`.
 *
 * 1. Compute the bundle graph (`bundle.mjs`); any graph problem fails the gate.
 * 2. Lint the graph's stylesheets with `stylelint.gate.mjs` and its scripts with `eslint.gate.mjs`
 *    (own configurations only, inline disables ignored).
 * 3. Turn every violation into a fingerprint and compare. A fingerprint is the violation's
 *    identity in code: rule ID, message ID (ESLint; Stylelint has none) and the trimmed source
 *    line, plus the source lines a report says its value is written on (`Written at …`, from
 *    `values.mjs`) when they are elsewhere. The message text is not part of it, so rewording a
 *    message records no new debt (P1 QA7 F2), and changing a value written elsewhere is new
 *    debt (QA8 FIX-FIRST-2); renaming a message ID is renaming part of a rule's identity.
 *    - exactly equal to `ui-gate-baseline.json` (a fixed violation must shrink the baseline);
 *    - no fingerprint beyond the baseline at the comparison base (renames followed), except
 *      for rule IDs the base baseline does not list yet (a new rule records its existing debt).
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
import { originsOf } from './values.mjs';
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

function fingerprint(rule, messageId, lines, { line, endLine = line }, file) {
  return `${rule}\t${messageId}\t${span(rule, lines, line, endLine, file)}`;
}

/** Where and why each current fingerprint was reported, for the failure output (P1 QA7 S1). */
function remember(reports, file, key, line, message) {
  const list = reports.get(`${file}\t${key}`) ?? [];
  list.push(`${file}:${line}: ${message}`);
  reports.set(`${file}\t${key}`, list);
}

/**
 * The fingerprint of one ESLint report: rule ID, message ID, the lines it spans, then
 * `file: text` for the lines elsewhere its message says the value is written on (P1 QA8/QA9
 * FIX-FIRST-2).
 */
export function scriptKey(root, file, lines, message) {
  // Every rule of the gate configuration reports through `messages` (message IDs).
  if (message.messageId === undefined)
    throw new Error(`UI gate: ${message.ruleId} reported without a message ID in ${file}`);
  const endLine = message.endLine ?? message.line;
  const written = originsOf(message.message)
    .filter(
      (origin) => origin.file !== file || origin.line < message.line || origin.endLine > endLine,
    )
    .map((origin) => sourceLine(root, origin, message.ruleId));
  return [
    fingerprint(message.ruleId, message.messageId, lines, { line: message.line, endLine }, file),
    ...written,
  ].join('\t');
}

/** `file: text` for the lines a report says a value is written on; out of range throws. */
function sourceLine(root, { file, line, endLine }, rule) {
  return `${file}: ${span(rule, readLines(root, file), line, endLine, file)}`;
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
          );
          add(files, file, key);
          remember(reports, file, key, warning.line, warning.text);
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

/**
 * Whether source text was already in a file at `commit`: the working tree file is unchanged
 * since then, or the file there holds the same lines (each trimmed, joined by one space, as
 * fingerprints write them). Files are read once per commit.
 */
export function presentAt(root, commit) {
  const changed = new Set(
    git(root, ['diff', '--no-renames', '--name-only', commit, '--'])
      .split('\n')
      .concat(git(root, ['ls-files', '--others', '--exclude-standard']).split('\n'))
      .filter((line) => line !== ''),
  );
  const texts = new Map();
  const textAt = (file) => {
    if (!texts.has(file)) {
      const listed = git(root, ['ls-tree', '--name-only', commit, '--', file]).trim() !== '';
      texts.set(
        file,
        listed
          ? git(root, ['show', `${commit}:${file}`])
              .split('\n')
              .map((line) => line.trim())
              .join(' ')
          : null,
      );
    }
    return texts.get(file);
  };
  return (file, text) => !changed.has(file) || (textAt(file)?.includes(text) ?? false);
}

/** The `[file, text]` sources a fingerprint depends on: the reported span and each origin. */
function sourcesOf(file, key) {
  const [, , text, ...origins] = key.split('\t');
  return [
    [file, text],
    ...origins.map((origin) => {
      const at = origin.indexOf(': ');
      return [origin.slice(0, at), origin.slice(at + 2)];
    }),
  ];
}

/**
 * Fingerprints in `current` beyond `base` (after renames). A rule the base lists no entries for
 * records existing debt only: each of its fingerprints must have every source text (the reported
 * span and the lines its value is written on) already present at the base, so the violation was
 * there before (P1 QA10 FIX-FIRST-2). The first baseline is held to the same condition.
 */
export function growth(current, base, renames, present) {
  const mapped = {};
  for (const [file, list] of Object.entries(base.files))
    mapped[renames.get(file) ?? file] = [...(mapped[renames.get(file) ?? file] ?? []), ...list];
  const known = new Set(base.rules);
  const formerly = new Map([...renames].map(([from, to]) => [to, from]));
  return differences(current, mapped).filter(
    ([file, key, delta]) =>
      delta > 0 &&
      (known.has(key.split('\t')[0]) ||
        sourcesOf(file, key).some(
          ([source, text]) => !present(formerly.get(source) ?? source, text),
        )),
  );
}

/** One failure line per occurrence: where and what for a current violation, else its source. */
function describe(current, file, key, delta) {
  const [rule, messageId, source] = key.split('\t');
  const id = messageId === '' ? rule : `${rule}/${messageId}`;
  const occurrences = current.reports.get(`${file}\t${key}`);
  if (delta > 0 && occurrences !== undefined) {
    // The baseline holds some of these: which ones are new is a matter of count, not of line.
    const share = delta < occurrences.length ? ` (${delta} of these ${occurrences.length})` : '';
    return occurrences.map((occurrence) => `  new${share} ${occurrence} (${id})`);
  }
  const label = delta > 0 ? 'new' : 'fixed, still in baseline';
  const times = Math.abs(delta) > 1 ? ` ×${Math.abs(delta)}` : '';
  return [`  ${label} ${file} (${id})${times}: ${source}`];
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
    const grown = growth(
      saved.files,
      baselineAt(root, base),
      renamesSince(root, base),
      presentAt(root, base),
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
