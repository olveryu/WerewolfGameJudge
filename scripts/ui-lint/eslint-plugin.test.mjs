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

const FIXTURES = path.join(import.meta.dirname, '__fixtures__');
const filename = path.join(FIXTURES, 'probe.tsx');

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: FIXTURES,
      ecmaFeatures: { jsx: true },
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
      ],
      'element',
    ),
    ...cases(
      [
        'declare const tagName: string; document.createElement(tagName);',
        'declare const tagName: `s${string}`; document.createElement(tagName);',
        "document.createElement('st' + 'yle');",
        "document.createElement.apply(document, ['style']);",
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
      ],
      'sink',
    ),
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
      ],
      'computed',
    ),
    ...cases(
      [
        'declare const k: string; export const a = <div style={Object.fromEntries([[k, 1]])} />;',
        'declare const r: Record<string, number>; export const a = <div style={r} />;',
        `${REACT}declare const k: string; createElement('div', { style: Object.fromEntries([[k, 1]]) });`,
      ],
      'indexed',
    ),
  ],
});
