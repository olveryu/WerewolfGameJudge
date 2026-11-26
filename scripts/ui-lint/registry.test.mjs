/**
 * The art layer is the one registered exemption from the UI gate's value rules (plan D7). Its
 * exact contents are pinned here: adding art is a visible change to this test. The CSS gate's
 * scope and configuration checks, the ratchet's comparisons and the directive scan are pinned
 * here too, each with the bypass it closes (P1 QA1, QA2).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';
import { globSync } from 'glob';
import { afterEach, describe, expect, it } from 'vitest';

import { disableDirectiveProblems, growth } from '../ui-baseline-ratchet.mjs';
import { gateDisableDirectives } from './disableDirectives.mjs';
import eslintConfig from '../../eslint.config.mjs';
import stylelintConfig from '../../stylelint.config.mjs';
import { ART_LAYER_PATHS, ART_LAYER_STYLESHEETS, TOKEN_STYLESHEET } from './registry/artLayer.mjs';
import { inCssGate, isTestModule, UI_GATE_SCRIPT_GLOBS, UI_GATE_TEST_GLOBS } from './scope.mjs';
import {
  baselineFrom,
  bundleScopeProblems,
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
    // Each stylesheet with the class prefix its exemption is limited to (P1 QA3 H3).
    expect(ART_LAYER_STYLESHEETS).toEqual({
      'packages/web/src/scene/scene.css': 'scene-canvas',
      'packages/web/src/components/nameStyles/nameStyles.css': 'name-style',
      'packages/web/src/features/gacha/machine/CapsuleMachine.css': 'capsule-machine',
      'packages/web/src/boot/bootSplash.css': 'boot',
      'packages/web/src/theme/nightArt.css': 'night-art',
      'packages/web/src/routes/bench/SceneBench.css': 'bench',
    });
  });

  it('points every entry at files that exist, each stylesheet inside an art area', () => {
    for (const entry of [...ART_LAYER_PATHS, TOKEN_STYLESHEET]) {
      expect(globSync(entry, { cwd: REPO_ROOT }), entry).not.toEqual([]);
    }
    const inAreas = new Set(
      ART_LAYER_PATHS.flatMap((entry) => globSync(entry, { cwd: REPO_ROOT })),
    );
    for (const stylesheet of Object.keys(ART_LAYER_STYLESHEETS)) {
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

  it('holds HTML to its allow-list (P1 QA3 H4)', () => {
    const entry = '<script type="module" src="/src/main.tsx"></script>';
    const pages = {
      'packages/web/ok.html': `<link rel="stylesheet" href="/src/global.css" /><link rel="icon" href="/i.png">${entry}`,
      'packages/web/a.html': '<style>.a{}</style>',
      'packages/web/b.html': '<link href="/x.css" rel="preload stylesheet">',
      'packages/web/c.html':
        '<script>const l = document.createElement("link"); l.relList.add("stylesheet");</script>',
      'packages/web/d.html': '<div style="border-radius: 13px"></div>',
      'packages/web/e.html': '<svg><style>.a{}</style></svg>',
      'packages/web/f.html': '<link rel="preload" as="style" href="/x.css">',
      'packages/web/g.html': '<script type="module" src="/src/other.tsx"></script>',
      'packages/web/h.html': '<img src="/a.png" onload="this.remove()">',
      'packages/web/i.html': '<template><style>.a{}</style></template>',
      'packages/web/j.html': '<meta http-equiv="Link" content="</x.css>; rel=stylesheet">',
      'packages/web/k.html': '<iframe srcdoc="<style></style>"></iframe>',
    };
    const dir = scratch(pages);
    const registry = Object.fromEntries(Object.keys(pages).map((page) => [page, '/src/main.tsx']));
    const [ok, ...bad] = Object.keys(pages);
    expect(htmlProblems(dir, [ok], registry)).toEqual([]);
    for (const page of bad) expect(htmlProblems(dir, [page], registry), page).not.toEqual([]);
    // A CSP pragma only narrows what loads; a page nobody registered fails as a whole.
    const csp = scratch({
      'packages/web/csp.html': `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`,
      'packages/web/new.html': '<p></p>',
    });
    expect(htmlProblems(csp, ['packages/web/csp.html'], { 'packages/web/csp.html': '' })).toEqual(
      [],
    );
    expect(htmlProblems(csp, ['packages/web/new.html'], {})).toHaveLength(1);
  });

  it("rejects files in the bundle's reach that the gate cannot see (P1 QA3 H1, H7)", () => {
    const dir = scratch({
      'packages/web/src/ok.ts': '',
      'packages/web/src/a.js': '',
      'packages/web/src/b.mts': '',
      'packages/game-engine/src/c.mjs': '',
      'packages/game-engine/src/d.css': '',
      'packages/game-engine/src/ok.ts': '',
      'outside/e.css': '',
    });
    fs.symlinkSync(path.join(dir, 'outside'), path.join(dir, 'packages/web/src/linked'));
    const files = [
      'packages/web/src/ok.ts',
      'packages/web/src/a.js',
      'packages/web/src/b.mts',
      'packages/game-engine/src/c.mjs',
      'packages/game-engine/src/d.css',
      'packages/game-engine/src/ok.ts',
      'packages/web/src/linked',
      'outside/e.css',
    ];
    expect(bundleScopeProblems(dir, files).map((problem) => problem.split(':')[0])).toEqual([
      'packages/web/src/a.js',
      'packages/web/src/b.mts',
      'packages/game-engine/src/c.mjs',
      'packages/game-engine/src/d.css',
      'packages/web/src/linked',
    ]);
  });

  it('finds the repository closed and matching its baseline', async () => {
    const { problems, found } = await checkAllStyles(REPO_ROOT);
    expect(problems).toEqual([]);
    expect(mismatches(readBaseline(REPO_ROOT), found)).toEqual([]);
  }, 60_000);
});

describe('UI gate: configuration is pinned (P1 QA3 H11)', () => {
  it('has exactly the gate rules and the registry-derived Stylelint overrides', () => {
    expect(Object.keys(stylelintConfig.rules).sort()).toEqual(
      [
        'color-named',
        'color-no-hex',
        'function-disallowed-list',
        'ui/import-scope',
        'ui/no-css-escapes',
        'ui/no-local-literal-custom-property',
        'ui/no-system-color',
        'ui/strict-value',
      ].sort(),
    );
    expect(stylelintConfig.ignoreDisables).toBe(true);
    const valueRules = ['color-named', 'color-no-hex', 'function-disallowed-list'];
    const off = (rules) =>
      Object.entries(rules)
        .filter(([, value]) => value === null)
        .map(([rule]) => rule);
    const overrides = stylelintConfig.overrides.map(({ files, rules }) => ({
      files,
      off: off(rules).sort(),
      on: Object.fromEntries(Object.entries(rules).filter(([, value]) => value !== null)),
    }));
    const valueOff = [
      ...valueRules,
      'ui/no-local-literal-custom-property',
      'ui/no-system-color',
      'ui/strict-value',
    ].sort();
    expect(overrides).toEqual([
      { files: [TOKEN_STYLESHEET], off: valueOff, on: { 'ui/token-stylesheet-shape': true } },
      ...Object.entries(ART_LAYER_STYLESHEETS).map(([file, prefix]) => ({
        files: [file],
        off: valueOff,
        on: { 'ui/art-layer-scope': prefix },
      })),
    ]);
  });

  const GATE_RULES = [
    'ui/no-style-elements',
    'ui/import-scope',
    'ui/inline-style-static-keys',
    'no-eval',
    'no-new-func',
  ];

  it('sets the ESLint gate rules only in the gate blocks', () => {
    const blocks = eslintConfig
      .filter((block) => Object.keys(block.rules ?? {}).some((rule) => GATE_RULES.includes(rule)))
      .map((block) => ({
        files: block.files,
        rules: Object.keys(block.rules).filter((rule) => GATE_RULES.includes(rule)),
      }));
    expect(blocks).toEqual([
      { files: [...UI_GATE_SCRIPT_GLOBS], rules: GATE_RULES },
      {
        files: ['packages/web/build-plugins/**/*.ts', 'packages/web/vite.config.ts'],
        rules: ['ui/no-style-elements'],
      },
      { files: [...UI_GATE_TEST_GLOBS], rules: ['ui/no-style-elements'] },
    ]);
  });

  it.each([
    ['packages/web/src/App.tsx', {}],
    ['packages/web/src/features/room/x/Deep.tsx', {}],
    ['packages/game-engine/src/games/werewolf/x.ts', {}],
    ['packages/web/build-plugins/bootSplash.ts', { htmlTagDescriptors: true }],
    ['packages/web/src/features/x/A.test.tsx', { htmlSinks: false }],
    ['packages/web/src/scene/__tests__/exerciseDecoration.ts', { htmlSinks: false }],
  ])('applies the gate to %s', async (file, options) => {
    const config = await new ESLint({ cwd: REPO_ROOT }).calculateConfigForFile(file);
    for (const rule of GATE_RULES) expect(config.rules[rule]?.[0], `${file} ${rule}`).toBe(2);
    const [, actual = {}] = config.rules['ui/no-style-elements'];
    expect(actual).toEqual(options);
  });

  it('treats as checked CSS exactly the web package, minus anything installed', () => {
    expect(inCssGate('packages/web/src/theme/tokens.css')).toBe(true);
    expect(inCssGate('packages/web/preview/preview.css')).toBe(true);
    expect(inCssGate('packages/web/node_modules/x/y.css')).toBe(false);
    expect(inCssGate('node_modules/.pnpm/x/node_modules/x/y.css')).toBe(false);
    expect(inCssGate('packages/game-engine/src/x.css')).toBe(false);
    expect(inCssGate('packages/webx/a.css')).toBe(false);
  });

  it.each([
    'packages/web/src/App.tsx',
    'packages/web/src/features/x/A.test.tsx',
    'packages/web/src/features/x/a.test.ts',
    'packages/web/src/scene/__tests__/exerciseDecoration.ts',
    'packages/web/src/scene/__tests__/other.ts',
    'packages/web/src/test-utils/renderRoom.tsx',
    'packages/web/preview/PreviewApp.tsx',
    'packages/game-engine/src/games/werewolf/x.test.ts',
  ])('isTestModule(%s) matches where ESLint opens the HTML sinks (H8)', async (file) => {
    const config = await new ESLint({ cwd: REPO_ROOT }).calculateConfigForFile(file);
    const [, options = {}] = config.rules['ui/no-style-elements'] ?? [];
    expect(isTestModule(file)).toBe(options.htmlSinks === false);
  });
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
