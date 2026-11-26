/**
 * The Stylelint half of the UI gate, shared by `lint-css.mjs` (no new violations) and the
 * baseline ratchet (the record is exact and only shrinks). One implementation of: which files
 * are checked, with which configuration, and how a violation is identified.
 *
 * Fail closed on scope and configuration (P1 QA2 G1/G2):
 * - the configuration is always the root `stylelint.config.mjs`, passed explicitly, and no other
 *   Stylelint configuration, ignore file or suppressions file may exist anywhere in the repository
 *   (Stylelint would otherwise pick up the nearest one above each file);
 * - the checked files are every stylesheet git knows under `packages/web` (tracked or untracked,
 *   dot files included), not a glob; a style language Vite would also bundle (`.pcss`, `.scss`, …)
 *   is rejected outright, and so is a stylesheet Stylelint reports as ignored;
 * - HTML entry points carry no `<style>` and link no stylesheet except the registered one.
 *
 * A violation is identified by a fingerprint: its rule, its message (which names the property
 * and the literal) and the trimmed source line. The baseline records a multiset of fingerprints
 * per file and rule, so trading a fixed literal for a new one in the same file is a new
 * fingerprint, not an equal count (G3). Moving a line keeps its fingerprint; editing a line that
 * carries debt makes the debt new, so touching such a line means fixing it.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import stylelint from 'stylelint';

export const STYLELINT_CONFIG = 'stylelint.config.mjs';
export const STYLE_BASELINE = 'ui-style-baseline.json';
export const WEB_PACKAGE = 'packages/web';
/** Style languages Vite bundles; only plain `.css` is allowed, so only `.css` needs linting. */
const STYLE_FILE = /\.(?:css|pcss|postcss|scss|sass|less|styl|stylus|sss)$/i;
const STYLELINT_CONTROL_FILE =
  /(?:^|\/)(?:\.stylelintrc(?:\.[^/]*)?|stylelint\.config\.[cm]?[jt]s|\.stylelintignore|stylelint-suppressions\.json)$/;
/** The stylesheet `packages/web/index.html` links: the bundle entry, itself linted. */
export const HTML_STYLESHEET_LINKS = Object.freeze(['/src/global.css']);

function toPosix(file) {
  return file.split(path.sep).join('/');
}

/** Paths git knows (tracked, or untracked and not ignored), present in the work tree. */
export function knownFiles(cwd, pathspec = '.') {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', pathspec],
    { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean);
  return [...new Set(listed)].filter((file) => fs.existsSync(path.join(cwd, file))).sort();
}

/** Stylesheets to lint and the problems with the checked scope itself. */
export function styleScope(cwd, files = knownFiles(cwd, WEB_PACKAGE)) {
  const stylesheets = [];
  const problems = [];
  for (const file of files.map(toPosix)) {
    if (!file.startsWith(`${WEB_PACKAGE}/`) || !STYLE_FILE.test(file)) continue;
    if (file.toLowerCase().endsWith('.css')) stylesheets.push(file);
    else problems.push(`${file}: only plain .css is allowed in the web client`);
  }
  return { stylesheets, problems };
}

/** Stylelint configuration other than the root config, anywhere in the repository. */
export function configProblems(cwd, files = knownFiles(cwd)) {
  const problems = [];
  for (const file of files.map(toPosix)) {
    if (STYLELINT_CONTROL_FILE.test(file) && file !== STYLELINT_CONFIG) {
      problems.push(`${file}: the only Stylelint configuration is the root ${STYLELINT_CONFIG}`);
    } else if (path.posix.basename(file) === 'package.json') {
      const manifest = JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf8'));
      if (Object.hasOwn(manifest, 'stylelint')) {
        problems.push(
          `${file}: a "stylelint" key configures Stylelint outside ${STYLELINT_CONFIG}`,
        );
      }
    }
  }
  return problems;
}

/** `<style>` blocks and unregistered stylesheet links in the web client's HTML. */
export function htmlProblems(cwd, files = knownFiles(cwd, WEB_PACKAGE)) {
  const problems = [];
  for (const file of files.map(toPosix).filter((name) => /\.html?$/i.test(name))) {
    const html = fs.readFileSync(path.join(cwd, file), 'utf8');
    if (/<style\b/i.test(html)) problems.push(`${file}: <style> in HTML bypasses the CSS gate`);
    for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!/\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i.test(tag)) continue;
      const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
      if (!HTML_STYLESHEET_LINKS.includes(href)) {
        problems.push(`${file}: stylesheet link ${href ?? '(no href)'} is not registered`);
      }
    }
  }
  return problems;
}

