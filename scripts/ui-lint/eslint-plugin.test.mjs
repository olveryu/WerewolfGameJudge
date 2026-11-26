/**
 * The TSX half of the UI gate's first rules: no stylesheet is created from code (E5, QA13 Q5) and
 * inline style keys stay enumerable (E4, QA13 Q9). Cases cover each call and wrapping form P1 QA1
 * used to get past a name-based check (F11, F12). Typed cases run against a fixture program so
 * the checker decides what a callee, tag or key is.
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

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURES = path.join(import.meta.dirname, '__fixtures__');
const filename = path.join(FIXTURES, 'probe.tsx');

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: FIXTURES,
      ecmaFeatures: { jsx: true },
      // With CI=true typescript-eslint infers a single run and builds its program once from the
      // fixture files on disk, so each case's own source would get the placeholder's types
      // (P1 QA2 G10). RuleTester feeds sources that exist only in memory.
      disallowAutomaticSingleRunInference: true,
    },
  },
});

const REACT = "import { createElement, type CSSProperties } from 'react';\n";

function cases(entries, messageId) {
  return entries.map((code) => ({ filename, code, errors: [{ messageId }] }));
}

tester.run('ui/no-style-elements', uiLint.rules['no-style-elements'], {
  valid: [
    'export const a = <div />;',
    'const Link = (_: { to: string }) => null; export const a = <Link to="/" />;',
    "document.createElement('canvas');",
    'declare const tag: "a" | "canvas"; document.createElement(tag);',
    `${REACT}const C = () => null; createElement(C);`,
    "document.createElementNS('http://www.w3.org/2000/svg', 'circle');",
    'declare const el: HTMLElement; el.textContent = "x";',
    'declare const storage: { write(s: string): void }; storage.write("<style>");',
    'const Card = () => null; export const a = <Card />;',
    'const ui = { Card: () => null }; export const a = <ui.Card />;',
    "Object.assign(document.body.style, { color: 'red' });",
    'declare const o: { a: number }; Object.assign(o, { a: 1 });',
    // P1 QA3 H6: the widened checks leave ordinary code alone.
    'declare const avatar: HTMLElement; const copy = avatar.cloneNode(true); document.body.append(copy);',
    "declare const a: HTMLAnchorElement; a.rel = 'noopener'; a.setAttribute('rel', 'noreferrer');",
    "declare const el: HTMLElement; el.setAttribute('data-x', 'stylesheet');",
    'declare const o: { a: number }; declare const k: "a"; Reflect.set(o, k, 1);',
    "declare const el: HTMLElement; Object.getOwnPropertyDescriptor(el, 'title');",
    "declare const el: HTMLElement; el.insertAdjacentElement('beforeend', document.createElement('div'));",
  ].map((code) => ({ filename, code })),
  invalid: [
    ...cases(
      [
        'export const s = <style>{".avatar{}"}</style>;',
        'export const l = <link rel="stylesheet" />;',
        'export const s = <svg><style /></svg>;',
        "document.createElement('style');",
        'document.createElement(`link`);',
        "document['createElement']('style');",
        "document.createElement?.('style');",
        "document.createElementNS('http://www.w3.org/2000/svg', 'style');",
        "const ce = document.createElement.bind(document); ce('style');",
        "document.createElement.call(document, 'style');",
        'declare const tag: "style" | "div"; document.createElement(tag);',
        `${REACT}createElement('style');`,
        "import { jsx as _jsx } from 'react/jsx-runtime'; _jsx('style', {});",
        "document.createElement.apply(document, ['style']);",
        // P1 QA2 G5: a tag held in a variable, Reflect.apply.
        "const Tag = 'style' as const; export const s = <Tag>{'.a{}'}</Tag>;",
        'const Tag = \'link\' as const; export const l = <Tag rel="stylesheet" href="/x.css" />;',
        "declare const Tag: 'style' | 'div'; export const s = <Tag />;",
        "const tags = { S: 'style' } as const; export const s = <tags.S />;",
        "const ce = document.createElement.bind(document); Reflect.apply(ce, undefined, ['style']);",
        "Reflect.apply(document.createElement, document, ['style']);",
        // P1 QA3 H6 a7: an existing element turned into a stylesheet link.
        "declare const el: Element; const l = el.cloneNode(true) as Element; l.setAttribute('rel', 'stylesheet');",
        "declare const el: Element; el.setAttribute('REL', 'icon stylesheet');",
        "declare const link: HTMLLinkElement; link.rel = 'stylesheet';",
        "declare const el: { relList: DOMTokenList }; el.relList.add('stylesheet');",
        'declare const el: { relList: DOMTokenList }; declare const v: string; el.relList.value = v;',
        "declare const el: Element; declare const k: string; el.setAttribute(k, 'stylesheet');",
      ],
      'element',
    ),
    ...cases(
      [
        'declare const tagName: string; document.createElement(tagName);',
        'declare const tagName: `s${string}`; document.createElement(tagName);',
        "document.createElement('st' + 'yle');",
        'declare const args: [string]; document.createElement.apply(document, args);',
        // P1 QA2 G5: spread arguments, an unreadable Reflect.apply list, a wide JSX tag.
        "const args: [string] = ['style']; document.createElement(...args);",
        'declare const args: [string]; Reflect.apply(document.createElement, document, args);',
        'declare const fn: any; Reflect.apply(fn, undefined, ["style"]);',
        'declare const Tag: string; export const s = <Tag />;',
      ],
      'dynamic',
    ),
    ...cases(
      [
        "document.body.innerHTML = '<style>.a{}</style>';",
        "document.body.outerHTML = '<style>.a{}</style>';",
        "document.body.insertAdjacentHTML('beforeend', '<style>.a{}</style>');",
        "document.write('<style>.a{}</style>');",
        "new Range().createContextualFragment('<style>.a{}</style>');",
        "new DOMParser().parseFromString('<style></style>', 'text/html');",
        // P1 QA2 G5 and G4: sinks written another way.
        "declare const el: HTMLElement; Object.assign(el, { innerHTML: '<style></style>' });",
        "declare const el: HTMLElement; Reflect.set(el, 'innerHTML', '<style></style>');",
        "declare const el: HTMLElement; Object.defineProperty(el, 'outerHTML', { value: '' });",
        "declare const el: HTMLElement; declare const k: string; el[k] = '<style></style>';",
        "declare const el: HTMLElement; el['inner' + 'HTML'] = '<style></style>';",
        'declare const el: HTMLElement; declare const src: Record<string, string>; Object.assign(el, src);',
        "export const a = <div dangerouslySetInnerHTML={{ __html: '<style></style>' }} />;",
        // P1 QA3 H6 a2–a6: wide targets, unenumerable keys, indirect calls, descriptors.
        "declare const t: object; Reflect.set(t, 'innerHTML', '<style></style>');",
        "declare const t: unknown; Reflect.set(t as object, 'outerHTML', '');",
        "declare const el: HTMLElement; declare const k: string; Object.assign(el, { [k]: '' });",
        "declare const el: HTMLElement; HTMLElement.prototype.insertAdjacentHTML.call(el, 'beforeend', '');",
        "declare const el: HTMLElement; Reflect.apply(el.insertAdjacentHTML, el, ['beforeend', '']);",
        "declare const el: HTMLElement; el.insertAdjacentHTML.apply(el, ['beforeend', '']);",
        "declare const el: HTMLElement; Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')?.set?.call(el, '');",
        "declare const el: HTMLElement; Reflect.getOwnPropertyDescriptor(el, 'outerHTML');",
        'declare const el: HTMLElement; Object.getOwnPropertyDescriptors(el);',
        "declare const el: HTMLElement; (el as unknown as { __lookupSetter__(k: string): unknown }).__lookupSetter__('innerHTML');",
      ],
      'sink',
    ),
  ],
});

tester.run(
  'ui/no-style-elements: React DOM resources (P1 QA3 H6 a1)',
  uiLint.rules['no-style-elements'],
  {
    valid: [
      { filename, code: "import { preconnect } from 'react-dom'; preconnect('https://x.test');" },
    ],
    invalid: [
      "import { preinit } from 'react-dom'; preinit('/x.css', { as: 'style' });",
      "import * as ReactDOM from 'react-dom'; ReactDOM.preload('/x.css', { as: 'style' });",
      "import { preinit } from 'react-dom'; const p = preinit; p('/x.css', { as: 'style' });",
    ].map((code) => ({ filename, code, errors: [{ messageId: 'resource' }] })),
  },
);

tester.run('ui/no-style-elements: Vite HTML tag descriptors', uiLint.rules['no-style-elements'], {
  valid: [
    {
      filename,
      code: "export const t = { tag: 'script', children: '' };",
      options: [{ htmlTagDescriptors: true }],
    },
    { filename, code: "export const t = { tag: 'style' };" },
  ],
  invalid: [
    {
      filename,
      code: "export const t = { tag: 'style', children: '.a{}' };",
      options: [{ htmlTagDescriptors: true }],
      errors: [{ messageId: 'element' }],
    },
  ],
});

tester.run(
  'ui/no-style-elements with htmlSinks off (web tests)',
  uiLint.rules['no-style-elements'],
  {
    valid: [
      {
        filename,
        code: "document.body.innerHTML = '<div></div>';",
        options: [{ htmlSinks: false }],
      },
    ],
    invalid: [
      {
        filename,
        code: "document.createElement('style');",
        options: [{ htmlSinks: false }],
        errors: [{ messageId: 'element' }],
      },
    ],
  },
);

tester.run('ui/inline-style-static-keys', uiLint.rules['inline-style-static-keys'], {
  valid: [
    'export const a = <div style={{ top: 0, ["--x"]: 1, [`left`]: 2 }} />;',
    'declare const side: "left" | "right"; export const a = <div style={{ [side]: 4 }} />;',
    `${REACT}declare const s: CSSProperties; export const a = <div style={s} />;`,
    `${REACT}declare const s: CSSProperties; export const a = <div style={{ ...s, top: 0 }} />;`,
    'declare const s: { [k: `--${string}`]: number }; export const a = <div style={s} />;',
    'declare const k: string; export const lookup = { [k]: 1 };',
  ].map((code) => ({ filename, code })),
  invalid: [
    ...cases(
      [
        "export const a = <div style={{ ['--avatar-corner-' + 'ratio']: 0.5 }} />;",
        'declare const k: string; export const a = <div style={{ [k]: 1 }} />;',
        'declare const k: string; export const a = <div style={{ [`--${k}`]: 1 }} />;',
        'declare const k: string; export const a = <div style={{ ...{ [k]: 1 } }} />;',
        `${REACT}declare const k: string; export const a = <div style={({ [k]: 1 }) satisfies CSSProperties} />;`,
        'declare const k: string; declare const c: boolean; export const a = <div style={c ? { [k]: 1 } : {}} />;',
        `${REACT}declare const k: string; const dyn: CSSProperties = { [k]: 1 }; export const a = <div style={dyn} />;`,
        `${REACT}declare const k: string; createElement('div', { style: { [k]: 1 } });`,
        // P1 QA3 H10: the style key spelled as a string or a computed constant.
        `declare const k: string; export const a = <div {...{ 'style': { [k]: 1 } }} />;`,
        `declare const k: string; export const a = <div {...{ ['style']: { [k]: 1 } }} />;`,
        `declare const k: string; const S = 'style'; export const a = <div {...{ [S]: { [k]: 1 } }} />;`,
      ],
      'computed',
    ),
    ...cases(
      [
        'declare const k: string; export const a = <div style={Object.fromEntries([[k, 1]])} />;',
        'declare const r: Record<string, number>; export const a = <div style={r} />;',
        // P1 QA2 G6: a pattern key other than `--${string}`.
        'declare const side: string; const s8: Record<`border${string}`, string> = { [`border${side}Radius`]: "13px" }; export const a = <div style={s8} />;',
        `${REACT}declare const k: string; createElement('div', { style: Object.fromEntries([[k, 1]]) });`,
        // P1 QA3 H10: style reaching the element through a spread props object.
        "declare const rec: Record<string, string>; export const a = <div {...{ 'style': rec }} />;",
        'declare const props: { style: Record<string, string> }; export const a = <div {...props} />;',
      ],
      'indexed',
    ),
  ],
});

const inRepo = (code, extra = {}) => ({ filename, code, ...extra });
/** A file inside the web package, where the sink-open test modules live (H8). */
const inWeb = (code, extra = {}) => ({
  filename: path.join(REPO_ROOT, 'packages/web/src/features/qaprobe/Probe.tsx'),
  code,
  // import-scope needs no type information; the fixture tsconfig only covers __fixtures__.
  languageOptions: { parserOptions: { project: null } },
  ...extra,
});

