#!/usr/bin/env node
/**
 * The UI gate (UI drift lock plan v3, §3): `pnpm run lint:ui`.
 *
 * 1. Compute the bundle graph (`bundle.mjs`); any graph problem fails the gate.
 * 2. Lint the graph's stylesheets with `stylelint.gate.mjs` and its scripts with `eslint.gate.mjs`
 *    (own configurations only, inline disables ignored).
 * 3. Turn every violation into a fingerprint (rule, message, trimmed source line) and compare:
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
import { gateConfig } from './eslint.gate.mjs';
import stylelintConfig from './stylelint.gate.mjs';

export const BASELINE_FILE = 'ui-gate-baseline.json';

function fingerprint(rule, message, lines, line, file) {
  // A reported line outside the file is a linter or rule bug, never an empty fingerprint.
  if (!Number.isInteger(line) || line < 1 || line > lines.length)
    throw new Error(`UI gate: ${rule} reported line ${line} of ${file} (${lines.length} lines)`);
  return `${rule}\t${message}\t${lines[line - 1].trim()}`;
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
 * Lint the graph; returns `{ problems, rules, files, graph }`. `only` (repository-relative
 * paths) narrows the linted files to those of the graph it names; the scope stays the graph.
 */
export async function runGate({ root = REPO_ROOT, styles = true, scripts = true, only } = {}) {
  const graph = bundleGraph(root);
  const pick = (list) => (only ? list.filter((file) => only.has(file)) : list);
  const files = {};
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
        else add(files, file, fingerprint(warning.rule, warning.text, lines, warning.line, file));
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
        else
          add(files, file, fingerprint(message.ruleId, message.message, lines, message.line, file));
      }
    }
  }
  return { problems: graph.problems, rules: [...rules].sort(), files: sortFiles(files), graph };
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

/** Fingerprints in `current` beyond `base` (after renames), excluding rules new to the base. */
export function growth(current, base, renames) {
  const mapped = {};
  for (const [file, list] of Object.entries(base.files))
    mapped[renames.get(file) ?? file] = [...(mapped[renames.get(file) ?? file] ?? []), ...list];
  const known = new Set(base.rules);
  return differences(current, mapped).filter(
    ([, key, delta]) => delta > 0 && known.has(key.split('\t')[0]),
  );
}

const onlyStyles = (files) =>
  Object.fromEntries(Object.entries(files).filter(([file]) => file.endsWith('.css')));

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const stylesOnly = args.includes('--styles');
  const root = REPO_ROOT;
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

  const baselinePath = path.join(root, BASELINE_FILE);
  if (write) {
    if (stylesOnly) throw new Error('--write needs the whole gate');
    fs.writeFileSync(
      baselinePath,
      `${JSON.stringify({ rules: current.rules, files: current.files }, null, 2)}\n`,
    );
    console.log(`UI gate: wrote ${BASELINE_FILE}.`);
    process.exit(failed ? 1 : 0);
  }
  const saved = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    : { rules: [], files: {} };
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
      ...drift.map(
        ([file, key, delta]) =>
          `  ${delta > 0 ? 'new' : 'fixed, still in baseline'} ${file}: ${key.split('\t').slice(0, 2).join(' — ')}${Math.abs(delta) > 1 ? ` ×${Math.abs(delta)}` : ''}`,
      ),
    ]);
  }
  if (!stylesOnly) {
    const base = comparisonBase(root);
    const grown = growth(saved.files, baselineAt(root, base), renamesSince(root, base));
    if (grown.length > 0) {
      fail([
        `UI gate: ${BASELINE_FILE} grew against ${base.slice(0, 12)}; the baseline only shrinks:`,
        ...grown.map(([file, key]) => `  ${file}: ${key.split('\t').slice(0, 2).join(' — ')}`),
      ]);
    }
  }
  if (!failed) console.log('UI gate: clean against the baseline.');
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
