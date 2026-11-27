/**
 * The gate's comparison (plan v3 §3): equality with the baseline and shrink-only against the base.
 * The bundle graph is checked on the real repository: no problems, and the entries it must reach.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { bundleGraph } from './bundle.mjs';
import {
  BASELINE_FILE,
  baselineAt,
  comparisonBase,
  differences,
  growth,
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

  it('only shrinks against the base, following renames, letting a new rule record its debt', () => {
    const base = { rules: ['ui/value-allowlist'], files: { 'old.css': [A] } };
    expect(growth({ 'new.css': [A] }, base, new Map([['old.css', 'new.css']]))).toEqual([]);
    expect(growth({ 'new.css': [A] }, base, new Map())).toEqual([['new.css', A, 1]]);
    expect(growth({ 'old.css': [A, A] }, base, new Map())).toEqual([['old.css', A, 1]]);
    expect(growth({ 'old.css': [A, NEW] }, base, new Map())).toEqual([]);
    expect(growth({}, base, new Map())).toEqual([]);
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
        const [rule, messageId, source, ...rest] = key.split('\t');
        expect(saved.rules).toContain(rule);
        expect(messageId).toMatch(/^(?:[a-zA-Z]+)?$/);
        expect(source).not.toBe('');
        expect(rest).toEqual([]);
      }
  });
});

describe('bundle graph', () => {
  it('has no problems and reaches the app, the boot splash and the token sheet', () => {
    const graph = bundleGraph();
    expect(graph.problems).toEqual([]);
    expect(graph.scripts).toContain('packages/web/src/main.tsx');
    expect(graph.scripts).toContain('packages/web/src/boot/bootSplash.ts');
    expect(graph.styles).toContain('packages/web/src/theme/tokens.css');
    expect(graph.scripts.some((file) => file.startsWith('packages/game-engine/src/'))).toBe(true);
    expect(graph.scripts.some((file) => /\/__tests__\/|\.test\.tsx?$/.test(file))).toBe(false);
  }, 60_000);
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

  it('reads the base baseline, empty only when the commit has none', () => {
    expect(baselineAt(root, first)).toEqual({ rules: [], files: {} });
    expect(baselineAt(root, second)).toEqual({ rules: ['r'], files: {} });
    expect(() => baselineAt(root, 'f'.repeat(40))).toThrow();
  });

  it('follows renames since the base', () => {
    expect(renamesSince(root, first)).toEqual(new Map([['a.css', 'b.css']]));
  });
});
