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
    'export const a = <div><span /></div>;',
    'const Card = () => null; export const a = <Card />;',
    'const ui = { Card: () => null }; export const a = <ui.Card />;',
    `${REACT}const C = () => null; createElement(C);`,
    'declare const Tag: "div" | "span"; export const a = <Tag />;',
    `${REACT}declare const p: React.ButtonHTMLAttributes<HTMLButtonElement>; export const a = <button {...p} />;`,
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
      ],
      'element',
    ),
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
      ],
      'style',
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
    'export const a = <div style={{ opacity: 1 }} />;',
    "declare const progress: number; export const a = <div style={{ ['--seat-progress']: progress }} />;",
    `${REACT}declare const k: 'opacity' | 'color'; const s: CSSProperties = { [k]: 'var(--a)' }; void s;`,
    "export const a = <div style={{ borderRadius: 'var(--radius-card)', padding: 0, width: '100%' }} />;",
    'declare const w: number; export const a = <div style={{ width: w }} />;',
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
    `${REACT}declare const fromProps: CSSProperties; export const a = <div style={fromProps} />;`,
    'declare const on: boolean; const card = { opacity: 1 }; export const a = <div style={on ? card : { opacity: 0 }} />;',
    'declare const s: { opacity: number }; export const a = <div style={s} />;',
  ]),
  invalid: [
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
      ],
      'value',
    ),
  ],
});
