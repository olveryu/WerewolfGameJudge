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
    ...result.invalidOptionWarnings.map((w) => ({ rule: 'invalid', text: w.text })),
  ];
}

const GREEN = [
  'a { border-radius: var(--radius-card); }',
  'a { box-shadow: var(--shadow-a), var(--shadow-b); }',
  'a { padding: 0 var(--space-small) calc(var(--space-small) * -1); }',
  'a { margin: auto; padding: env(safe-area-inset-bottom); }',
  'a { color: currentColor; background: transparent; border: var(--border-width) solid var(--color-border); }',
  '@keyframes spin { to { transform: rotate(1turn); } } a { transition: opacity var(--duration-fast) cubic-bezier(0.2, 0, 0, 1); animation: spin var(--duration-slow) linear infinite; }',
  'a { padding: env(safe-area-inset-top, var(--space-small)); }',
  'a { z-index: var(--layer-hand); font: inherit; font-weight: normal; }',
  'a { width: 100%; max-width: var(--size-max-content-width); min-height: 100dvh; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }',
  'a { transform: translateY(-50%) rotate(45deg) scale(1.05); transform-origin: center top; }',
  'a { scale: 1.05; transform: scaleX(-1); }',
  'a { top: calc(100% - var(--space-small)); inset: 0; opacity: 1; flex: 1 1 auto; vertical-align: middle; }',
  'a { fill: url(#g); stroke: currentColor; background: url(./x.png) no-repeat; }',
  'a { -webkit-line-clamp: 2; -webkit-tap-highlight-color: transparent; }',
  'a { --local-ref: var(--space-small); --local-zero: 0; }',
  'a { background: linear-gradient(180deg, var(--a) 0%, var(--b) 100%); }',
  'a { clip-path: inset(0 0 50% 0 round var(--radius-card)); }',
  '@media (forced-colors: active) { a { color: ButtonText; --hand-border: ButtonBorder; } }',
  'a { color: var(--a, var(--b)); }',
  // Container query units (Modern Web Guidance `css`).
  'a { width: 50cqi; height: 100cqb; }',
  // Conditions test registered features with keyword values (P1 QA12 nit 8).
  '@media (hover: hover) and (pointer: fine) { a { opacity: 1; } }',
  '@media (prefers-reduced-motion: reduce) { a { opacity: 1; } }',
  '@supports (appearance: base-select) { a { opacity: 1; } }',
  '@supports selector(:has(a)) { a { opacity: 1; } }',
];

