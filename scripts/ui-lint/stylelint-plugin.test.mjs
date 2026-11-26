/**
 * The CSS half of the UI gate: each rule rejects the drift it exists for and accepts the token
 * spellings main already uses. Cases named M1–M6 and Q1–Q3 reproduce the injection probes of the UI drift
 * audit and avatar QA13 that the previous regex contract let through.
 */
import path from 'node:path';

import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CONFIG_FILE = path.join(REPO_ROOT, 'stylelint.config.mjs');

async function problems(code, file = 'packages/web/src/features/probe/Probe.css') {
  const { results } = await stylelint.lint({
    code,
    codeFilename: path.join(REPO_ROOT, file),
    configFile: CONFIG_FILE,
    cwd: REPO_ROOT,
  });
  return results.flatMap((result) => result.warnings.map((warning) => warning.rule));
}

const rejected = [
  ['M1 radius literal', 'a { border-radius: 13px; }', 'ui/strict-value'],
  ['M2 named color', 'a { color: white; }', 'color-named'],
  ['M2 named color in a shorthand', 'a { border: var(--w) solid red; }', 'color-named'],
  ['M3 shadow length', 'a { box-shadow: 0 9px var(--x) var(--c); }', 'ui/strict-value'],
  ['M4 local literal variable', 'a { --probe-r: 13px; }', 'ui/no-local-literal-custom-property'],
  ['M5 z-index literal', 'a { z-index: 9999; }', 'ui/strict-value'],
  ['M6 em padding', 'a { padding: 0.5em; }', 'ui/strict-value'],
  ['M6 letter-spacing', 'a { letter-spacing: 3px; }', 'ui/strict-value'],
  ['rem font size', 'a { font-size: 0.875rem; }', 'ui/strict-value'],
  ['numeric weight', 'a { font-weight: 700; }', 'ui/strict-value'],
  ['keyword weight', 'a { font-weight: bold; }', 'ui/strict-value'],
  ['unitless line height', 'a { line-height: 1.6; }', 'ui/strict-value'],
  ['named size', 'a { font-size: small; }', 'ui/strict-value'],
  ['hairline padding', 'a { padding: 1px; }', 'ui/strict-value'],
  ['border shorthand width', 'a { border: 1px solid var(--c); }', 'ui/strict-value'],
  ['border width keyword', 'a { border-width: thin; }', 'ui/strict-value'],
  ['logical border width', 'a { border-inline-start-width: 2px; }', 'ui/strict-value'],
  ['transition time', 'a { transition: opacity 100ms ease; }', 'ui/strict-value'],
  ['animation delay', 'a { animation-delay: 1s; }', 'ui/strict-value'],
  ['literal inside calc', 'a { margin: calc(13px * 2); }', 'ui/strict-value'],
  ['literal inside max', 'a { padding: max(var(--a), 12px); }', 'ui/strict-value'],
  ['literal var fallback', 'a { padding: var(--missing, 12px); }', 'ui/strict-value'],
  ['literal env fallback', 'a { padding: env(safe-area-inset-top, 8px); }', 'ui/strict-value'],
  ['keyframes radius', '@keyframes k { from { border-radius: 4px; } }', 'ui/strict-value'],
  ['corner longhand', 'a { border-top-left-radius: 50%; }', 'ui/strict-value'],
  ['hex color', 'a { color: #fff; }', 'color-no-hex'],
  ['rgb color', 'a { background: rgb(0 0 0 / 50%); }', 'function-disallowed-list'],
  ['oklch color', 'a { color: oklch(70% 0.1 200); }', 'function-disallowed-list'],
  ['local literal time', 'a { --probe-t: 120ms; }', 'ui/no-local-literal-custom-property'],
  ['Q1 escaped property name', 'img { border-r\\61 dius: 50%; }', 'ui/no-css-escapes'],
  ['Q2 escaped clip-path', '.host { clip-p\\61 th: circle(); }', 'ui/no-css-escapes'],
  ['Q3 escaped custom property', 'a { --avatar-corner-r\\61 tio: 0.5; }', 'ui/no-css-escapes'],
  ['escaped selector', '.a\\:b { display: block; }', 'ui/no-css-escapes'], // P1 QA1: spellings that got past the first version.
  ['F1 uppercase color function', 'a { color: RGB(1, 2, 3); }', 'function-disallowed-list'],
  ['F1 mixed-case color function', 'a { --c: Hsla(0 0% 0% / 1); }', 'function-disallowed-list'],
  ['F2 prefixed radius', 'a { -webkit-border-radius: 13px; }', 'ui/strict-value'],
  ['F2 prefixed transition', 'a { -webkit-transition: opacity 100ms; }', 'ui/strict-value'],
  ['F2 prefixed animation', 'a { -webkit-animation: k 300ms; }', 'ui/strict-value'],
  ['F2 prefixed shadow length', 'a { -webkit-box-shadow: 0 0 4px var(--c); }', 'ui/strict-value'],
  ['F3 font shorthand', 'a { font: 600 14px/1.2 sans-serif; }', 'ui/strict-value'],
  [
    'F3 font shorthand keyword',
    'a { font: bold var(--f) / var(--l) sans-serif; }',
    'ui/strict-value',
  ],
  ['F4 round()', 'a { border-radius: round(13px, 1px); }', 'ui/strict-value'],
  ['F4 abs()', 'a { padding: abs(13px); }', 'ui/strict-value'],
  ['F4 mod()', 'a { margin: mod(13px, 100px); }', 'ui/strict-value'],
  ['F4 prefixed calc', 'a { padding: -webkit-calc(13px); }', 'ui/strict-value'],
  ['F4 local round()', 'a { --r: round(13px, 1px); }', 'ui/no-local-literal-custom-property'],
  ['F5 z-index in calc', 'a { z-index: calc(999); }', 'ui/strict-value'],
  ['F5 z-index in max', 'a { z-index: max(999); }', 'ui/strict-value'],
  ['F5 weight in calc', 'a { font-weight: calc(700); }', 'ui/strict-value'],
  ['F5 line height in calc', 'a { line-height: calc(1.5); }', 'ui/strict-value'],
  ['F6 escaped time unit', 'a { transition: opacity 100\\ms; }', 'ui/no-css-escapes'],
  ['F6 hex-escaped time unit', 'a { transition: opacity 100\\6d s; }', 'ui/no-css-escapes'],
  ['F6 escaped keyframes name', '@keyframes \\61 b { from { opacity: 0; } }', 'ui/no-css-escapes'],
  ['F7 local named size', 'a { --fs: larger; }', 'ui/no-local-literal-custom-property'],
  ['F7 local named weight', 'a { --w: bold; }', 'ui/no-local-literal-custom-property'],
  ['outline width', 'a { outline: 2px solid var(--c); }', 'ui/strict-value'],
  ['outline offset', 'a { outline-offset: 2px; }', 'ui/strict-value'],
  ['text shadow length', 'a { text-shadow: 0 1px var(--c); }', 'ui/strict-value'],
  ['F10 disable comment', '/* stylelint-disable */ a { border-radius: 13px; }', 'ui/strict-value'],
  [
    'F10 disable-line comment',
    'a { z-index: 9999; } /* stylelint-disable-line */',
    'ui/strict-value',
  ],
];

