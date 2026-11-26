/**
 * The CSS rules of the UI gate (plan v3 §2 S1, S2, S4, S7, S10), run through the gate's own
 * configuration. Red cases are drift an ordinary developer writes and values outside the allow
 * lists however they are spelled; green cases are the token forms the gate exists to allow.
 */
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import { ART_SHEETS, TOKEN_SHEET } from './registry.mjs';
import config from './stylelint.gate.mjs';

const UI = 'packages/web/src/features/x/X.css';
const ART = Object.keys(ART_SHEETS).find((file) => ART_SHEETS[file] === 'night-art');

async function warnings(code, codeFilename = UI) {
  const { results } = await stylelint.lint({
    code,
    codeFilename,
    config,
    configBasedir: process.cwd(),
  });
  const [result] = results;
  return [
    ...result.warnings,
    ...(result.invalidOptionWarnings ?? []).map((w) => ({ rule: 'invalid', text: w.text })),
  ];
}

const GREEN = [
  'a { border-radius: var(--radius-card); }',
  'a { box-shadow: var(--shadow-a), var(--shadow-b); }',
  'a { padding: 0 var(--space-small) calc(var(--space-small) * -1); }',
  'a { margin: auto; padding: env(safe-area-inset-bottom); }',
  'a { color: currentColor; background: transparent; border: var(--border-width) solid var(--color-border); }',
  'a { transition: opacity var(--duration-fast) cubic-bezier(0.2, 0, 0, 1); animation: spin var(--duration-slow) linear infinite; }',
  'a { z-index: var(--layer-hand); font: inherit; font-weight: normal; }',
  'a { width: 320px; transform: translateY(4px); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }',
  'a { -webkit-line-clamp: 2; -webkit-tap-highlight-color: transparent; }',
  'a { --local-scale: 1.4; --local-ref: var(--space-small); }',
  'a { background: linear-gradient(180deg, var(--a) 0%, var(--b) 100%); }',
  'a { clip-path: inset(0 0 50% 0 round var(--radius-card)); }',
  '@media (forced-colors: active) { a { color: ButtonText; --hand-border: ButtonBorder; } }',
  'a { color: var(--a, var(--b)); }',
];

const RED = [
  // Ordinary drift (S1/S2).
  'a { border-radius: 13px; }',
  'a { padding: 4px 8px; }',
  'a { font-size: 14px; }',
  'a { font-weight: 600; }',
  'a { line-height: 1.4; }',
  'a { z-index: 9999; }',
  'a { transition: opacity 100ms ease; }',
  'a { box-shadow: 0 0 8px var(--glow); }',
  'a { border: 1px solid var(--color-border); }',
  'a { color: #fff; }',
  'a { color: red; }',
  'a { background: white; }',
  'a { border-radius: calc(var(--radius-small) * 1.625); }',
  'a { font-family: Menlo, monospace; }',
  'a { --probe-r: 13px; }',
  'a { --probe-c: #fff; }',
  // Outside the allow lists, however spelled (QA1 F1–F7, QA2 G7/G8, QA3 H9).
  'a { color: RGB(1, 2, 3); }',
  'a { color: rgb(1 2 3); }',
  'a { color: color-mix(in srgb, var(--a), white); }',
  'a { border-radius: round(13px, 1px); }',
  'a { border-radius: abs(-13px); }',
  'a { border-radius: -webkit-calc(13px); }',
  'a { border-radius: calc(999px); }',
  'a { border-radius: 100\\px; }',
  'a { -webkit-border-radius: 13px; }',
  'a { grid-gap: 4px; }',
  'a { font: 14px/1.4 sans-serif; }',
  'a { font: caption; }',
  'a { border-width: thick; }',
  'a { font-variation-settings: "wght" 600; }',
  'a { color: Canvas; }',
  'a { content: attr(data-x); border-radius: attr(data-r px); }',
  'a { clip-path: inset(0 round 13px); }',
  'a { border-r\\61 dius: 50%; }',
  'a { mystery-property: 1; }',
  '@property --x { syntax: "<length>"; inherits: false; initial-value: 13px; }',
  '@font-face { font-family: x; }',
];

describe('ui/value-allowlist', () => {
  it.each(GREEN)('allows %s', async (code) => {
    expect(await warnings(code)).toEqual([]);
  });
  it.each(RED)('rejects %s', async (code) => {
    expect((await warnings(code)).length).toBeGreaterThan(0);
  });
  it('reports at the offending word', async () => {
    const [warning] = await warnings('a {\n  color: var(--a);\n  padding: 0\n    13px;\n}');
    expect(warning.line).toBe(4);
  });
  it('ignores inline disable comments', async () => {
    expect(
      await warnings(
        '/* stylelint-disable */\na { border-radius: 13px; } /* stylelint-disable-line */',
      ),
    ).not.toEqual([]);
  });
});

describe('ui/sheet-scope', () => {
  it('lets the token sheet hold token definitions under its selectors', async () => {
    expect(
      await warnings(
        ':root { --radius-card: 16px; }\n.admin-console { --a: #fff; }',
        TOKEN_SHEET.file,
      ),
    ).toEqual([]);
  });
  it.each([
    ':root { color: red; }',
    '.avatar { --x: 1px; }',
    ':root, .avatar { --x: 1px; }',
    '.admin\\-console { --x: 1px; }',
  ])('rejects %s in the token sheet', async (code) => {
    expect((await warnings(code, TOKEN_SHEET.file)).length).toBeGreaterThan(0);
  });
  it('lets an art sheet write values on its own classes', async () => {
    expect(
      await warnings(
        '.night-art .night-art-title { font-size: 31px; color: #fff; }\n@keyframes x { from { opacity: 0; } }',
        ART,
      ),
    ).toEqual([]);
  });
  it.each([
    '.avatar { border-radius: 13px; }',
    '.night-art + .avatar { border-radius: 13px; }',
    '.night-art :is(.avatar) { border-radius: 13px; }',
    '.night-art { .avatar { border-radius: 13px; } }',
    'img { border-radius: 13px; }',
    '[class*="avatar"] { border-radius: 13px; }',
    '.night-art\\2d x { color: red; }',
  ])('rejects %s in an art sheet', async (code) => {
    expect((await warnings(code, ART)).length).toBeGreaterThan(0);
  });
});