const RED = [
  // `@layer` and `@scope` are not registered at-rules (D14, user's whitelist rule 14:43).
  '@layer base { a { opacity: 1; } }',
  '@scope (.card) { a { opacity: 1; } }',
  // A length in a condition is a breakpoint; none is registered before P3 (P1 QA12 nit 8).
  '@media (max-width: 391px) { a { opacity: 1; } }',
  '@media (width >= 768px) { a { opacity: 1; } }',
  '@container card (min-width: 20rem) { a { opacity: 1; } }',
  '@media (orientation: landscape) { a { opacity: 1; } }',
  // A discrete feature takes only its registered keywords (P1 QA13 N2).
  '@media (hover: banana) { a { opacity: 1; } }',
  '@media (prefers-reduced-motion: fast) { a { opacity: 1; } }',
  '@supports (padding: 13px) { a { opacity: 1; } }',
  // `vh`/`vw` break when mobile browser UI shows or hides: `dvh`/`dvw` (Modern Web Guidance
  // `responsive-design`).
  'a { min-height: 100vh; }',
  // Keywords and counts only (P1 QA10 S4); `clip` is gone, `clip-path: inset(50%)` replaces it.
  'a { text-size-adjust: 137%; }',
  'a { cursor: url(./x.png) 13 13, pointer; cursor: default; grid-row: 2px; }',
  'a { clip: rect(0, 0, 0, 0); }',
  'a { width: calc(100vw - var(--space-small)); }',
  // `url()` references only a relative asset (a bundle graph edge) or a fragment (P1 QA17 F5).
  "a { background-image: url('data:image/svg+xml,<svg fill=%22red%22/>'); }",
  'a { background-image: url(https://a.example/x.png); }',
  'a { background-image: url(/x.png); }',
  // A plain number in a transform is a factor only in `scale` (P1 QA17 N1).
  'a { transform: translate(37, 12); }',
  'a { transform: rotate(45); }',
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
  // Sizes, offsets, opacity and transforms are token domains too (QA5 K1).
  'a { width: 44px; }',
  'a { height: 44px; }',
  'a { min-height: 44px; }',
  'a { grid-template-columns: 120px 1fr; }',
  'a { top: 12px; }',
  'a { opacity: 0.6; }',
  'a { stroke-width: 2px; }',
  'a { transform: translateY(-4px); }',
  'a { flex-basis: 37px; }',
  'a { inset: 13px; }',
  'a { vertical-align: -2px; }',
  'a { perspective: 400px; }',
  'a { translate: 0 2px; }',
  'a { flex: 0 0 120px; }',
  // A local variable only aliases tokens and never redefines one (QA5 K2, K9).
  'a { --fw: 700; font-weight: var(--fw); }',
  'a { --lh: 1.4; line-height: var(--lh); }',
  'a { --z: 999; z-index: var(--z); }',
  'a { --f: 1.625; border-radius: calc(var(--radius-small) * var(--f)); }',
  'a { --local-scale: 1.4; }',
  'a { --color-primary: var(--color-danger); }',
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
  // A shape's lengths and a filter's coefficients are hard-coded like any other (P1 QA18).
  'a { clip-path: inset(13px); }',
  'a { clip-path: circle(40px at 50% 50%); }',
  'a { filter: brightness(0.92); }',
  // Written as a percentage alike (P1 QA21 F2).
  'a { filter: brightness(92%); }',
  'a { filter: saturate(150%) contrast(37%) grayscale(37%); }',
  'a { backdrop-filter: brightness(50%); }',
  // A `var()` fallback is the function's argument when unset (P1 QA22 F1).
  'a { filter: brightness(var(--qa-none, 92%)); }',
  'a { border-r\\61 dius: 50%; }',
  'a { mystery-property: 1; }',
  '@property --x { syntax: "<length>"; inherits: false; initial-value: 13px; }',
  '@font-face { font-family: x; }',
  // env() fallbacks are values of the domain, like var() fallbacks (QA6 L1).
  'a { padding: env(nope, 13px); }',
  'a { top: env(safe-area-inset-top, 20px); }',
  'a { --r: env(x, 13px); border-radius: var(--r); }',
  'a { padding: env(--x); }',
  // An animation runs only keyframes its own sheet defines (QA6 L3).
  'a { animation: night-art-fade var(--duration-slow); }',
  'a { animation-name: fade; }',
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
  // A comment in the value: PostCSS strips it from `decl.value`, so offsets into the source are
  // unknown and the whole declaration is the reported span (P1 QA10 FIX-FIRST-1).
  it('reports a value with a comment across its whole declaration', async () => {
    const [warning] = await warnings('a {\n  padding: var(--a) /* top */\n    1px;\n}');
    expect([warning.line, warning.endLine]).toEqual([2, 3]);
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
  it('lets an art sheet style its own classes with allowed values', async () => {
    expect(
      await warnings(
        '.night-art .night-art-title { font-size: var(--font-size-title); color: var(--color-text); }\n.night-art:hover > .night-art__x::before { opacity: 0; }\n.night-art-y { &:hover { opacity: 1; } }\n@keyframes night-art-x { from { opacity: 0; } }\n.night-art-z { animation: night-art-x var(--duration-slow); }',
        ART,
      ),
    ).toEqual([]);
  });
  // No sheet's values go unchecked (D7): an art sheet's written values are reported.
  it.each([
    '.night-art-title { font-size: 31px; }',
    '.night-art-title { color: #fff; }',
    '.night-art-x::before { opacity: 0.4; }',
    '@media (max-width: 391px) { .night-art { opacity: 1; } }',
  ])('reports the written value %s in an art sheet', async (code) => {
    expect((await warnings(code, ART)).map((w) => w.rule)).toContain('ui/value-allowlist');
  });
  it.each([
    '.avatar { border-radius: 13px; }',
    '.night-art + .avatar { border-radius: 13px; }',
    '.night-art :is(.avatar) { border-radius: 13px; }',
    '.night-art { .avatar { border-radius: 13px; } }',
    'img { border-radius: 13px; }',
    '[class*="avatar"] { border-radius: 13px; }',
    '.night-art\\2d x { color: red; }',
    // The subject must be an art element (QA5 K3).
    ':not(.night-art) { border-radius: 3px; }',
    '.night-art ~ * { border-radius: 3px; }',
    ':root:has(.night-art) button { border-radius: 3px; }',
    '.night-art + div, .night-art > button { padding: 3px; }',
    '.night-art > :not(.night-art-x) { padding: 3px; }',
    // An art sheet still may not redefine a token (QA6 L2), and its keyframes are art (L3).
    '.night-art-bottom { --radius-medium: 0px; }',
    '.night-art-bottom { --color-primary: #f00; }',
    '@keyframes fade { to { border-radius: 3px; color: red; } }',
    '.night-art { & .avatar { padding: 3px; } }',
  ])('rejects %s in an art sheet', async (code) => {
    expect((await warnings(code, ART)).length).toBeGreaterThan(0);
  });
});

describe('rule options', () => {
  // A rule enabled without its allow lists fails loudly instead of checking nothing.
  it.each([
    ['ui/value-allowlist', true],
    ['ui/value-allowlist', { tokens: ['--a'] }],
    ['ui/sheet-scope', { kind: 'art' }],
    ['ui/sheet-scope', { kind: 'tokens' }],
  ])('%s with %j', async (rule, options) => {
    await expect(
      stylelint.lint({
        code: 'a { color: red; }',
        codeFilename: UI,
        config: { plugins: config.plugins, rules: { [rule]: options } },
      }),
    ).rejects.toThrow(rule);
  });
});
