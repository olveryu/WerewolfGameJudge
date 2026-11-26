/**
 * The gate's comparison (plan v3 §3): equality with the baseline and shrink-only against the base.
 * The bundle graph is checked on the real repository: no problems, and the entries it must reach.
 */
import { describe, expect, it } from 'vitest';

import { bundleGraph } from './bundle.mjs';
import { differences, growth } from './gate.mjs';

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
