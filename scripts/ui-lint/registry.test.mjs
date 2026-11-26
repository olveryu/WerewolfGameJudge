/**
 * The art layer is the one registered exemption from the UI gate's value rules (plan D7). Its
 * exact contents are pinned here: adding an art path is a visible change to this test.
 * The ratchet's pure comparisons are pinned here too.
 */
import fs from 'node:fs';
import path from 'node:path';

import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

import { growth, mismatches } from '../ui-baseline-ratchet.mjs';
import { ART_LAYER_PATHS, TOKEN_STYLESHEET } from './registry/artLayer.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

describe('UI gate: art layer registry', () => {
  it('lists exactly the approved art paths', () => {
    expect(ART_LAYER_PATHS).toEqual([
      'packages/web/src/scene/**',
      'packages/web/src/features/room/components/RoleRevealEffects/**',
      'packages/web/src/components/avatar/GeneratedAvatar.tsx',
      'packages/web/src/components/nameStyles/**',
      'packages/web/src/features/gacha/machine/**',
      'packages/web/src/boot/**',
      'packages/web/src/theme/nightArt.css',
      'packages/web/src/routes/bench/**',
    ]);
  });

  it('points every entry at files that exist', () => {
    for (const entry of [...ART_LAYER_PATHS, TOKEN_STYLESHEET]) {
      expect(globSync(entry, { cwd: REPO_ROOT }), entry).not.toEqual([]);
    }
    expect(fs.existsSync(path.join(REPO_ROOT, TOKEN_STYLESHEET))).toBe(true);
  });
});

describe('UI gate: baseline ratchet', () => {
  const base = { 'a.css': { 'ui/strict-value': { count: 3 } } };

  it('accepts an unchanged or shrunk record', () => {
    expect(growth(base, base)).toEqual([]);
    expect(growth({ 'a.css': { 'ui/strict-value': { count: 2 } } }, base)).toEqual([]);
    expect(growth({}, base)).toEqual([]);
  });

  it('rejects a new entry or a larger count', () => {
    expect(growth({ ...base, 'b.css': { 'color-named': { count: 1 } } }, base)).toEqual([
      'b.css → color-named: new entry (1)',
    ]);
    expect(growth({ 'a.css': { 'ui/strict-value': { count: 4 } } }, base)).toEqual([
      'a.css → ui/strict-value: 3 → 4',
    ]);
    expect(growth({ 'a.css': { 'color-no-hex': { count: 1 } } }, base)).toEqual([
      'a.css → color-no-hex: new entry (1)',
    ]);
  });

  it('carries entries across a rename', () => {
    const renamed = { 'b.css': { 'ui/strict-value': { count: 3 } } };
    expect(growth(renamed, base, new Map([['b.css', 'a.css']]))).toEqual([]);
    expect(growth(renamed, base)).toEqual(['b.css → ui/strict-value: new entry (3)']);
  });

  it('requires the record to equal the current counts exactly', () => {
    expect(mismatches(base, base)).toEqual([]);
    expect(mismatches(base, { 'a.css': { 'ui/strict-value': { count: 2 } } })).toEqual([
      'a.css → ui/strict-value: recorded 3, found 2',
    ]);
    expect(mismatches({}, base)).toEqual(['a.css → ui/strict-value: recorded 0, found 3']);
  });
});