tester.run('ui/import-scope (P1 QA3 H1, H8)', uiLint.rules['import-scope'], {
  valid: [
    inRepo("import '@/theme/tokens.css';"),
    inRepo("import '../../../packages/web/src/theme/tokens.css';"),
    // The CSS gate covers the whole web package, the local preview page included.
    inRepo("import '../../../packages/web/preview/preview.css';"),
    inRepo("import { a } from './probe';"),
    inRepo("const icons = import.meta.glob('./icons/*.svg', { eager: true });"),
    inRepo("const art = import.meta.glob(['./a/*.webp', '!./a/x.webp']);"),
    inRepo("export const lazy = () => import('./probe');"),
    // Helpers outside the sink-open test files carry the full gate, so anything may import them.
    inRepo("import { fixture } from './__tests__/fixture';"),
    inRepo("import { renderRoom } from '@/test-utils/renderRoom';"),
    {
      filename: path.join(FIXTURES, '__tests__/probe.tsx'),
      code: "import { fixture } from './__tests__/fixture';",
    },
    // Test files may import each other.
    inWeb("import { setup } from './other.test';", {
      filename: path.join(REPO_ROOT, 'packages/web/src/features/qaprobe/Probe.test.tsx'),
    }),
  ],
  invalid: [
    ...[
      "import 'normalize.css';",
      "import './missing.css';",
      "import '@/theme/tokens.css?inline';",
      "import css from '@/theme/tokens.css?raw';",
      "import './theme.scss';",
      "import '../../../node_modules/x/y.css';",
      "import '../../../packages/web/node_modules/x/y.css';",
      "import '../../../packages/game-engine/src/x.css';",
      "export * from './a.css';",
    ].map((code) => inRepo(code, { errors: [{ messageId: 'style' }] })),
    ...[
      "import { setup } from './probe.test';",
      "import { setup } from './probe.test.tsx';",
      "import { setup } from '../qaprobe/helpers.test';",
      "import '@/scene/__tests__/exerciseDecoration';",
    ].map((code) => inWeb(code, { errors: [{ messageId: 'test' }] })),
    ...[
      "const styles = import.meta.glob('./*.css');",
      "const mods = import.meta.glob('./*');",
      "const mods = import.meta.glob('./**/*.{ts,css}');",
      'declare const p: string; const mods = import.meta.glob(p);',
    ].map((code) => inRepo(code, { errors: [{ messageId: 'glob' }] })),
    ...[
      'declare const p: string; export const lazy = () => import(p);',
      'declare const p: string; export const lazy = () => import(`./${p}.css`);',
    ].map((code) => inRepo(code, { errors: [{ messageId: 'dynamic' }] })),
  ],
});
