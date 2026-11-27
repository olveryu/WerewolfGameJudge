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
        // SVG's live attribute values are attribute writes (P1 QA17 F2).
        'declare const r: SVGRectElement; r.rx.baseVal.value = 8;',
        'declare const svg: SVGSVGElement; svg.width.baseVal.value = 300;',
        'declare const svg: SVGSVGElement; svg.viewBox.baseVal.width = 300;',
      ],
      'member',
    ),
    // A live SVG list hands out live items: the list's method and the item's write (P1 QA17 F2).
    ...[
      'declare const g: SVGGElement; g.transform.baseVal.getItem(0).setTranslate(37, 0);',
      'declare const p: SVGPolygonElement; p.points.getItem(0).x = 3;',
    ].map((code) => ({
      filename,
      code,
      errors: [{ messageId: 'member' }, { messageId: 'member' }],
    })),
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
    // A component's props are its own; the native element it renders is judged where it is.
    'const Card = (_: { title: string }) => null; declare const p: { title: string }; export const a = <Card {...p} />;',
    `${REACT}createElement('div', { title: 'x' });`,
    `${REACT}createElement('div', null);`,
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
      errors: [{ messageId: 'spread' }, { messageId: 'html' }, { messageId: 'html' }],
    },
    {
      filename,
      code: `${REACT}createElement('div', { dangerouslySetInnerHTML: { __html: '<style>.x{}</style>' } });`,
      errors: [{ messageId: 'html' }, { messageId: 'html' }],
    },
    // v3.12 (P1 QA15 F2): a spread into a native element is reported whatever its type lists,
    // since a type names the keys a value has at least, never at most.
    ...red(
      [
        'const props = { style: { borderRadius: 3 } }; export const a = <div {...props} />;',
        'declare const p: { title: string }; export const a = <div {...p} />;',
        'function W(p: { title: string }) { return <div {...p} />; } export const a = <W title="x" />;',
        `${REACT}declare const p: React.ButtonHTMLAttributes<HTMLButtonElement>; export const a = <button {...p} />;`,
        "const q = { fill: '#f00' }; export const a = <svg><rect {...q} /></svg>;",
        'declare const p: any; export const a = <div {...p} />;',
      ],
      'spread',
    ),
    // createElement and cloneElement props: an object literal written here, key by key.
    ...red(
      [
        `${REACT}createElement('div', { style: { borderRadius: 3 } });`,
        `${REACT}createElement('rect', { fill: '#f00' });`,
      ],
      'props',
    ),
    ...red(
      [
        `${REACT}declare const p: { title: string }; createElement('div', p);`,
        `${REACT}declare const p: { title: string }; createElement('div', { ...p });`,
        `${REACT}import { cloneElement, type ReactElement } from 'react'; declare const e: ReactElement; declare const p: { title: string }; cloneElement(e, p);`,
      ],
      'opaque',
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
        // A tag held in a variable is the same native element (P1 QA16 F3).
        'const Tag = \'td\' as const; export const a = <Tag bgcolor="#f00" />;',
      ],
      'attribute',
    ),
    ...red(
      [
        "const Tag = 'div' as const; declare const p: { title: string }; export const a = <Tag {...p} />;",
      ],
      'spread',
    ),
  ],
});

