/**
 * The TSX rules of the UI gate (plan v3 §2 E4, E5, E11). Cases are of two kinds: drift an ordinary
 * developer or agent writes (must be red), and the structure of the allow lists — an unregistered
 * member, product, element or reflective write is red however it is spelled. Typed cases run
 * against a fixture program so the checker decides what a member, tag or key is.
 */
import path from 'node:path';

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';

import uiLint from './eslint-plugin.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
// The first typed case builds the fixture program, which can take longer than the default 5 s.
const TYPED_CASE_TIMEOUT = 30_000;
RuleTester.it = (name, fn) => it(name, fn, TYPED_CASE_TIMEOUT);
RuleTester.itOnly = it.only;

const FIXTURES = path.join(import.meta.dirname, '__fixtures__');
const filename = path.join(FIXTURES, 'probe.tsx');
const PROBE = 'scripts/ui-lint/__fixtures__/probe.tsx';

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: FIXTURES,
      ecmaFeatures: { jsx: true },
      // With CI=true typescript-eslint infers a single run and builds its program once from the
      // fixture files on disk; RuleTester feeds sources that exist only in memory (P1 QA2 G10).
      disallowAutomaticSingleRunInference: true,
    },
  },
});

const REACT = "import { createElement, type CSSProperties } from 'react';\n";
const red = (entries, messageId, options) =>
  entries.map((code) => ({
    filename,
    code,
    errors: [{ messageId }],
    ...(options ? { options } : {}),
  }));
const green = (entries, options) =>
  entries.map((code) => ({ filename, code, ...(options ? { options } : {}) }));

const writer = (entries) => [{ writers: { [PROBE]: entries } }];

