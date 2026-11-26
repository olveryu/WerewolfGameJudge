/**
 * The art layer is the one registered exemption from the UI gate's value rules (plan D7). Its
 * exact contents are pinned here: adding an art path is a visible change to this test.
 * The ratchet's comparisons and its disable-directive scan are pinned here too.
 */
import fs from 'node:fs';
import path from 'node:path';

import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

import {
  disableDirectiveProblems,
  growth,
  mismatches,
  recordFrom,
  STYLELINT_FILES,
} from '../ui-baseline-ratchet.mjs';
import { gateDisableDirectives } from './disableDirectives.mjs';
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
      'packages/web/src/boot/bootSplash.css',
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
  const message = (entry, count) =>
    `${entry}: new entry (${count}) for a rule that already applied`;

  it('accepts an unchanged or shrunk record', async () => {
    expect(await growth(base, base)).toEqual([]);
    expect(await growth({ 'a.css': { 'ui/strict-value': { count: 2 } } }, base)).toEqual([]);
    expect(await growth({}, base)).toEqual([]);
  });

  it('rejects a new entry for a rule that already applied, or a larger count', async () => {
    expect(await growth({ ...base, 'b.css': { 'color-named': { count: 1 } } }, base)).toEqual([
      message('b.css → color-named', 1),
    ]);
    expect(await growth({ 'a.css': { 'ui/strict-value': { count: 4 } } }, base)).toEqual([
      'a.css → ui/strict-value: 3 → 4',
    ]);
    expect(await growth({ 'a.css': { 'color-no-hex': { count: 1 } } }, base)).toEqual([
      message('a.css → color-no-hex', 1),
    ]);
  });

  it('lets only the PR that brings a rule to a file record its debt', async () => {
    const appliedAtBase = async (file, rule) => !(file === 'b.css' && rule === 'ui/new-rule');
    const current = { ...base, 'b.css': { 'ui/new-rule': { count: 5 } } };
    expect(await growth(current, base, new Map(), appliedAtBase)).toEqual([]);
    const other = { ...base, 'c.css': { 'ui/new-rule': { count: 1 } } };
    expect(await growth(other, base, new Map(), appliedAtBase)).toEqual([
      message('c.css → ui/new-rule', 1),
    ]);
  });

  it('carries entries across a rename', async () => {
    const renamed = { 'b.css': { 'ui/strict-value': { count: 3 } } };
    expect(await growth(renamed, base, new Map([['b.css', 'a.css']]))).toEqual([]);
    expect(await growth(renamed, base)).toEqual([message('b.css → ui/strict-value', 3)]);
  });

  it('requires the record to equal the current counts exactly', () => {
    expect(mismatches(base, base)).toEqual([]);
    expect(mismatches(base, { 'a.css': { 'ui/strict-value': { count: 2 } } })).toEqual([
      'a.css → ui/strict-value: recorded 3, found 2',
    ]);
    expect(mismatches({}, base)).toEqual(['a.css → ui/strict-value: recorded 0, found 3']);
  });

  it('writes the record from the current counts only, so moved and deleted paths drop out', () => {
    const counts = { 'z.css': { b: { count: 1 }, a: { count: 2 } }, 'm.css': { c: { count: 1 } } };
    const record = recordFrom(counts);
    expect(Object.keys(record)).toEqual(['m.css', 'z.css']);
    expect(Object.keys(record['z.css'])).toEqual(['a', 'b']);
  });

  it('runs Stylelint over the same files as the package scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['lint:css']).toContain(`"${STYLELINT_FILES}"`);
  });
});

describe('UI gate: disable directives', () => {
  const offending = [
    '/* eslint-disable */',
    '// eslint-disable-next-line',
    '// eslint-disable-next-line ui/no-style-elements',
    '/* eslint-disable ui/inline-style-static-keys */',
    '// eslint-disable-line react/no-danger, no-eval -- reason',
    '/* eslint no-new-func: off */',
    '/* eslint-disable-next-line @typescript-eslint/no-implied-eval */',
    '/* eslint-disable\n  ui/no-style-elements */',
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
    ].join('\n');
    expect(gateDisableDirectives(source)).toEqual([]);
  });

  it('reports the line of the directive', () => {
    expect(gateDisableDirectives('a;\nb;\n/* eslint-disable */')).toEqual([
      { line: 3, text: '/* eslint-disable */' },
    ]);
  });

  it('finds none in the web client', () => {
    expect(disableDirectiveProblems(REPO_ROOT)).toEqual([]);
  });
});