// v3.12 (plan D15 ②): a value passes only by what its write site shows by syntax — a literal the
// value checker allows, a member of a registered token constant, a registered runtime source
// into a custom property. Every other expression is `untracked` however it was assigned.
tester.run('ui/inline-style-keys', uiLint.rules['inline-style-keys'], {
  valid: green([
    "declare const el: HTMLElement; el.style.width = 'var(--size-card)'; el.style.opacity = '1';",
    "declare const el: HTMLElement; el.style.setProperty('--seat-progress', '0');",
    "declare const el: HTMLElement; el.animate([{ opacity: 0, offset: 0, easing: 'ease-out' }, { opacity: 1 }], 0);",
    "declare const el: SVGElement; el.setAttribute('cx', '13'); el.setAttribute('fill', 'var(--a)');",
    'export const a = <div style={{ opacity: 1 }} />;',
    "export const a = <div style={{ borderRadius: 'var(--radius-card)', padding: 0, width: '100%' }} />;",
    'export const a = <div style={{ width: `var(--size-icon)` }} />;',
    "export const a = <div style={{ ['--seat-progress']: '0' }} />;",
    `${REACT}export const a = <div style={{ opacity: 1 } as CSSProperties} />;`,
    // Registered keys, options and arguments of a package (P1 QA18 F1).
    "import { Toaster, toast } from 'sonner'; export const a = <Toaster position=\"top-center\" />; toast('x', { duration: 3, description: 'y' });",
    // A package's function kept untyped, or handed where only primitives can be passed to it.
    "import { toast } from 'sonner'; const t = toast; t('x'); export const n: { show: (m: string) => void } = { show: toast };",
    "import { snapdom } from '@zumer/snapdom'; declare const el: HTMLElement; void snapdom.toCanvas(el, { dpr: 2 });",
    // A package's key registered per declaration, a value typed as the package's own type (its
    // keys judged where the literal is written), a class instance and a spread into a `plain`
    // parameter (P1 QA19 F1/F2).
    "import { Graphics } from 'pixi.js'; const g = new Graphics(); g.rect(0, 0, 40, 40).fill(0xffffff); g.x = 3;",
    "import { Toaster } from 'sonner'; import type { ComponentProps } from 'react'; const cfg: ComponentProps<typeof Toaster> = { position: 'top-center' }; export const a = <Toaster position={cfg.position} />;",
    "import { Container, Graphics } from 'pixi.js'; const c = new Container(); const gs = [new Graphics()]; c.addChild(...gs);",
    // Our own declarations and the TypeScript library's are checked where they land.
    'declare function f(o: { gap: number }): void; f({ gap: 14 }); JSON.stringify({ gap: 14 });',
    'export const a = <svg data-x="1" />; declare function C(p: { a?: number }): null; export const b = <C data-step="2" />;',
    "export const a = <div style={{ clipPath: 'inset(50%)' }} />;",
    "export const a = <div style={{ clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0 100%)' }} />;",
    `${REACT}const s: CSSProperties = { color: 'var(--a)' }; void s;`,
    'export const a = <svg><rect rx={0} fill="currentColor" stroke="url(#g)" opacity={1} /></svg>;',
    'export const a = <svg width="100%" height="100%" />;',
    // A canvas's width and height are its bitmap's resolution, not a box size (P1 QA16 F2).
    'export const a = <canvas width={480} height={320} />;',
    "declare const c: HTMLCanvasElement; c.setAttribute('width', '480');",
    'declare const fx: KeyframeEffect; fx.setKeyframes(null);',
    // A style declaration handed on as one stays a style declaration.
    "declare const el: HTMLElement; Object.assign(el.style, { opacity: '1' });",
    'declare const el: HTMLElement; declare function f(s: CSSStyleDeclaration): void; f(el.style);',
    'declare const el: HTMLElement; const s = el.style; export { s };',
    // What is not a style position is not read.
    "import { goodCard } from './styles'; const Box = (_: { data: object }) => null; export const a = <Box data={goodCard} />;",
    'const Box = (_: { style: Record<string, string> }) => null; declare const r: Record<string, string>; export const a = <Box style={r} />;',
    // A component's own props are its API; only React's DOM attribute types land on an element.
    'const Meter = (_: { width: number; fill: string }) => null; export const a = <Meter width={37} fill="red" />;',
    // A canvas's size is its bitmap's whatever the entry point (P1 QA17 S1).
    "declare function C(p: import('react').CanvasHTMLAttributes<HTMLCanvasElement>): null; export const a = <C width={480} />;",
    'declare function Icon(p: import(\'react\').SVGProps<SVGSVGElement>): null; export const a = <Icon width="var(--size-icon)" fill="currentColor" />;',
    // A fragment of the document is the one reference an inline value may make (P1 QA17 F5).
    "export const a = <div style={{ maskImage: 'url(#m)' }} />;",
    "declare const el: HTMLElement; const s = el.style; s.opacity = '1'; getComputedStyle(el).getPropertyValue('--a');",
  ]),
  invalid: [
    // A plain number in a transform is a factor only in `scale`: SVG user units are lengths
    // (P1 QA17 N1); both coordinates are reported.
    {
      filename,
      code: 'export const a = <svg><g transform="translate(37 12)" /></svg>;',
      errors: [{ messageId: 'value' }, { messageId: 'value' }],
    },
    // Literals take the stylesheet value checker (QA5 K6).
    ...red(
      [
        "declare const el: HTMLElement; el.style.width = '137px';",
        "declare const el: HTMLElement; el.style.setProperty('padding', '13px');",
        "declare const el: SVGElement; el.setAttribute('fill', '#f00');",
        "declare const el: HTMLElement; el.animate([{ color: '#f00' }, { opacity: 1 }], 0);",
        "declare const el: HTMLElement; el.animate({ color: ['#f00', 'var(--a)'] }, 0);",
        'declare const el: HTMLElement; el.animate([{ opacity: 0 }], 200);',
        'declare const el: HTMLElement; el.animate([{ opacity: 0 }], { duration: 300 });',
        "declare const el: HTMLElement; el.animate([{ opacity: 0 }], { pseudoElement: '::after' });",
        "declare const el: HTMLElement; el['animate']([{ padding: '13px' }]);",
        "declare const el: Element; el['setAttribute']('fill', '#f00');",
        "declare const el: HTMLElement; el.style['setProperty']('padding', '13px');",
        "declare const el: Element; el.setAttributeNS(null, 'fill', '#f00');",
        "declare const el: HTMLElement; Object.assign(el.style, { padding: '13px' });",
        'export const a = <div style={{ borderRadius: 7 }} />;',
        "export const a = <div style={{ color: '#f00' }} />;",
        'export const a = <div style={{ padding: 12 }} />;',
        'export const a = <div style={{ margin: -4 }} />;',
        `${REACT}const s: CSSProperties = { zIndex: 999 }; void s;`,
        "export const a = <div style={{ ['--local-weight']: 700 }} />;",
        'export const a = <svg><rect rx={7} /></svg>;',
        'export const a = <svg><rect fill="#f00" /></svg>;',
        'export const a = <svg><rect strokeWidth={3} /></svg>;',
        "export const a = <div style={{ mysteryProperty: 'x' }} />;",
        'export const a = <svg width={16} />;',
        'export const a = <img height="16" />;',
        `${REACT}declare function Avatar(p: { style: CSSProperties }): null; export const a = <Avatar style={{ width: 13 }} />;`,
        "declare function Icon(p: import('react').SVGProps<SVGSVGElement>): null; export const a = <Icon width={37} />;",
        'declare function Icon(p: import(\'react\').SVGProps<SVGSVGElement>): null; export const a = <Icon color="#f00" />;',
        "export const a = <div style={{ backgroundImage: 'url(data:image/svg+xml,x)' }} />;",
        "export const a = <div style={{ backgroundImage: 'url(https://a.example/x.png)' }} />;",
        "export const a = <div style={{ backgroundImage: 'url(./x.png)' }} />;",
        // A length inside a basic shape is a length like any other (P1 QA18 F2).
        "export const a = <div style={{ clipPath: 'polygon(0 0, 37px 0, 100% 100%)' }} />;",
        "export const a = <div style={{ clipPath: 'inset(0 0 12px 0)' }} />;",
        "export const a = <div style={{ clipPath: 'inset(0 round 8px)' }} />;",
        // A filter coefficient is a written number, as an opacity is (P1 QA18 should-fix 1).
        "export const a = <div style={{ filter: 'brightness(0.5)' }} />;",
        "export const a = <div style={{ filter: 'brightness(92%)' }} />;",
        // A `var()` fallback is the function's argument when the variable is unset (P1 QA22 F1).
        "export const a = <div style={{ filter: 'brightness(var(--qa-none, 92%))' }} />;",
        // Pixi's canvas `style` is the element's live style declaration (P1 QA22 F2).
        "import type { ICanvas } from 'pixi.js'; declare const c: ICanvas; Object.assign(c.style ?? {}, { width: '37px' });",
        "import type { ICanvas } from 'pixi.js'; declare const c: ICanvas; c.style!.width = '37px';",
      ],
      'value',
    ),
    // A name with no declaration in the receiving type is reported; only the open families
    // (`aria-*`, `data-*`, handlers) are attributes handed on (P1 QA22 F3).
    ...red(
      [
        'function I(p: { title?: string }) { return <svg {...p} />; } export const a = <I stroke-width="37" />;',
        'function I(p: { title?: string }) { return <svg {...p} />; } export const a = <I fill-opacity="0.3" />;',
      ],
      'undeclared',
    ),
    ...red(
      [
        'declare const el: HTMLElement; declare const k: Keyframe[]; el.animate(k, 0);',
        'declare const el: HTMLElement; declare const k: Keyframe; el.animate([k], 0);',
        'declare const el: HTMLElement; declare const k: Keyframe; el.animate([{ ...k }], 0);',
      ],
      'keyframes',
    ),
    ...red(
      [
        "declare const el: HTMLElement; declare const n: string; el.style.setProperty(n, 'x');",
        "declare const el: HTMLElement; declare const k: 'width'; el.style[k] = 'x';",
      ],
      'name',
    ),
    ...red(
      [
        "export const a = <div style={{ ['--avatar-corner-' + 'ratio']: 1 }} />;",
        `${REACT}declare const k: 'opacity' | 'color'; const s: CSSProperties = { [k]: 'var(--a)' }; void s;`,
      ],
      'computed',
    ),
    // Every expression that is not one of the four forms, whatever it holds: a binding, a member,
    // a call, an operator, a branch, a template with substitutions, an enum, a parameter.
    ...red(
      [
        "const SIZE = 'var(--size-icon)'; export const a = <div style={{ width: SIZE }} />;",
        "const SIZE = 'var(--size-icon)'; export const a = <div style={{ width: `${SIZE}` }} />;",
        "const sizes = { card: 'var(--space-3)' }; export const a = <div style={{ padding: sizes.card }} />;",
        "const C = [{ c: 'var(--a)' }]; export const a = C.map((x) => <div style={{ color: x.c }} />);",
        'declare const on: boolean; export const a = <div style={{ width: on ? 44 : 0 }} />;',
        "const n = 3; export const a = <div style={{ padding: n && 'var(--space-2)' }} />;",
        'enum Gap { Wide = 12 } export const a = <div style={{ gap: Gap.Wide }} />;',
        'function pad() { return 21; } export const a = <div style={{ padding: pad() }} />;',
        'export const A = ({ size = 8 }: { size?: number }) => <div style={{ width: size }} />;',
        'declare const n: number; export const a = <div style={{ gridRow: n, flexGrow: 1 }} />;',
        'declare const x: number; export const a = <div style={{ transform: `translateX(${x}px)` }} />;',
        'declare const c: string; export const a = <svg><rect fill={c} /></svg>;',
        'declare const el: HTMLElement; declare const w: number; el.style.width = `${w}px`;',
        "declare const el: HTMLElement; el.style.width += '1px';",
        "declare const el: HTMLElement; declare const c: string; el.style.setProperty('color', c);",
        'declare const el: HTMLElement; declare const o: number; el.animate([{ opacity: o }], 0);',
        // A runtime value into a custom property passes only through a registered runtime
        // source (RUNTIME_SOURCES is empty: none is registered yet).
        "declare const progress: number; export const a = <div style={{ ['--seat-progress']: progress }} />;",
        "declare const el: HTMLElement; declare const w: number; el.style.setProperty('--seat-width', `${w}px`);",
        "import { runtimeStyle } from './styles'; export const a = <div style={{ ['--x']: runtimeStyle(1) }} />;",
        // A member of a token constant passes only when the constant is registered.
        "import { tokens } from './styles'; export const a = <div style={{ padding: tokens.space.md }} />;",
        "import * as S from './styles'; export const a = <div style={{ padding: S.tokens.space.md }} />;",
      ],
      'untracked',
    ),
    // A whole style object not written out where it is used: a name, a member, an import, a
    // branch, a call, a spread, a library `CSSProperties`, a prop passed down.
    ...red(
      [
        "const card = { borderRadius: 'var(--radius-card)' }; export const a = <div style={card} />;",
        "import { goodCard } from './styles'; export const a = <div style={goodCard} />;",
        'const styles = { card: { padding: 12 } }; export const a = <div style={styles.card} />;',
        'declare const on: boolean; const card = { opacity: 1 }; export const a = <div style={on ? card : { opacity: 0 }} />;',
        "export const a = <div style={Object.fromEntries([['borderRadius', '50%']])} />;",
        'declare const r: Record<string, string>; export const a = <div style={{ ...r }} />;',
        `${REACT}declare const fromProps: CSSProperties; export const a = <div style={fromProps} />;`,
        `${REACT}declare function Avatar(p: { style: CSSProperties }): null; const o = { width: 13 }; export const a = <Avatar style={o} />;`,
        'declare const el: HTMLElement; declare const o: object; Object.assign(el.style, o);',
      ],
      'untracked',
    ),
    {
      filename,
      code: `${REACT}const o = { width: 13 }; const s: CSSProperties = o; export const a = <div style={s} />;`,
      errors: [{ messageId: 'untracked' }, { messageId: 'untracked' }],
    },
    {
      filename,
      code: `${REACT}export const A = ({ style }: { style: CSSProperties }) => <div style={{ ...style, color: '#f00' }} />;`,
      errors: [{ messageId: 'untracked' }, { messageId: 'value' }],
    },
    // A DOM value writer handed on unjudged (QA14 F4).
    ...red(
      [
        "declare const el: HTMLElement; el.animate.call(el, [{ padding: '13px' }], 100);",
        'declare const el: HTMLElement; export const anim = el.animate.bind(el);',
        'declare const el: Element; export const set = el.setAttribute;',
        'declare const el: HTMLElement; export const { animate } = el;',
      ],
      'indirect',
    ),
  ],
});

