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

const PROBE = 'packages/web/src/features/probe/Probe.css';

async function warnings(code, file = PROBE) {
  const { results } = await stylelint.lint({
    code,
    codeFilename: path.join(REPO_ROOT, file),
    configFile: CONFIG_FILE,
    cwd: REPO_ROOT,
  });
  return results.flatMap((result) => result.warnings);
}

async function problems(code, file = PROBE) {
  return (await warnings(code, file)).map((warning) => warning.rule);
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
  // P1 QA2: spellings that got past the second version.
  ['G7 font weight in calc', 'a { font: calc(700) var(--fs) sans-serif; }', 'ui/strict-value'],
  [
    'G7 font line height in calc',
    'a { font: var(--fw) var(--fs) / calc(1.5) sans-serif; }',
    'ui/strict-value',
  ],
  ['G7 local thick', 'a { --bw: thick; }', 'ui/no-local-literal-custom-property'],
  ['G7 local thin', 'a { --bw: thin; }', 'ui/no-local-literal-custom-property'],
  [
    'G7 @property initial value',
    "@property --r { syntax: '<length>'; inherits: false; initial-value: 13px; }",
    'ui/no-local-literal-custom-property',
  ],
  ['G8 grid-gap', 'a { grid-gap: 13px; }', 'ui/strict-value'],
  ['G8 grid-row-gap', 'a { grid-row-gap: 13px; }', 'ui/strict-value'],
  ['G8 grid-column-gap', 'a { grid-column-gap: 13px; }', 'ui/strict-value'],
  ['G8 system color', 'a { color: Canvas; }', 'ui/no-system-color'],
  ['G8 system color in a shorthand', 'a { background: ButtonText; }', 'ui/no-system-color'],
  ['G8 local system color', 'a { --c: canvastext; }', 'ui/no-system-color'],
  [
    'G8 system color under a widened forced-colors query',
    '@media (forced-colors: active), all { a { color: Canvas; } }',
    'ui/no-system-color',
  ],
  ['G8 system font', 'a { font: caption; }', 'ui/strict-value'],
  ['G8 local system font', 'a { --f: menu; }', 'ui/no-local-literal-custom-property'],
  ['G8 variation weight', "a { font-variation-settings: 'wght' 650; }", 'ui/strict-value'],
  [
    'G9 token times a factor',
    'a { border-radius: calc(var(--radius-small) * 1.625); }',
    'ui/strict-value',
  ],
  ['G9 token halved', 'a { padding: calc(var(--space-2) / 2); }', 'ui/strict-value'],
  [
    'G9 time factor',
    'a { animation-duration: calc(var(--duration-fast) * 30); }',
    'ui/strict-value',
  ],
  // P1 QA3: spellings that got past the third version.
  ['H9 rounded inset clip', 'a { clip-path: inset(0 round 13px); }', 'ui/strict-value'],
  [
    'H9 rounded rect shape',
    'a { shape-outside: rect(0 1px 2px 3px round 4px); }',
    'ui/strict-value',
  ],
  ['H9 attr() value', 'a { border-radius: attr(data-r type(<length>)); }', 'ui/strict-value'],
  [
    'H9 attr() in a local variable',
    'a { --r: attr(data-r px); }',
    'ui/no-local-literal-custom-property',
  ],
  ['H1 package stylesheet', "@import 'normalize.css';", 'ui/import-scope'],
  ['H1 url() import', "@import url('./a.css');", 'ui/import-scope'],
  ['H1 data: import', "@import 'data:text/css,a{color:red}';", 'ui/import-scope'],
  ['H1 remote import', "@import 'https://example.test/a.css';", 'ui/import-scope'],
  ['H1 missing import', "@import './missing.css';", 'ui/import-scope'],
  [
    'H1 import outside the web source',
    "@import '../../../../game-engine/x.css';",
    'ui/import-scope',
  ],
  ['H1 non-css import', "@import '../../theme/x.scss';", 'ui/import-scope'],
];