tester.run('ui/dom-allowlist', uiLint.rules['dom-allowlist'], {
  valid: [
    ...green([
      // `super()` into a chain without a declared constructor resolves to nothing to judge (QA7 S3).
      'class Base {} export class Child extends Base { constructor() { super(); } }',
      'class Base { x = 1; } class Mid extends Base {} export class Child extends Mid { constructor() { super(); } }',
      'declare const el: HTMLElement; el.addEventListener("click", () => {}); el.focus();',
      'declare const el: HTMLElement; el.getBoundingClientRect(); el.querySelector("a");',
      'declare const el: HTMLElement; const { style } = el; void style.color;',
      'declare const input: HTMLInputElement; input.value = "x";',
      "const canvas = document.createElement('canvas'); canvas.width = 10;",
      "document.createElement('a').click();",
      'const image = new Image(); image.src = "/a.png";',
      'const audio = new Audio(); void audio.play();',
      'declare const o: { innerHTML: string }; o.innerHTML = "x";',
      'declare const o: { a: number }; Object.assign(o, { a: 1 });',
      'void document.body.innerHTML;',
    ]),
    ...green(
      ["declare const el: SVGElement; el.setAttribute('opacity', '1');"],
      writer(['setAttribute:opacity']),
    ),
    ...green(
      ['declare const el: HTMLElement; el.style.opacity = "1";'],
      writer(['CSSStyleProperties.opacity']),
    ),
    ...green(
      ["document.documentElement.style.setProperty(`--color-${'a'}`, 'x');"],
      writer(['setProperty:--color-*']),
    ),
    ...green(
      [
        "declare const t: string; document.documentElement.style.setProperty(`--color-${t}` as `--color-${string}`, 'x');",
        "document.documentElement.style.setProperty('--color-a', 'x');",
      ],
      writer(['setProperty:--color-*']),
    ),
    ...green(['void document.fonts.ready;']),
    ...green(["document.createElement('script');"], writer(['createElement:script'])),
  ],
  invalid: [
    // Ordinary drift: writing styles and markup from code.
    ...red(
      [
        'declare const el: HTMLElement; el.style.borderRadius = "13px";',
        'declare const el: HTMLElement; const s = el.style; s.borderRadius = "13px";',
        'declare const el: HTMLElement; el.style.cssText = "color:red";',
        'declare const el: HTMLElement; el.innerHTML = "<style></style>";',
        'declare const el: HTMLElement; el.className = "x";',
        'declare const el: HTMLElement; el.classList.add("x");',
        'declare const el: HTMLElement; el.insertAdjacentHTML("beforeend", "<b>");',
        'declare const el: HTMLElement; el.append(document.body);',
        'document.head.appendChild(document.body);',
        'document.write("<style>");',
        'document.execCommand("insertHTML", false, "<style>");',
        'declare const sheet: CSSStyleSheet; sheet.insertRule("a{}");',
        'document.adoptedStyleSheets = [];',
        'declare const el: HTMLElement; el.attributeStyleMap.set("color", "red");',
        'declare const link: HTMLLinkElement; link.cloneNode(true);',
        'declare const link: HTMLLinkElement; link.href = "/x.css";',
        'void Document.parseHTMLUnsafe("<style>");',
        'void Element.prototype;',
      ],
      'member',
    ),
    // The structure: any reference to an unregistered method, however it is reached.
    ...red(
      [
        'declare const el: HTMLElement; const write = el.insertAdjacentHTML; void write;',
        'declare const el: HTMLElement; el.insertAdjacentHTML.call(el, "beforeend", "<b>");',
        'declare const el: HTMLElement; const { insertAdjacentHTML } = el; void insertAdjacentHTML;',
        // Quoted and enumerable computed destructuring keys name the same member.
        "declare const el: HTMLElement; const { 'insertAdjacentHTML': w } = el; void w;",
        "declare const el: HTMLElement; const k = 'insertAdjacentHTML'; const { [k]: w } = el; void w;",
        'declare const el: HTMLElement; el["insertAdjacentHTML"]("beforeend", "<b>");',
        'declare const el: HTMLElement; declare const k: "innerHTML"; el[k] = "x";',
        'declare const el: HTMLElement; el.setHTMLUnsafe("<b>");',
      ],
      'member',
    ),
    ...red(
      ['declare const el: HTMLElement; declare const k: string; const { [k]: w } = el; void w;'],
      'computed',
    ),
    // An unenumerable member call is both: the member is hidden and the call is unresolved.
    {
      filename,
      code: 'declare const el: HTMLElement; declare const k: string; el[k]();',
      errors: [{ messageId: 'unresolved' }, { messageId: 'computed' }],
    },
    // A call the checker cannot resolve is not assumed harmless (fail closed).
    ...red(['declare const f: any; f(document.body);'], 'unresolved'),
    ...red(
      [
        'declare const el: HTMLElement; Object.assign(el.style, { borderRadius: "13px" });',
        'declare const el: HTMLElement; Reflect.set(el, "innerHTML", "<b>");',
        'declare const el: HTMLElement; Object.defineProperty(el, "x", { value: 1 });',
      ],
      'reflection',
    ),
    ...red(
      [
        "document.createElement('style');",
        "document.createElement('link');",
        'declare const tag: string; document.createElement(tag);',
        "document.createElementNS('http://www.w3.org/2000/svg', 'style');",
        'new DOMParser();',
        'new CSSStyleSheet();',
      ],
      'product',
    ),
    ...red(
      ['declare const el: SVGElement; el.setAttribute("style", "x");'],
      'member',
      writer(['setAttribute:opacity']),
    ),
    ...red(
      ['declare const el: SVGElement; declare const n: string; el.setAttribute(n, "x");'],
      'name',
      writer(['setAttribute:opacity']),
    ),
    // A token-family publisher writes only its family (QA5 K9).
    ...red(
      ["document.documentElement.style.setProperty('border-radius', 'x');"],
      'member',
      writer(['setProperty:--color-*']),
    ),
    ...red(
      [
        "declare const t: string; document.documentElement.style.setProperty(t, 'x');",
        "declare const t: string; document.documentElement.style.setProperty(`--report-${t}` as `--report-${string}`, 'x');",
      ],
      'name',
      writer(['setProperty:--color-*']),
    ),
    // Members a managed interface inherits from the ES library are judged on it (QA5 K5).
    ...red(
      [
        'declare const f: FontFace; document.fonts.add(f);',
        'declare const f: FontFace; document.fonts.delete(f);',
        'document.fonts.clear();',
        'const { add } = document.fonts; void add;',
      ],
      'member',
    ),
    ...red(["new FontFace('X', 'url(/x.woff2)');"], 'product'),
    ...red(
      ['declare const el: HTMLElement; el.style.clipPath = "x";'],
      'member',
      writer(['CSSStyleProperties.opacity']),
    ),
  ],
});