// E12: a package that writes the page is imported only by its adapter, judged by the import's
// syntax; the adapter hands it on neither by re-export nor through its exports' types.
const ADAPTED = [
  {
    packages: {
      sonner: {
        field: 'dependencies',
        why: 'fixture',
        entries: ['sonner'],
        adapters: { sonner: PROBE },
      },
    },
  },
];
tester.run('ui/package-adapter', uiLint.rules['package-adapter'], {
  valid: [
    // React's dependency lists compare identities and hand nothing on.
    ...green(
      [
        "import { Graphics } from 'pixi.js'; import { useEffect } from 'react'; const g = new Graphics(); export function useG(): void { useEffect(() => undefined, [g]); }",
      ],
      [
        {
          packages: {
            'pixi.js': {
              field: 'dependencies',
              why: 'fixture',
              entries: ['pixi.js'],
              adapters: { 'pixi.js': PROBE },
            },
          },
        },
      ],
    ),
    ...green([
      "export type { ToasterProps } from 'sonner';",
      "import { z } from 'zod'; export const s = z.string();",
      "import { useNavigate } from 'react-router'; export const useGo = () => useNavigate();",
    ]),
    ...green(
      [
        "import { toast } from 'sonner'; export function notify(message: string) { toast(message); }",
        'import { Toaster } from \'sonner\'; export function AppToaster() { return <Toaster position="top-center" />; }',
        "import { toast } from 'sonner'; export const notifier = { show: (message: string) => void toast(message) };",
        // A package's value stays under its own type: a binding without an annotation, its own
        // calls, elements and props.
        "import { toast } from 'sonner'; const t = toast; export function notify(m: string) { t(m, { duration: 1 }); }",
        "import { toast, type ExternalToast } from 'sonner'; const o: ExternalToast = {}; export function notify(m: string) { toast(m, o); }",
        'import { Toaster } from \'sonner\'; const T = Toaster; export function AppToaster() { return <T position="top-center" />; }',
        // Only the types a page-writing package ships are its own: zod's are not.
        "import 'sonner'; import { z } from 'zod'; declare function keep(x: unknown): void; keep(z.string()); export const s = z.string();",
        "import { toast } from 'sonner'; const { success } = toast; export function ok(m: string) { success(m); }",
        "import { toast } from 'sonner'; class Holder { t = toast; } export function show(m: string) { new Holder().t(m); }",
        // A written place, a method, an extended class, `as const`: no other type taken.
        "import { toast } from 'sonner'; const box = { t: toast } as const; export function show(m: string) { box.t(m); }",
        "import { toast } from 'sonner'; class Holder { t = toast; reset() { this.t = toast; } run() { return toast; } } export function show(m: string) { new Holder().run()(m); }",
      ],
      ADAPTED,
    ),
  ],
  invalid: [
    // No adapter is made yet: every import is debt.
    ...red(
      [
        "import { toast } from 'sonner'; toast('x');",
        "import 'sonner';",
        "void import('sonner');",
        'void import(`pixi.js`);',
        "export { toast } from 'sonner';",
        "export * from 'pixi.js';",
        "import * as Sentry from '@sentry/react'; void Sentry;",
        "import { Portal } from '@ark-ui/react/portal'; void Portal;",
        "import sonner = require('sonner'); void sonner;",
      ],
      'none',
    ),
    // Another module is the adapter.
    ...red(
      [
        "import { Dialog } from '@ark-ui/react/dialog'; void Dialog;",
        "void import('@ark-ui/react/dialog').then((m) => m.Dialog);",
        "export { Dialog } from '@ark-ui/react/dialog';",
        "export * from '@ark-ui/react/dialog';",
        "void import('@ark-ui/react/dialog');",
        "import { snapdom } from '@zumer/snapdom'; void snapdom;",
      ],
      'adapter',
    ),
    // The adapter hands the package on.
    ...red(["export { toast } from 'sonner';", "export * from 'sonner';"], 'reexport', ADAPTED),
    ...red(
      [
        "import { toast } from 'sonner'; export const notify = toast;",
        "import { toast } from 'sonner'; export { toast };",
        "import { toast as t } from 'sonner'; export { t as show };",
        "import { toast } from 'sonner'; export default toast;",
        "import { toast } from 'sonner'; export const notifier = { show: toast };",
        "import { Toaster } from 'sonner'; import type { ComponentProps } from 'react'; export type Props = ComponentProps<typeof Toaster>;",
        "import { Toaster } from 'sonner'; export const U = Toaster;",
        "import { toast, type ExternalToast } from 'sonner'; export function notify(message: string, options: ExternalToast) { toast(message, options); }",
        "import { toast } from 'sonner'; export function make() { return toast; }",
      ],
      'exposes',
      ADAPTED,
    ),
    // The package leaves under another type (P1 QA25 F1, QA24 F1, QA23 F1).
    ...red(
      [
        "import { Toaster } from 'sonner'; import type { FC } from 'react'; export const T: FC<{ gap?: number }> = Toaster;",
        "import { toast } from 'sonner'; export const notify: (m: string, o: { offset: number }) => void = toast;",
        "import { toast } from 'sonner'; let slot: ((m: string) => void) | undefined; export const keep = () => slot; slot = toast;",
        "import { toast } from 'sonner'; declare function keep(f: (m: string) => void): void; keep(toast);",
        "import { toast } from 'sonner'; setTimeout(toast, 0, 'x');",
        "import { toast } from 'sonner'; declare function keep(f: unknown): void; keep(toast.success);",
        "import { toast } from 'sonner'; queueMicrotask(toast.bind(null, 'x'));",
        "import { toast } from 'sonner'; const f = toast as unknown as () => void; f();",
        "import { Toaster } from 'sonner'; export function make(): unknown { return Toaster; }",
        "import { Toaster } from 'sonner'; import type { ComponentType } from 'react'; const later = (c: ComponentType<any>) => c; export const T = later(Toaster);",
        // No contextual type, and a position that takes the value somewhere no type describes
        // (P1 QA26 F1, F3).
        "import { toast } from 'sonner'; export function fail(): void { throw toast; }",
        "import { toast } from 'sonner'; queueMicrotask(() => { throw toast; });",
        "import { toast } from 'sonner'; class Holder { t: unknown = toast; } void Holder;",
        "import { toast } from 'sonner'; export function* each(): Generator<unknown> { yield toast; }",
        "import 'sonner'; export const load = (): Promise<unknown> => import('sonner');",
      ],
      'escapes',
      ADAPTED,
    ),
    // A slot of a package type is declared where no package is imported, or declared global:
    // the module or global holding it exposes the package (P1 QA26 F2).
    ...red(
      [
        "export function keep(f: typeof import('sonner').toast): void { void f; }",
        "export let slot: typeof import('sonner').Toaster | undefined;",
        "declare global { var shown: typeof import('sonner').toast; } export {};",
        "declare global { interface Window { shown: typeof import('sonner').toast } } export {};",
        "declare var shown: typeof import('sonner').toast;",
        "import type { Toaster } from 'sonner'; export type T = typeof Toaster;",
        "import type sonner = require('sonner'); export type S = typeof sonner;",
      ],
      'exposes',
      ADAPTED,
    ),
    // A debt module (no adapter yet) is judged the same: its import is debt, and it hands nothing on.
    {
      filename,
      code: "import { Graphics } from 'pixi.js'; export const make = () => new Graphics();",
      errors: [{ messageId: 'none' }, { messageId: 'exposes' }],
    },
    {
      filename,
      code: "import { Graphics } from 'pixi.js'; declare function keep(g: object): void; keep(new Graphics());",
      errors: [{ messageId: 'none' }, { messageId: 'escapes' }],
    },
  ],
});
