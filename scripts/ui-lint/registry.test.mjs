/**
 * The art layer is the one registered exemption from the UI gate's value rules (plan D7). Its
 * exact contents are pinned here: adding art is a visible change to this test. The CSS gate's
 * scope and configuration checks, the ratchet's comparisons and the directive scan are pinned
 * here too, each with the bypass it closes (P1 QA1, QA2).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { globSync } from 'glob';
import { afterEach, describe, expect, it } from 'vitest';

import { disableDirectiveProblems, growth } from '../ui-baseline-ratchet.mjs';
import { gateDisableDirectives } from './disableDirectives.mjs';
import { ART_LAYER_PATHS, ART_LAYER_STYLESHEETS, TOKEN_STYLESHEET } from './registry/artLayer.mjs';
import {
  baselineFrom,
  checkAllStyles,
  configProblems,
  fingerprint,
  htmlProblems,
  mismatches,
  readBaseline,
  styleScope,
  uncovered,
} from './styleGate.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

describe('UI gate: art layer registry', () => {
  it('lists exactly the approved art areas and stylesheets', () => {
    expect(ART_LAYER_PATHS).toEqual([
      'packages/web/src/scene/**',
      'packages/web/src/features/room/components/RoleRevealEffects/**',
      'packages/web/src/components/avatar/GeneratedAvatar.tsx',
      'packages/web/src/components/nameStyles/**',
      'packages/web/src/features/gacha/machine/**',
      'packages/web/src/boot/bootSplash.css',
      'packages/web/src/theme/nightArt.css',
      'packages/web/src/routes/bench/**',
    ]);
    expect(ART_LAYER_STYLESHEETS).toEqual([
      'packages/web/src/scene/scene.css',
      'packages/web/src/components/nameStyles/nameStyles.css',
      'packages/web/src/features/gacha/machine/CapsuleMachine.css',
      'packages/web/src/boot/bootSplash.css',
      'packages/web/src/theme/nightArt.css',
      'packages/web/src/routes/bench/SceneBench.css',
    ]);
  });

  it('points every entry at files that exist, each stylesheet inside an art area', () => {
    for (const entry of [...ART_LAYER_PATHS, TOKEN_STYLESHEET]) {
      expect(globSync(entry, { cwd: REPO_ROOT }), entry).not.toEqual([]);
    }
    const inAreas = new Set(
      ART_LAYER_PATHS.flatMap((entry) => globSync(entry, { cwd: REPO_ROOT })),
    );
    for (const stylesheet of ART_LAYER_STYLESHEETS) {
      expect(inAreas.has(stylesheet), stylesheet).toBe(true);
    }
  });
});

describe('UI gate: CSS scope and configuration', () => {
  const scratchDirs = [];
  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });
  function scratch(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-gate-scope-'));
    scratchDirs.push(dir);
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), text);
    }
    return dir;
  }

  it('lints dot files and dot directories, and rejects other style languages', () => {
    const files = [
      'packages/web/src/a/.hidden/A.css',
      'packages/web/src/a/.B.css',
      'packages/web/src/a/C.pcss',
      'packages/web/src/a/D.scss',
      'packages/web/public/e.css',
      'packages/web/src/a/x.ts',
    ];
    const { stylesheets, problems } = styleScope(REPO_ROOT, files);
    expect(stylesheets).toEqual([
      'packages/web/src/a/.hidden/A.css',
      'packages/web/src/a/.B.css',
      'packages/web/public/e.css',
    ]);
    expect(problems).toHaveLength(2);
  });

  it('allows no Stylelint configuration but the root one', () => {
    const dir = scratch({
      'packages/web/package.json': JSON.stringify({ name: 'web', stylelint: { rules: {} } }),
      'package.json': JSON.stringify({ name: 'root' }),
    });
    const listed = [
      'stylelint.config.mjs',
      'packages/web/src/features/qaprobe/.stylelintrc.json',
      'packages/web/.stylelintrc',
      'packages/web/stylelint.config.cjs',
      '.stylelintignore',
      'stylelint-suppressions.json',
      'packages/web/package.json',
      'package.json',
    ];
    expect(configProblems(dir, listed).map((problem) => problem.split(':')[0])).toEqual([
      'packages/web/src/features/qaprobe/.stylelintrc.json',
      'packages/web/.stylelintrc',
      'packages/web/stylelint.config.cjs',
      '.stylelintignore',
      'stylelint-suppressions.json',
      'packages/web/package.json',
    ]);
  });

  it('rejects <style> and unregistered stylesheet links in HTML', () => {
    const dir = scratch({
      'packages/web/index.html': '<link rel="stylesheet" href="/src/global.css" />',
      'packages/web/a.html': '<style>.a{}</style>',
      'packages/web/b.html': '<link href="/x.css" rel="preload stylesheet">',
    });
    expect(htmlProblems(dir, ['packages/web/index.html'])).toEqual([]);
    expect(htmlProblems(dir, ['packages/web/a.html', 'packages/web/b.html'])).toHaveLength(2);
  });

  it('finds the repository closed and matching its baseline', async () => {
    const { problems, found } = await checkAllStyles(REPO_ROOT);
    expect(problems).toEqual([]);
    expect(mismatches(readBaseline(REPO_ROOT), found)).toEqual([]);
  }, 60_000);
});

describe('UI gate: baseline fingerprints', () => {
  const warn = (line, text) => ({
    rule: 'ui/strict-value',
    line,
    text: `${text} (ui/strict-value)`,
  });
  const source = ['a {', '  transition: x 120ms;', '  border-radius: 13px;', '}'];

  it('identifies a violation by message and source line, not by position', () => {
    expect(fingerprint(warn(2, 'literal "120ms"'), source)).toBe(
      'literal "120ms" @ transition: x 120ms;',
    );
    expect(fingerprint(warn(3, 'm'), source)).toBe(
      fingerprint(warn(1, 'm'), ['border-radius: 13px;']),
    );
  });

  it('rejects trading a fixed literal for a new one in the same file (G3)', () => {
    const record = { 'a.css': { 'ui/strict-value': ['literal "120ms" @ transition: x 120ms;'] } };
    const swapped = { 'a.css': { 'ui/strict-value': ['literal "13px" @ border-radius: 13px;'] } };
    expect(uncovered(record, swapped)).toEqual([
      'a.css → ui/strict-value: literal "13px" @ border-radius: 13px;',
    ]);
    expect(mismatches(record, swapped)).toHaveLength(2);
    expect(mismatches(record, record)).toEqual([]);
  });

  it('counts identical fingerprints as a multiset', () => {
    const one = { 'a.css': { r: ['p'] } };
    const two = { 'a.css': { r: ['p', 'p'] } };
    expect(uncovered(one, two)).toEqual(['a.css → r: p']);
    expect(uncovered(two, one)).toEqual([]);
  });

  it('writes the baseline from the current fingerprints only, sorted', () => {
    const record = baselineFrom({ 'z.css': { b: ['2', '1'], a: ['x'] }, 'm.css': { c: ['y'] } });
    expect(Object.keys(record)).toEqual(['m.css', 'z.css']);
    expect(Object.keys(record['z.css'])).toEqual(['a', 'b']);
    expect(record['z.css'].b).toEqual(['1', '2']);
  });
});

describe('UI gate: baseline ratchet', () => {
  const base = { 'a.css': { 'ui/strict-value': ['p', 'q'] } };
  const message = (entry, size) => `${entry}: new entry (${size}) for a rule that already applied`;

  it('accepts an unchanged or shrunk record', async () => {
    expect(await growth(base, base)).toEqual([]);
    expect(await growth({ 'a.css': { 'ui/strict-value': ['q'] } }, base)).toEqual([]);
    expect(await growth({}, base)).toEqual([]);
  });

  it('rejects a new fingerprint, a repeated one, or a new entry for a rule that applied', async () => {
    expect(await growth({ 'a.css': { 'ui/strict-value': ['p', 'r'] } }, base)).toEqual([
      'a.css → ui/strict-value: new r',
    ]);
    expect(await growth({ 'a.css': { 'ui/strict-value': ['p', 'p', 'q'] } }, base)).toEqual([
      'a.css → ui/strict-value: new p',
    ]);
    expect(await growth({ ...base, 'b.css': { 'color-named': ['x'] } }, base)).toEqual([
      message('b.css → color-named', 1),
    ]);
  });

  it('compares ESLint counts the same way', async () => {
    const eslintBase = { 'a.ts': { 'ui/x': { count: 3 } } };
    expect(await growth({ 'a.ts': { 'ui/x': { count: 2 } } }, eslintBase)).toEqual([]);
    expect(await growth({ 'a.ts': { 'ui/x': { count: 4 } } }, eslintBase)).toEqual([
      'a.ts → ui/x: 3 → 4',
    ]);
  });

  it('lets only the PR that brings a rule to a file record its debt', async () => {
    const appliedAtBase = async (file, rule) => !(file === 'b.css' && rule === 'ui/new-rule');
    const current = { ...base, 'b.css': { 'ui/new-rule': ['x', 'y'] } };
    expect(await growth(current, base, new Map(), appliedAtBase)).toEqual([]);
    const other = { ...base, 'c.css': { 'ui/new-rule': ['x'] } };
    expect(await growth(other, base, new Map(), appliedAtBase)).toEqual([
      message('c.css → ui/new-rule', 1),
    ]);
  });

  it('carries entries across a rename', async () => {
    const renamed = { 'b.css': base['a.css'] };
    expect(await growth(renamed, base, new Map([['b.css', 'a.css']]))).toEqual([]);
    expect(await growth(renamed, base)).toEqual([message('b.css → ui/strict-value', 2)]);
  });
});

describe('UI gate: inline config comments', () => {
  const offending = [
    '/* eslint-disable */',
    '// eslint-disable-next-line',
    '// eslint-disable-next-line ui/no-style-elements',
    '/* eslint-disable ui/inline-style-static-keys */',
    '// eslint-disable-line react/no-danger, no-eval -- reason',
    '/* eslint no-new-func: off */',
    '/* eslint-disable-next-line @typescript-eslint/no-implied-eval */',
    '/* eslint-disable\n  ui/no-style-elements */',
    // P1 QA2 G4: spellings ESLint accepts that a hand-written scanner missed.
    '/* eslint\n  ui/no-style-elements: off */',
    '/* eslint "ui/no-style-elements": "off" */',
    '// eslint-disable-next-line "ui/no-style-elements"',
    '// eslint-disable-next-line react/no-danger',
    '/* eslint ui/no-style-elements: ["error", { "htmlSinks": false }] */',
  ];
  it.each(offending)('rejects %s', (comment) => {
    expect(gateDisableDirectives(`const a = 1;\n${comment}\nconst b = 2;`)).toHaveLength(1);
  });

  it('accepts directives for other rules and ordinary comments', () => {
    const source = [
      '// eslint-disable-next-line react-hooks/set-state-in-effect',
      '// eslint-disable-next-line testing-library/no-unnecessary-act -- reason',
      '/* eslint-enable */',
      '// the eslint config lives at the root',
      'const s = "/* eslint-disable */";',
    ].join('\n');
    expect(gateDisableDirectives(source)).toEqual([]);
  });

  it('reports the line of the directive', () => {
    expect(gateDisableDirectives('a;\nb;\n/* eslint-disable */')).toEqual([
      { line: 3, text: '/* eslint-disable */' },
    ]);
  });

  it('finds none in the web client', async () => {
    expect(await disableDirectiveProblems(REPO_ROOT)).toEqual([]);
  }, 120_000);
});