tester.run('ui/element-allowlist', uiLint.rules['element-allowlist'], {
  valid: green([
    // `super()` into a chain without a declared constructor resolves to nothing to judge (QA7 S3).
    'class Base {} export class Child extends Base { constructor() { super(); } }',
    'class Base { x = 1; } class Mid extends Base {} export class Child extends Mid { constructor() { super(); } }',
    'export const a = <div><span /></div>;',
    'const Card = () => null; export const a = <Card />;',
    'const ui = { Card: () => null }; export const a = <ui.Card />;',
    `${REACT}const C = () => null; createElement(C);`,
    'declare const Tag: "div" | "span"; export const a = <Tag />;',
    `${REACT}declare const p: { title: string; 'data-x'?: string }; export const a = <div {...p} />;`,
    `${REACT}createElement('div', { title: 'x' });`,
  ]),
  invalid: [
    ...red(
      [
        'export const a = <style>{"a{}"}</style>;',
        'export const a = <link rel="stylesheet" href="/x.css" />;',
        'export const a = <script />;',
        `${REACT}createElement('style');`,
        'declare const Tag: "div" | "style"; export const a = <Tag />;',
        // An iframe hosts another document: only the file `FILE_ELEMENTS` registers (QA11 F5).
        'export const a = <iframe title="x" src="/x" />;',
      ],
      'element',
    ),
    {
      filename,
      code: 'export const a = <iframe srcDoc="<style>a{}</style>" />;',
      errors: [{ messageId: 'element' }, { messageId: 'html' }],
    },
    ...red(
      [
        'declare const Tag: string; export const a = <Tag />;',
        `${REACT}declare const t: string; createElement(t);`,
      ],
      'dynamic',
    ),
    ...red(['declare const make: any; make("style");'], 'unresolved'),
    // Raw HTML and styles reaching a native element past its attributes (QA5 K4).
    ...red(
      [
        'export const a = <div dangerouslySetInnerHTML={undefined} />;',
        `${REACT}const html = { __html: '<style>a{}</style>' }; void html;`,
      ],
      'html',
    ),
    {
      filename,
      code: "export const a = <div {...{ dangerouslySetInnerHTML: { __html: '<style>.x{}</style>' } }} />;",
      errors: [{ messageId: 'html' }, { messageId: 'html' }],
    },
    {
      filename,
      code: `${REACT}createElement('div', { dangerouslySetInnerHTML: { __html: '<style>.x{}</style>' } });`,
      errors: [{ messageId: 'html' }, { messageId: 'html' }],
    },
    ...red(
      [
        'const props = { style: { borderRadius: 3 } }; export const a = <div {...props} />;',
        `${REACT}createElement('div', { style: { borderRadius: 3 } });`,
        // A pass-through props type may carry a style value or an unregistered attribute (QA14 F6).
        `${REACT}declare const p: React.ButtonHTMLAttributes<HTMLButtonElement>; export const a = <button {...p} />;`,
        "declare const c: boolean; const p = c ? { style: { padding: '13px' } } : {}; export const a = <div {...p} />;",
        "const q = { fill: '#f00' }; export const a = <svg><rect {...q} /></svg>;",
        "const r = { width: 130, alt: '' }; export const a = <img {...r} />;",
        `${REACT}createElement('rect', { fill: '#f00' });`,
      ],
      'spread',
    ),
    // Native attributes are registered per element (QA14 F5, N2).
    ...red(
      [
        'export const a = <table border={3} />;',
        'export const a = <table bgcolor="#f00" />;',
        'export const a = <table width={130} />;',
        'export const a = <table cellPadding={13} />;',
        'export const a = <td height={13} />;',
        'export const a = <div width={13} />;',
        'export const a = <input src="/x" />;',
      ],
      'attribute',
    ),
    ...red(
      [
        'declare const keys: string[]; export const a = <div {...Object.fromEntries(keys.map((k) => [k, 1]))} />;',
        'declare const p: any; export const a = <div {...p} />;',
        `${REACT}declare const p: Record<string, unknown>; createElement('div', p);`,
      ],
      'opaque',
    ),
  ],
});

