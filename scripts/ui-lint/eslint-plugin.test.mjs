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
RuleTester.it = it;
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
      writer(['setProperty:*']),
    ),
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
        'declare const el: HTMLElement; el["insertAdjacentHTML"]("beforeend", "<b>");',
        'declare const el: HTMLElement; declare const k: "innerHTML"; el[k] = "x";',
        'declare const el: HTMLElement; el.setHTMLUnsafe("<b>");',
      ],
      'member',
    ),
    ...red(['declare const el: HTMLElement; declare const k: string; el[k]();'], 'computed'),
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
  ],
});

tester.run('ui/inline-style-keys', uiLint.rules['inline-style-keys'], {
  valid: green([
    'export const a = <div style={{ opacity: 1 }} />;',
    "export const a = <div style={{ ['--seat-progress']: 1 }} />;",
    `${REACT}declare const k: 'opacity' | 'color'; const s: CSSProperties = { [k]: 1 }; void s;`,
    `${REACT}declare const vars: { [key: \`--\${string}\`]: string }; export const a = <div style={vars} />;`,
    'const Box = (_: { style: Record<string, string> }) => null; declare const r: Record<string, string>; export const a = <Box style={r} />;',
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
  ],
});