const accepted = [
  ['token z-index', 'a { z-index: var(--z-overlay); }'],
  ['font shorthand reset', 'a { font: inherit; }'],
  [
    'font shorthand token',
    'a { font: var(--font-weight-bold) var(--font-size-md) / var(--line-height-body) system-ui; }',
  ],
  ['unitless factor in calc', 'a { padding: calc(var(--space-2) * 2); }'],
  [
    'easing function numbers',
    'a { transition: opacity var(--motion-fast) cubic-bezier(0.2, 0, 0, 1); }',
  ],
  ['step easing', 'a { animation: k var(--motion-slow) steps(4, end); }'],
  ['unitless local scale', 'a { --cell-peak: 1.08; }'],
  ['round() keyword and tokens', 'a { margin: round(up, var(--a), var(--b)); }'],
  ['token padding pair', 'a { padding: var(--a) var(--b); }'],
  ['zero and auto', 'a { margin: 0 auto; }'],
  ['multi-value token shadow', 'a { box-shadow: var(--shadow-tabletop-panel), var(--shadow-md); }'],
  ['inset token shadow', 'a { box-shadow: inset 0 0 0 var(--w) var(--c); }'],
  ['token arithmetic', 'a { padding: calc(var(--a) * 2); }'],
  ['negated token', 'a { margin: calc(-1 * var(--space-small)); }'],
  ['token transition', 'a { transition: opacity var(--motion) ease-in-out, transform var(--m); }'],
  ['token border', 'a { border: var(--border-width) solid var(--color-border); }'],
  ['neutral keywords', 'a { font-weight: normal; line-height: normal; z-index: auto; }'],
  ['zero z-index', 'a { z-index: 0; }'],
  ['zero fallback', 'a { padding: env(safe-area-inset-bottom, 0); }'],
  ['token var with token fallback', 'a { padding: var(--a, var(--b)); }'],
  ['transparent and currentColor', 'a { color: currentColor; background: transparent; }'],
  ['color-mix of tokens', 'a { background: color-mix(in srgb, var(--a) 50%, transparent); }'],
  ['ratio variable', 'a { --corner-ratio: 0.25; --x: var(--y); --w: calc(var(--y) * 2); }'],
  ['layout sizes are out of scope', 'a { width: 320px; top: 8px; inset: 0; }'],
  ['escapes inside a value', 'a::before { content: "\\201C"; }'],
];

describe('UI gate: Stylelint rules', () => {
  it.each(rejected)('rejects %s', async (_name, code, rule) => {
    expect(await problems(code)).toContain(rule);
  });

  it.each(accepted)('accepts %s', async (_name, code) => {
    expect(await problems(code)).toEqual([]);
  });

  it('exempts the token stylesheet and the art layer from value rules only', async () => {
    const valueOnly = 'a { color: #000; padding: 13px; --x: 4px; }';
    expect(await problems(valueOnly, 'packages/web/src/theme/tokens.css')).toEqual([]);
    expect(await problems(valueOnly, 'packages/web/src/scene/scene.css')).toEqual([]);
    expect(await problems(valueOnly, 'packages/web/src/theme/nightArt.css')).toEqual([]);
    // Only the boot splash is art; the rest of boot/ is ordinary UI and stays checked.
    expect(await problems(valueOnly, 'packages/web/src/boot/WechatBrowserGuide.css')).toEqual(
      expect.arrayContaining(['color-no-hex', 'ui/strict-value']),
    );
    const escaped = '.a\\:b { color: #000; }';
    expect(await problems(escaped, 'packages/web/src/theme/tokens.css')).toEqual([
      'ui/no-css-escapes',
    ]);
  });
});
