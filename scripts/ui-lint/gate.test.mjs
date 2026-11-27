/**
 * The gate's comparison (plan v3 §3): equality with the baseline and shrink-only against the base.
 * The bundle graph is checked on the real repository: no problems, and the entries it must reach.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { bundleGraph, REPO_ROOT } from './bundle.mjs';
import {
  BASELINE_FILE,
  baselineAt,
  comparisonBase,
  differences,
  growth,
  presentAt,
  renamesSince,
} from './gate.mjs';

const A = 'ui/value-allowlist\tm\tborder-radius: 13px;';
const B = 'ui/value-allowlist\tm\tpadding: 4px;';
const NEW = 'ui/new-rule\tm\tx';

describe('baseline comparison', () => {
  it('is exact: a fixed violation still in the baseline differs', () => {
    expect(differences({ 'a.css': [A] }, { 'a.css': [A, A] })).toEqual([['a.css', A, -1]]);
    expect(differences({ 'a.css': [A, B] }, { 'a.css': [A] })).toEqual([['a.css', B, 1]]);
    expect(differences({ 'a.css': [A] }, { 'a.css': [A] })).toEqual([]);
  });

  const always = () => true;
  it('only shrinks against the base, following renames', () => {
    const base = { rules: ['ui/value-allowlist'], files: { 'old.css': [A] } };
    expect(growth({ 'new.css': [A] }, base, new Map([['old.css', 'new.css']]), always)).toEqual([]);
    expect(growth({ 'new.css': [A] }, base, new Map(), always)).toEqual([['new.css', A, 1]]);
    expect(growth({ 'old.css': [A, A] }, base, new Map(), always)).toEqual([['old.css', A, 1]]);
    expect(growth({}, base, new Map(), always)).toEqual([]);
  });

  // A rule new to the base records existing debt only: every source text of the fingerprint was
  // already at the base (P1 QA10 FIX-FIRST-2).
  it('lets a new rule record only debt that was already there', () => {
    const base = { rules: ['ui/value-allowlist'], files: {} };
    const sourced = `${NEW}\tt.ts: c: '#f00',`;
    const without = (file, text) => (seen) => (f, t) => !(f === file && t === text) && seen;
    expect(growth({ 'old.css': [NEW] }, base, new Map(), always)).toEqual([]);
    expect(growth({ 'old.css': [NEW] }, base, new Map(), without('old.css', 'x')(true))).toEqual([
      ['old.css', NEW, 1],
    ]);
    expect(growth({ 'a.tsx': [sourced] }, base, new Map(), always)).toEqual([]);
    expect(
      growth({ 'a.tsx': [sourced] }, base, new Map(), without('t.ts', "c: '#f00',")(true)),
    ).toEqual([['a.tsx', sourced, 1]]);
    // A renamed file is looked up under its name at the base.
    const asked = [];
    growth({ 'b.css': [NEW] }, base, new Map([['a.css', 'b.css']]), (f) => asked.push(f) > 0);
    expect(asked).toEqual(['a.css']);
    // The first baseline: no rules at the base at all.
    expect(
      growth(
        { 'a.css': [A] },
        { rules: [], files: {} },
        new Map(),
        without('a.css', 'border-radius: 13px;')(true),
      ),
    ).toEqual([['a.css', A, 1]]);
  });
});

describe('baseline format (P1 QA7 F2)', () => {
  // A fingerprint is rule ID, message ID and source line; the message text is not part of it, so
  // rewording a message never turns recorded debt into new debt.
  it('records identities, not message text', () => {
    const saved = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, '../..', BASELINE_FILE), 'utf8'),
    );
    for (const list of Object.values(saved.files))
      for (const key of list) {
        // rule, message ID, source line, then the lines the value is written on elsewhere
        const [rule, messageId, ...sources] = key.split('\t');
        expect(saved.rules).toContain(rule);
        expect(messageId).toMatch(/^(?:[a-zA-Z]+)?$/);
        expect(sources.length).toBeGreaterThan(0);
        for (const source of sources) expect(source).not.toBe('');
      }
  });
});

// One graph for both describes below (it takes about a minute on a shared runner).
let graphOnce;
const graph = () => (graphOnce ??= bundleGraph());

describe('bundle graph against Vite (P1 QA8 should-fix 5)', () => {
  // The graph is the gate's scope because it is what Vite bundles: checked against Vite's own
  // build, every module of the repository Vite transforms is in the graph. A gap here is a module
  // that reaches the page unchecked; extra graph files (type-only imports elided by Vite) are
  // checked needlessly, never missed.
  it('holds every repository module of the production build', async () => {
    const web = path.join(REPO_ROOT, 'packages/web');
    const require = createRequire(path.join(web, 'package.json'));
    const { build } = await import(pathToFileURL(require.resolve('vite')).href);
    const transformed = new Set();
    await build({
      root: web,
      logLevel: 'silent',
      build: { write: false },
      plugins: [
        {
          name: 'ui-gate-collect',
          transform(_code, id) {
            const file = id.split('?')[0];
            if (path.isAbsolute(file) && !file.split(path.sep).includes('node_modules'))
              transformed.add(path.relative(REPO_ROOT, file).split(path.sep).join('/'));
          },
        },
      ],
    });
    const { scripts, styles } = graph();
    const scope = new Set([...scripts, ...styles]);
    const modules = [...transformed].filter((file) => /\.(?:tsx?|css)$/.test(file));
    expect(modules.length).toBeGreaterThan(1000);
    expect(modules.filter((file) => !scope.has(file))).toEqual([]);
  }, 900_000);
});

describe('bundle graph', () => {
  it('has no problems and reaches the app, the boot splash and the token sheet', () => {
    const result = graph();
    expect(result.problems).toEqual([]);
    expect(result.scripts).toContain('packages/web/src/main.tsx');
    expect(result.scripts).toContain('packages/web/src/boot/bootSplash.ts');
    expect(result.styles).toContain('packages/web/src/theme/tokens.css');
    expect(result.scripts.some((file) => file.startsWith('packages/game-engine/src/'))).toBe(true);
    expect(result.scripts.some((file) => /\/__tests__\/|\.test\.tsx?$/.test(file))).toBe(false);
  }, 300_000);
});

describe('comparison base (P1 QA5 K10)', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'ui-gate-base-'));
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-q');
  fs.writeFileSync(path.join(root, 'a.css'), 'a {}\n'.repeat(20));
  git('add', '-A');
  git('commit', '-q', '-m', 'first');
  const first = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, BASELINE_FILE), JSON.stringify({ rules: ['r'], files: {} }));
  git('mv', 'a.css', 'b.css');
  git('add', '-A');
  git('commit', '-q', '-m', 'second');
  const second = git('rev-parse', 'HEAD');

  it('takes UI_GATE_BASE in CI and fails closed without it or on a missing commit', () => {
    expect(comparisonBase(root, { UI_GATE_BASE: 'HEAD^1', GITHUB_ACTIONS: 'true' })).toBe(first);
    expect(() => comparisonBase(root, { GITHUB_ACTIONS: 'true' })).toThrow(/UI_GATE_BASE/);
    expect(() => comparisonBase(root, { UI_GATE_BASE: '0'.repeat(40) })).toThrow(/zero SHA/);
    expect(() => comparisonBase(root, { UI_GATE_BASE: 'f'.repeat(40) })).toThrow();
  });

  it('knows which source text was already at the base', () => {
    fs.writeFileSync(path.join(root, 'c.css'), 'a {\n  padding: 1px;\n}\n');
    const present = presentAt(root, second);
    expect(present('b.css', 'a {} a {}')).toBe(true);
    expect(present('c.css', 'padding: 1px;')).toBe(false);
    fs.rmSync(path.join(root, 'c.css'));
    expect(presentAt(root, first)('a.css', 'a {}')).toBe(true);
  });

  it('reads the base baseline, empty only when the commit has none', () => {
    expect(baselineAt(root, first)).toEqual({ rules: [], files: {} });
    expect(baselineAt(root, second)).toEqual({ rules: ['r'], files: {} });
    expect(() => baselineAt(root, 'f'.repeat(40))).toThrow();
  });

  it('follows renames since the base', () => {
    expect(renamesSince(root, first)).toEqual(new Map([['a.css', 'b.css']]));
  });
});