tester.run('ui/inline-style-keys', uiLint.rules['inline-style-keys'], {
  valid: green([
    "declare const el: HTMLElement; el.style.width = 'var(--size-card)'; el.style.opacity = '1';",
    "declare const el: HTMLElement; el.style.setProperty('--seat-progress', '0');",
    "declare const el: HTMLElement; el.animate([{ opacity: 0, offset: 0, easing: 'ease-out' }, { opacity: 1 }], 0);",
    "declare const el: SVGElement; el.setAttribute('cx', '13'); el.setAttribute('fill', 'var(--a)');",
    'export const a = <div style={{ opacity: 1 }} />;',
    "declare const progress: number; export const a = <div style={{ ['--seat-progress']: progress }} />;",
    `${REACT}declare const k: 'opacity' | 'color'; const s: CSSProperties = { [k]: 'var(--a)' }; void s;`,
    "export const a = <div style={{ borderRadius: 'var(--radius-card)', padding: 0, width: '100%' }} />;",
    'export const a = <svg><rect rx={0} fill="currentColor" stroke="url(#g)" opacity={1} /></svg>;',
    `${REACT}declare const vars: { [key: \`--\${string}\`]: string }; export const a = <div style={vars} />;`,
    'const Box = (_: { style: Record<string, string> }) => null; declare const r: Record<string, string>; export const a = <Box style={r} />;',
    "const card = { borderRadius: 'var(--radius-card)', padding: 0 }; export const a = <div style={card} />;",
    "const SIZE = 'var(--size-icon)'; export const a = <div style={{ width: `${SIZE}` }} />;",
    'export const a = <svg width="100%" height="100%" />;',
    // Type tracking stays on what reaches a native `style` (no false positives, QA6 L4).
    "import { goodCard } from './styles'; export const a = <div style={goodCard} />;",
    "import { tokenShorthandCard } from './styles'; export const a = <div style={tokenShorthandCard} />;",
    "import { notAStyle } from './styles'; const Box = (_: { data: object }) => null; export const a = <Box data={notAStyle} />;",
    'const card = { padding: 12 }; const Box = (_: { style: object }) => null; export const a = <Box style={card} />;',
    'declare const on: boolean; const card = { opacity: 1 }; export const a = <div style={on ? card : { opacity: 0 }} />;',
    "const sizes = { card: 'var(--space-3)' }; export const a = <div style={{ padding: sizes.card }} />;",
    // A typed style literal in another file is judged where it is written, not again here (N3).
    "import { typedCard } from './styles'; export const a = <div style={typedCard} />;",
    // Every element of a list of tokens, through a callback (QA9 FIX-FIRST-1 control).
    "const C = [{ c: 'var(--a)' }, { c: 'var(--b)' }]; export const a = C.map((x) => <div style={{ color: x.c }} />);",
    'const [o] = [1]; export const a = <div style={{ opacity: o }} />;',
    // `n && v` writes `v` or nothing: the left side is never a style value (QA8 should-fix 4).
    "const n = 3; export const a = <div style={{ padding: n && 'var(--space-2)' }} />;",
    // Tables of tokens, and a table whose key is runtime but whose entries are all tokens.
    "const C = { a: 'var(--a)', b: 'var(--b)' }; declare const k: string; export const a = <div style={{ color: (C as Record<string, string>)[k] }} />;",
    "import { useState } from 'react'; export function A() { const [w, setW] = useState(0); setW((v) => v + 1); return <div style={{ opacity: w ? 1 : 0 }} />; }", // D15 ②: a runtime value fits only a custom property (read by a checked stylesheet's
    // `var()`) or a property whose unitless numbers are free.
    'declare const w: number; export const a = <div style={{ ["--seat-width"]: `${w}px` }} />;',
    "declare const el: HTMLElement; declare const w: number; el.style.setProperty('--seat-width', `${w}px`);",
    'declare const n: number; export const a = <div style={{ gridRow: n, flexGrow: n }} />;',
    'declare const n: number | undefined; declare const on: boolean; export const a = <div style={{ flexGrow: on && n }} />;',
    // P1 QA13: an element callback reads every element of the literal list it walks.
    "const C = [{ c: 'var(--a)' }]; export const a = C.map(({ c }) => <div style={{ color: c }} />);",
  ]),
  // DOM style writes (QA11 F2): what the registered entry points write takes the same check.
  // (The values below are probes, not registrations: which writes a file may make is E5's.)
  invalid: [
    ...red(
      [
        "declare const el: HTMLElement; el.style.width = '137px';",
        "declare const el: HTMLElement; el.style.setProperty('padding', '13px');",
        "declare const el: SVGElement; el.setAttribute('fill', '#f00');",
        "declare const el: HTMLElement; el.animate([{ color: '#f00' }, { opacity: 1 }], 0);",
        "declare const el: HTMLElement; el.animate({ color: ['#f00', 'var(--a)'] }, 0);",
      ],
      'value',
    ),
    ...red(
      [
        'declare const el: HTMLElement; declare const k: Keyframe[]; el.animate(k, 0);',
        'declare const el: HTMLElement; declare const k: Keyframe; el.animate([k], 0);',
      ],
      'keyframes',
    ),
    ...red(
      ["declare const el: HTMLElement; declare const n: string; el.style.setProperty(n, 'x');"],
      'name',
    ),
    ...red(
      [
        "export const a = <div style={{ ['--avatar-corner-' + 'ratio']: 1 }} />;",
        `${REACT}declare const k: string; const s: CSSProperties = { [k]: 1 }; void s;`,
      ],
      'computed',
    ),
    ...red(
      [
        'declare const r: Record<string, string>; export const a = <div style={r} />;',
        "export const a = <div style={Object.fromEntries([['borderRadius', '50%']])} />;",
        'declare const r: Record<`border${string}`, string>; export const a = <div style={{ ...r }} />;',
      ],
      'indexed',
    ),
    // Literal values pass the stylesheet value checker (QA5 K6).
    ...red(
      [
        'export const a = <div style={{ borderRadius: 7 }} />;',
        "export const a = <div style={{ color: '#f00' }} />;",
        'export const a = <div style={{ padding: 12 }} />;',
        'declare const on: boolean; export const a = <div style={{ width: on ? 44 : 0 }} />;',
        `${REACT}const s: CSSProperties = { zIndex: 999 }; void s;`,
        "export const a = <div style={{ ['--local-weight']: 700 }} />;",
        'export const a = <svg><rect rx={7} /></svg>;',
        'export const a = <svg><rect fill="#f00" /></svg>;',
        'export const a = <svg><rect strokeWidth={3} /></svg>;',
        "export const a = <div style={{ mysteryProperty: 'x' }} />;",
        // A style object reached through a name, a member, a memo or a branch (QA6 L4).
        'const card = { borderRadius: 7 }; export const a = <div style={card} />;',
        'const styles = { card: { padding: 12 } }; export const a = <div style={styles.card} />;',
        "import { useMemo } from 'react'; export function A() { const s = useMemo(() => ({ padding: 12 }), []); return <div style={s} />; }",
        "declare const on: boolean; const card = { color: '#f00' }; export const a = <div style={on ? card : undefined} />;",
        // Templates of literal parts, and the box size of an svg (QA6 L5, L6).
        'const SIZE = 16; export const a = <div style={{ width: `${SIZE}px` }} />;',
        'export const a = <svg width={16} />;',
        'export const a = <img height="16" />;',
        // Another file's literal and shorthand values; mapped and declared keys are judged too.
        "import { badCard } from './styles'; export const a = <div style={badCard} />;",
        "import { shorthandCard } from './styles'; export const a = <div style={shorthandCard} />;",
        "declare const s: Record<'mysteryProperty', string>; export const a = <div style={s} />;",
        'declare const s: { borderRadius: 7 }; export const a = <div style={s} />;',
        // Written literals TypeScript widens are read from their initializers (QA7 F4).
        'const sizes = { card: 12 }; export const a = <div style={{ padding: sizes.card }} />;',
        "import { widened } from './styles'; export const a = <div style={{ width: widened.size }} />;",
        // One literal reading in this file and in another (QA7 F5).
        "import { templateCard } from './styles'; export const a = <div style={templateCard} />;",
        // Tables read by member or element, annotated or not (QA8 FIX-FIRST-3).
        "const C: Record<'a' | 'b', string> = { a: '#f00', b: 'var(--a)' }; declare const k: 'a' | 'b'; export const a = <div style={{ color: C[k] }} />;",
        "const C: Record<'a', string> = { a: '#f00' }; export const a = <div style={{ color: C.a }} />;",
        "const C: { a: string } = { a: '#f00' }; export const a = <div style={{ color: C.a }} />;",
        "const C = { a: '#f00', b: 'var(--a)' }; declare const k: string; export const a = <div style={{ color: (C as Record<string, string>)[k] }} />;",
        "const C = ['#f00', 'var(--a)']; declare const i: number; export const a = <div style={{ color: C[i] }} />;",
        "const C: Record<'a', string> = { a: '#f00' }; export const a = <svg><rect fill={C.a} /></svg>;",
        "const RED = { primary: '#f00' }; const THEMES: Record<'x', { primary: string }> = { x: RED }; declare const k: 'x'; export const a = <div style={{ color: THEMES[k].primary }} />;",
        'const card: { padding: number } = { padding: 12 }; export const a = <div style={card} />;',
        // Every element of a list read through a callback, a returned list, a later entry after a
        // token, array destructuring, a namespace import, a frozen table, an enum (QA9).
        "const C = [{ c: 'var(--a)' }, { c: '#f00' }]; export const a = C.map((x) => <div style={{ color: x.c }} />);",
        "function list() { return [{ c: 'var(--a)' }, { c: '#f00' }]; } export const a = list().map((x) => <div style={{ color: x.c }} />);",
        "const [, h] = ['var(--a)', 240]; export const a = <div style={{ height: h }} />;",
        "const C = Object.freeze({ a: '#f00' }); export const a = <div style={{ color: C.a }} />;",
        'enum Gap { Wide = 12 } export const a = <div style={{ gap: Gap.Wide }} />;',
        // Function returns, memo factories, immediately invoked functions, class fields, member
        // writes after the literal (QA10 S1).
        'function pad() { return 21; } export const a = <div style={{ padding: pad() }} />;',
        "import { useMemo } from 'react'; export function A() { const p = useMemo(() => 19, []); return <div style={{ padding: p }} />; }",
        'export const a = <div style={{ padding: (() => 21)() }} />;',
        // A literal branch of a template beside a runtime one is still read (a runtime custom
        // property value fits, its literal branch does not).
        'const HIGH = 300; export const A = (on: boolean, i: number) => <div style={{ ["--d"]: `${on ? HIGH : i * 2}ms` }} />;',
      ],
      'value',
    ),
    // D15 ②: a value the gate cannot read is reported unless its kind fits (no runtime value is
    // left to the screenshots): a parameter, a computed number, runtime text, a library call.
    ...red(
      [
        'declare const el: HTMLElement; declare const w: number; el.style.width = `${w}px`;',
        'declare const w: number; export const a = <div style={{ width: w }} />;',
        'declare const s: { opacity: number }; export const a = <div style={s} />;',
        'export const A = ({ size }: { size: number }) => <div style={{ width: size }} />;',
        "import { useState } from 'react'; export function A() { const [w] = useState(() => window.innerWidth); return <div style={{ width: w }} />; }",
        'function pad(n: number) { return n; } export const a = (n: number) => <div style={{ opacity: pad(n) }} />;',
        'const SPACE = 4; export const a = <div style={{ padding: SPACE * 2 }} />;',
        'const GAP = 4; export const a = <div style={{ gap: Math.max(GAP, 0) }} />;',
        'declare const c: string; export const a = <div style={{ color: c }} />;',
        'declare const c: string; export const a = <svg><rect fill={c} /></svg>;',
        'declare const x: number; export const a = <div style={{ transform: `translateX(${x}px)` }} />;',
        "declare const el: HTMLElement; declare const c: string; el.style.setProperty('color', c);",
        'declare const el: HTMLElement; declare const o: number; el.animate([{ opacity: o }], 0);',
        'declare const open: number | undefined; export const a = <div style={{ width: open ?? 0 }} />;',
      ],
      'untracked',
    ),
    // P1 QA13 F2: a member read where the receiver is a parameter, a branch with no literal, or
    // a callback element of a parameter holds what its callers pass, not only the literal of
    // its type.
    ...red(
      [
        "const D = { width: 'var(--a)' }; export function Box({ cfg }: { cfg: typeof D }) { return <div style={{ width: cfg.width }} />; }",
        "const T = { w: 'var(--a)' }; export function A(o: typeof T) { return <div style={{ width: o.w }} />; }",
        "const T = { w: 'var(--a)' }; export function A(list: (typeof T)[]) { return list.map((x) => <div style={{ width: x.w }} />); }",
        "declare const p: { width: number }; declare const on: boolean; const S = on ? { width: 'var(--a)' } : p; export const a = <div style={{ width: S.width }} />;",
        "declare const p: { width: number }; const S = p.width ? { width: 'var(--a)' } : p; export const a = <div style={{ width: S.width }} />;",
      ],
      'untracked',
    ),
    // P1 QA13: a style object the gate cannot follow (a library `CSSProperties`, a prop passed
    // down) is one runtime object: rejected, never passed as checked elsewhere (U9 is debt).
    ...red(
      [
        `${REACT}declare const fromProps: CSSProperties; export const a = <div style={fromProps} />;`,
        `${REACT}export const A = ({ style }: { style: CSSProperties }) => <div style={{ ...style, color: 'var(--a)' }} />;`,
      ],
      'untracked',
    ),
    // `animate` timing takes the motion domain: a written duration is not a token.
    ...red(
      [
        'declare const el: HTMLElement; el.animate([{ opacity: 0 }], 200);',
        'declare const el: HTMLElement; el.animate([{ opacity: 0 }], { duration: 300 });',
        "declare const el: HTMLElement; el.animate([{ opacity: 0 }], { pseudoElement: '::after' });",
      ],
      'value',
    ),
    // P1 QA13 F1: a write into a `CSSProperties` value is checked where it is written, whether
    // the object is annotated or flows in without a contextual type.
    ...red(
      [
        `${REACT}const o = { width: 13 }; const s: CSSProperties = o; export const a = <div style={s} />;`,
        `${REACT}function mk(): CSSProperties { const o = { width: 13 }; return o; } export const a = <div style={mk()} />;`,
        `${REACT}import { useMemo } from 'react'; export function A() { const s = useMemo((): CSSProperties => { const o = { width: 13 }; return o; }, []); return <div style={s} />; }`,
        `${REACT}declare function Avatar(p: { style: CSSProperties }): null; export const a = <Avatar style={{ width: 13 }} />;`,
      ],
      'value',
    ),
    // A binding some use can change is read from its type, never as the literal it started as
    // (QA14 F1–F3): a member write, a mutating call, an escape, any write but `=`.
    ...red(
      [
        'let gap = 12; gap += 0; export const a = <div style={{ gap }} />;',
        "const S = { box: { padding: 'var(--a)' } }; S.box.padding = '23px'; export const a = <div style={{ padding: S.box.padding }} />;",
        "const S = { box: { padding: 'var(--a)' } }; S.box.padding = '23px'; export const a = <div style={S.box} />;",
        "const S = { box: { padding: 'var(--a)' } }; S.box.padding = '23px'; export const a = <div style={{ ...S.box }} />;",
        "const s: { padding?: string } = { padding: 'var(--a)' }; s.padding = '13px'; export const a = <div style={s} />;",
        "const s = { padding: 'var(--a)' }; Object.assign(s, { padding: '13px' }); export const a = <div style={s} />;",
        "const s = { padding: 'var(--a)' }; Reflect.set(s, 'padding', '13px'); export const a = <div style={s} />;",
        "const pads = ['var(--a)']; pads[0] = '13px'; export const a = <div style={{ padding: pads[0] }} />;",
        "const pads = ['var(--a)', '13px'].reverse(); export const a = <div style={{ padding: pads[0] }} />;",
        "const L = ['var(--a)']; L.push('13px'); export const a = L.map((p) => <div style={{ padding: p }} />);",
        "const o = { p: 'var(--a)' }; function m(x: { p: string }) { x.p = '13px'; } m(o); export const a = <div style={{ padding: o.p }} />;",
        "const o = { p: 'var(--a)' }; const alias = o; alias.p = '13px'; export const a = <div style={{ padding: o.p }} />;",
        "let pad = () => 'var(--a)'; pad = () => String(13); export const a = <div style={{ padding: pad() }} />;",
        "let p = 'var(--a)'; [p] = ['13px']; export const a = <div style={{ padding: p }} />;",
        "let p = 'var(--a)'; p += ' 13px'; export const a = <div style={{ padding: p }} />;",
        "const o = { p: 'var(--a)' }; export function get() { return o; } get().p = '13px'; export const a = <div style={{ padding: o.p }} />;",
        `${REACT}declare function Avatar(p: { style: CSSProperties }): null; const o = { width: 13 }; export const a = <Avatar style={o} />;`,
        // A branch the gate cannot read is read from its type, whatever literal stands beside it (QA14 F2).
        "const base = { padding: 'var(--a)' }; function F({ s = base }: { s?: typeof base }) { return <div style={s} />; } export const a = <F s={{ padding: 'var(--b)' }} />;",
        "const base = { padding: 'var(--a)' }; export const F = (c: boolean, p: typeof base) => <div style={c ? base : p} />;",
        "const base = { padding: 'var(--a)' }; export const F = (p?: typeof base) => <div style={p ?? base} />;",
      ],
      'untracked',
    ),
    // A DOM value writer is judged however it is spelled, and reported when handed on (QA14 F4).
    ...red(
      [
        "declare const el: HTMLElement; el['animate']([{ padding: '13px' }]);",
        "declare const el: Element; el['setAttribute']('fill', '#f00');",
        "declare const el: HTMLElement; el.style['setProperty']('padding', '13px');",
        "declare const el: Element; el.setAttributeNS(null, 'fill', '#f00');",
        "declare const el: HTMLElement; Object.assign(el.style, { padding: '13px' });",
      ],
      'value',
    ),
    ...red(
      [
        "declare const el: HTMLElement; el.animate.call(el, [{ padding: '13px' }], 100);",
        'declare const el: HTMLElement; export const anim = el.animate.bind(el);',
        'declare const el: Element; export const set = el.setAttribute;',
        'declare const el: HTMLElement; export const { animate } = el;',
      ],
      'indirect',
    ),
    ...red(
      [
        `${REACT}declare const n: number; const o = { width: n }; const s: CSSProperties = o; export const a = <div style={s} />;`,
      ],
      'untracked',
    ),
    // v3.11 (P1 QA14): only a provable binding is read from what is written to it. A `let`, a
    // `useState` value, a field that is not `readonly`, and an object any use writes to (even a
    // style object written where it is checked) hold what their type allows.
    ...red(
      [
        "import { useState } from 'react'; export function A() { const [w] = useState(16); return <div style={{ width: w }} />; }",
        'class S { static PAD = 21; } export const a = <div style={{ padding: S.PAD }} />;',
        'let gap = 0; gap = 12; export const a = <div style={{ gap }} />;',
        "import { useState } from 'react'; export function A() { const [w, setW] = useState(0); setW(16); return <div style={{ width: w }} />; }",
        "import { useState } from 'react'; export function A() { const [w] = useState(() => 16); return <div style={{ width: w }} />; }",
        `${REACT}const style: CSSProperties = { color: 'var(--a)' }; style.width = 'var(--w)'; export const a = <span style={style} />;`,
      ],
      'untracked',
    ),
    // The write is judged where it is written, and the object it changes is not read as its
    // initializer where it is used.
    {
      filename,
      code: `${REACT}const style: CSSProperties = { color: 'var(--a)' }; style.width = '13px'; export const a = <span style={style} />;`,
      errors: [{ messageId: 'value' }, { messageId: 'untracked' }],
    },
    {
      filename,
      code: `${REACT}declare const s: string; const style: CSSProperties = { color: 'var(--a)' }; style.textShadow = s; export const a = <span style={style} />;`,
      errors: [{ messageId: 'untracked' }, { messageId: 'untracked' }],
    },
    {
      filename,
      code: `${REACT}const style: CSSProperties = {}; Object.assign(style, { width: 13 }); export const a = <div style={style} />;`,
      errors: [{ messageId: 'untracked' }, { messageId: 'value' }, { messageId: 'untracked' }],
    },
    // A literal beside a runtime value: both are reported, neither hides the other.
    ...[
      'export const A = ({ size = 8 }: { size?: number }) => <div style={{ width: size }} />;',
      'export function A(size = 8) { return <div style={{ width: size }} />; }',
    ].map((code) => ({
      filename,
      code,
      errors: [{ messageId: 'value' }, { messageId: 'untracked' }],
    })),
    // Reports come in source order: the runtime operand is written first.
    ...[
      "import { fallbackCard } from './styles'; export const a = <div style={fallbackCard} />;",
      'declare const open: number | undefined; export const a = <div style={{ width: open || 12 }} />;',
    ].map((code) => ({
      filename,
      code,
      errors: [{ messageId: 'untracked' }, { messageId: 'value' }],
    })),
  ],
});