/**
 * Lints `files` (repository-relative) with the root config and no suppressions. Returns the
 * fingerprints per file and rule, and files Stylelint skipped (an ignored file escapes the gate).
 */
export async function lintStyles(cwd, files, configFile = path.join(cwd, STYLELINT_CONFIG)) {
  // No suppressions file is passed or allowed (configProblems), so every warning is reported.
  const { results } =
    files.length === 0
      ? { results: [] }
      : await stylelint.lint({
          files: files.map((file) => path.join(cwd, file)),
          cwd,
          configFile,
          disableDefaultIgnores: true,
          allowEmptyInput: true,
        });
  const found = {};
  const skipped = [];
  const warnings = [];
  for (const result of results) {
    if (result.source === undefined) continue;
    const file = toPosix(path.relative(cwd, result.source));
    if (result.ignored) {
      skipped.push(`${file}: Stylelint ignored this stylesheet`);
      continue;
    }
    const lines = fs.readFileSync(result.source, 'utf8').split('\n');
    for (const warning of result.warnings) {
      const print = fingerprint(warning, lines);
      ((found[file] ??= {})[warning.rule] ??= []).push(print);
      warnings.push({ file, rule: warning.rule, print, warning });
    }
  }
  for (const rules of Object.values(found)) for (const list of Object.values(rules)) list.sort();
  return { found, skipped, warnings };
}

/** Rule message (without the trailing rule ID) and the trimmed source line. */
export function fingerprint(warning, lines) {
  const message = warning.text.replace(` (${warning.rule})`, '');
  return `${message} @ ${(lines[warning.line - 1] ?? '').trim()}`;
}

function tally(list = []) {
  const counts = new Map();
  for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

/** Fingerprints in `actual` beyond those recorded in `record` (a multiset difference). */
export function uncovered(record, actual) {
  const problems = [];
  for (const file of Object.keys(actual).sort()) {
    for (const rule of Object.keys(actual[file]).sort()) {
      const allowed = tally(record[file]?.[rule]);
      for (const [print, count] of tally(actual[file][rule])) {
        const extra = count - (allowed.get(print) ?? 0);
        for (let i = 0; i < extra; i += 1) problems.push(`${file} → ${rule}: ${print}`);
      }
    }
  }
  return problems;
}

/** Differences between the record and the current fingerprints, in both directions. */
export function mismatches(record, actual) {
  return [
    ...uncovered(record, actual).map((problem) => `not recorded: ${problem}`),
    ...uncovered(actual, record).map((problem) => `recorded but gone: ${problem}`),
  ];
}

/** Reads a baseline (`{ file: { rule: [fingerprint, …] } }`). */
export function parseBaseline(text, label) {
  const parsed = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}: expected an object of files`);
  }
  for (const [file, rules] of Object.entries(parsed)) {
    for (const [rule, prints] of Object.entries(rules)) {
      if (!Array.isArray(prints) || prints.length === 0) {
        throw new Error(`${label}: ${file} → ${rule} needs a non-empty list of fingerprints`);
      }
      if (prints.some((print) => typeof print !== 'string')) {
        throw new Error(`${label}: ${file} → ${rule} holds a fingerprint that is not a string`);
      }
    }
  }
  return parsed;
}

export function readBaseline(cwd) {
  const full = path.join(cwd, STYLE_BASELINE);
  return fs.existsSync(full) ? parseBaseline(fs.readFileSync(full, 'utf8'), STYLE_BASELINE) : {};
}

/** The baseline the current fingerprints imply, sorted for a stable diff. */
export function baselineFrom(found) {
  const record = {};
  for (const file of Object.keys(found).sort()) {
    record[file] = {};
    for (const rule of Object.keys(found[file]).sort()) {
      record[file][rule] = [...found[file][rule]].sort();
    }
  }
  return record;
}

/** Every check of the whole scope: configuration, scope, HTML and the lint itself. */
export async function checkAllStyles(cwd) {
  const repoFiles = knownFiles(cwd);
  const webFiles = repoFiles.filter((file) => file.startsWith(`${WEB_PACKAGE}/`));
  const scope = styleScope(cwd, webFiles);
  const lint = await lintStyles(cwd, scope.stylesheets);
  return {
    ...lint,
    stylesheets: scope.stylesheets,
    problems: [
      ...configProblems(cwd, repoFiles),
      ...scope.problems,
      ...htmlProblems(cwd, webFiles),
      ...lint.skipped,
    ],
  };
}
