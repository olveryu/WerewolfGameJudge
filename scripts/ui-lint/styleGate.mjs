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
 * - nothing else reaches the bundle unchecked (P1 QA3 H1/H7): no symbolic link under the web
 *   package or the bundled engine source (git lists a linked directory as one entry, so its files
 *   would never be listed), no script in bundled source but TypeScript (the ESLint gate's scope),
 *   and `@import` only of checked stylesheets (`ui/import-scope` in the Stylelint plugin);
 * - HTML is parsed and checked against an allow-list (H4): known elements only, no `style` or
 *   event-handler attributes, no inline script, and only the registered stylesheet and script.
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

import { parse } from 'parse5';
import stylelint from 'stylelint';

import { BUNDLED_SCRIPT, BUNDLED_SOURCE_ROOTS, SCRIPT_FILE, WEB_PACKAGE } from './scope.mjs';

export const STYLELINT_CONFIG = 'stylelint.config.mjs';
export const STYLE_BASELINE = 'ui-style-baseline.json';
/** Style languages Vite bundles; only plain `.css` is allowed, so only `.css` needs linting. */
const STYLE_FILE = /\.(?:css|pcss|postcss|scss|sass|less|styl|stylus|sss)$/i;
const STYLELINT_CONTROL_FILE =
  /(?:^|\/)(?:\.stylelintrc(?:\.[^/]*)?|stylelint\.config\.[cm]?[jt]s|\.stylelintignore|stylelint-suppressions\.json)$/;
/** The stylesheet the web client's HTML pages link: the bundle's global entry, itself linted. */
export const HTML_STYLESHEET_LINKS = Object.freeze(['/src/global.css']);
/**
 * The HTML pages in the web package and the one module script each loads (a linted TypeScript
 * entry). A page not listed here fails: each is a reviewed way onto the screen.
 */
export const HTML_PAGES = Object.freeze({
  'packages/web/index.html': '/src/main.tsx',
  // Local game preview (`pnpm dev:game-preview`), served by the dev server only.
  'packages/web/preview/index.html': './main.tsx',
});
/** Elements the HTML may hold (the boot splash and the document head). */
export const HTML_ELEMENTS = Object.freeze(
  new Set([
    'html',
    'head',
    'body',
    'meta',
    'link',
    'title',
    'script',
    'div',
    'span',
    'img',
    'h1',
    'p',
    'a',
  ]),
);
/** `rel` values a `<link>` may carry; `stylesheet` only with a registered href. */
export const HTML_LINK_RELS = Object.freeze(
  new Set(['icon', 'apple-touch-icon', 'manifest', 'stylesheet']),
);
/** Attributes that can bring styles or code in by another door. */
const HTML_BANNED_ATTRIBUTE = /^(?:style|on.*|srcdoc|as|is)$/i;
/** `http-equiv` pragmas allowed: a CSP only narrows what loads (`Link`, `refresh` would add). */
const HTML_HTTP_EQUIV = Object.freeze(new Set(['content-security-policy']));

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

/**
 * Files in the bundle's reach that would pass unchecked: symbolic links (their targets are never
 * listed) and scripts in bundled source that are not TypeScript.
 */
export function bundleScopeProblems(cwd, files = knownFiles(cwd)) {
  const problems = [];
  const reach = [WEB_PACKAGE, ...BUNDLED_SOURCE_ROOTS].map((root) => `${root}/`);
  for (const file of files.map(toPosix)) {
    if (!reach.some((root) => file.startsWith(root))) continue;
    if (fs.lstatSync(path.join(cwd, file)).isSymbolicLink()) {
      problems.push(`${file}: symbolic links are not allowed where the bundle can reach`);
    } else if (!file.startsWith(`${WEB_PACKAGE}/`) && STYLE_FILE.test(file)) {
      problems.push(
        `${file}: bundled stylesheets live in ${WEB_PACKAGE}, where the CSS gate checks them`,
      );
    } else if (
      BUNDLED_SOURCE_ROOTS.some((root) => file.startsWith(`${root}/`)) &&
      SCRIPT_FILE.test(file) &&
      !BUNDLED_SCRIPT.test(file)
    ) {
      problems.push(
        `${file}: bundled source is TypeScript only (.ts/.tsx), which the UI gate lints`,
      );
    }
  }
  return problems;
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

/** Problems with one parsed HTML element against the allow-list. */
function htmlElementProblems(element, entry) {
  const problems = [];
  const name = element.tagName;
  const attrs = new Map(element.attrs.map(({ name: key, value }) => [key.toLowerCase(), value]));
  if (!HTML_ELEMENTS.has(name)) problems.push(`<${name}> is not an allowed element`);
  for (const key of attrs.keys()) {
    if (HTML_BANNED_ATTRIBUTE.test(key)) problems.push(`<${name} ${key}> is not allowed`);
    if (key === 'http-equiv' && !HTML_HTTP_EQUIV.has(attrs.get(key).toLowerCase())) {
      problems.push(`<${name} http-equiv="${attrs.get(key)}"> is not allowed`);
    }
  }
  if (name === 'link') {
    const rels = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    if (rels.length === 0) problems.push('<link> needs a rel');
    for (const rel of rels) {
      if (!HTML_LINK_RELS.has(rel)) problems.push(`<link rel="${rel}"> is not allowed`);
    }
    if (rels.includes('stylesheet') && !HTML_STYLESHEET_LINKS.includes(attrs.get('href'))) {
      problems.push(`stylesheet link ${attrs.get('href') ?? '(no href)'} is not registered`);
    }
  }
  if (name === 'script') {
    const inline = element.childNodes.some((child) => child.value?.trim());
    if (inline) problems.push('inline <script> is not allowed');
    if (attrs.get('type') !== 'module' || attrs.get('src') !== entry) {
      problems.push(`<script src="${attrs.get('src') ?? ''}"> is not the registered module entry`);
    }
  }
  return problems;
}

/**
 * The web client's HTML, parsed and checked against an allow-list: an element, attribute, link
 * or script not listed above fails, so HTML is no side door for styles (P1 QA3 H4).
 */
export function htmlProblems(cwd, files = knownFiles(cwd, WEB_PACKAGE), pages = HTML_PAGES) {
  const problems = [];
  for (const file of files.map(toPosix).filter((name) => /\.html?$/i.test(name))) {
    if (!Object.hasOwn(pages, file)) {
      problems.push(`${file}: not a registered HTML page (HTML_PAGES in styleGate.mjs)`);
      continue;
    }
    const entry = pages[file];
    const document = parse(fs.readFileSync(path.join(cwd, file), 'utf8'));
    const pending = [...document.childNodes];
    while (pending.length > 0) {
      const node = pending.pop();
      if (node.tagName !== undefined) {
        problems.push(...htmlElementProblems(node, entry).map((problem) => `${file}: ${problem}`));
      }
      pending.push(...(node.childNodes ?? []), ...(node.content?.childNodes ?? []));
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
      ...bundleScopeProblems(cwd, repoFiles),
      ...scope.problems,
      ...htmlProblems(cwd, webFiles),
      ...lint.skipped,
    ],
  };
}