const accepted = [
  ['token z-index', 'a { z-index: var(--z-overlay); }'],
  // The CSS gate lints the whole web package, the local preview page included.
  ['import of a checked sheet outside src', "@import '../../../preview/preview.css';"],
  ['font shorthand reset', 'a { font: inherit; }'],
  [
    'font shorthand token',
    'a { font: var(--font-weight-bold) var(--font-size-md) / var(--line-height-body) system-ui; }',
  ],
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
  ['token sum', 'a { padding: calc(var(--a) + var(--b)); }'],
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
  [
    'system colors in forced-colors mode',
    '@media (forced-colors: active) { a { color: HighlightText; --ink: ButtonText; } }',
  ],
  ['color-ish names outside color properties', 'a { grid-area: menu; animation-name: mark; }'],
  ['token variation settings', 'a { font-variation-settings: var(--font-variation); }'],
  ['iteration count is structure', 'a { animation: k var(--motion-slow) 2 alternate; }'],
  ['clip-path geometry is layout', 'a { clip-path: inset(0 12px round var(--radius-md)); }'],
  ['polygon clip-path is layout', 'a { clip-path: polygon(0 0, 100% 0, 50% 12px); }'],
  ['import inside the web source', "@import '../../theme/tokens.css';"],
];

describe('UI gate: Stylelint rules', () => {
  it.each(rejected)('rejects %s', async (_name, code, rule) => {
    expect(await problems(code)).toContain(rule);
  });

  it.each(accepted)('accepts %s', async (_name, code) => {
    expect(await problems(code)).toEqual([]);
  });

  it('holds the token stylesheet to custom property definitions (P1 QA3 H2)', async () => {
    const tokens = 'packages/web/src/theme/tokens.css';
    expect(await problems(':root { --x: 4px; --c: #000; --f: 700; }', tokens)).toEqual([]);
    expect(await problems(':root { padding: 13px; }', tokens)).toEqual([
      'ui/token-stylesheet-shape',
    ]);
    expect(await problems('.avatar { border-radius: 50%; }', tokens)).toEqual([
      'ui/token-stylesheet-shape',
    ]);
    expect(await problems('.a\\:b { --x: #000; }', tokens)).toEqual(['ui/no-css-escapes']);
  });

  it('exempts each art stylesheet from value rules for its own classes only (P1 QA3 H3)', async () => {
    const art = (selector) => `${selector} { color: #000; padding: 13px; --x: 4px; }`;
    expect(await problems(art('.scene-canvas'), 'packages/web/src/scene/scene.css')).toEqual([]);
    expect(await problems(art('.night-art-moon'), 'packages/web/src/theme/nightArt.css')).toEqual(
      [],
    );
    expect(
      await problems(art(':root .boot-splash > img'), 'packages/web/src/boot/bootSplash.css'),
    ).toEqual([]);
    expect(await problems(art('.avatar'), 'packages/web/src/scene/scene.css')).toEqual([
      'ui/art-layer-scope',
    ]);
    // A class that only starts with the prefix is another class.
    expect(
      await problems(art('.scene-canvasx, .scene-canvas'), 'packages/web/src/scene/scene.css'),
    ).toEqual(['ui/art-layer-scope']);
    expect(await problems(art('.bootstrap'), 'packages/web/src/boot/bootSplash.css')).toEqual([
      'ui/art-layer-scope',
    ]);
    // A class inside :not() does not scope the rule.
    expect(
      await problems(art('div:not(.night-art)'), 'packages/web/src/theme/nightArt.css'),
    ).toEqual(['ui/art-layer-scope']);
    // Nested rules inherit their parent's scope.
    expect(
      await problems(
        '.name-style { &[data-animated] { padding: 13px; } }',
        'packages/web/src/components/nameStyles/nameStyles.css',
      ),
    ).toEqual([]);
    // An art area is not exempt as a whole: a stylesheet that is not registered is ordinary UI.
    expect(await problems(art('.scene-canvas'), 'packages/web/src/scene/qaButton.css')).toEqual(
      expect.arrayContaining(['color-no-hex', 'ui/strict-value']),
    );
    expect(await problems(art('.boot-x'), 'packages/web/src/boot/WechatBrowserGuide.css')).toEqual(
      expect.arrayContaining(['color-no-hex', 'ui/strict-value']),
    );
  });

  it('reports each literal at its own position (P1 QA3 H5)', async () => {
    const code = 'a {\n  transition:\n    opacity 100ms,\n    transform 200ms;\n}\n';
    const found = (await warnings(code)).filter((warning) => warning.rule === 'ui/strict-value');
    expect(
      found.map((warning) => [warning.line, warning.column, warning.endLine, warning.endColumn]),
    ).toEqual([
      [3, 13, 3, 18],
      [4, 15, 4, 20],
    ]);
    // A comment before the value does not shift the position.
    const commented = 'a { padding: /* x */ 13px; }';
    const [one] = (await warnings(commented)).filter(
      (warning) => warning.rule === 'ui/strict-value',
    );
    expect([one.line, one.column]).toEqual([1, 22]);
  });
});
