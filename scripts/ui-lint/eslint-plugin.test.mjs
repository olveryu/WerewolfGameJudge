/**
 * The TSX half of the UI gate's first rules: no stylesheet is created from code (E5, QA13 Q5) and
 * inline style keys stay enumerable (E4, QA13 Q9). Typed cases run against a fixture program so
 * the checker decides what a tag or key can be.
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

tester.run('ui/no-style-elements', uiLint.rules['no-style-elements'], {
  valid: [
    { filename, code: 'export const a = <div />;' },
    { filename, code: "document.createElement('canvas');" },
    {
      filename,
      code: 'declare function createElement(t: unknown): void; const C = () => null; createElement(C);',
    },
    {
      filename,
      code: "declare const tag: 'a' | 'canvas'; document.createElement(tag);",
    },
  ],
  invalid: [
    {
      filename,
      code: 'export const s = <style>{".avatar{}"}</style>;',
      errors: [{ messageId: 'element' }],
    },
    {
      filename,
      code: 'export const l = <link rel="stylesheet" />;',
      errors: [{ messageId: 'element' }],
    },
    { filename, code: "document.createElement('style');", errors: [{ messageId: 'element' }] },
    { filename, code: 'document.createElement(`link`);', errors: [{ messageId: 'element' }] },
    {
      filename,
      code: "declare const tag: 'style' | 'div'; document.createElement(tag);",
      errors: [{ messageId: 'element' }],
    },
    {
      filename,
      code: 'declare const tagName: string; document.createElement(tagName);',
      errors: [{ messageId: 'dynamic' }],
    },
    {
      filename,
      code: 'declare const tagName: `s${string}`; document.createElement(tagName);',
      errors: [{ messageId: 'dynamic' }],
    },
    {
      filename,
      code: "document.createElement('st' + 'yle');",
      errors: [{ messageId: 'dynamic' }],
    },
    {
      filename,
      code: "declare function jsx(t: unknown, p: unknown): void; jsx('style', {});",
      errors: [{ messageId: 'element' }],
    },
  ],
});

tester.run('ui/inline-style-static-keys', uiLint.rules['inline-style-static-keys'], {
  valid: [
    { filename, code: 'export const a = <div style={{ top: 0, ["--x"]: 1, [`left`]: 2 }} />;' },
    {
      filename,
      code: "declare const side: 'left' | 'right'; export const a = <div style={{ [side]: 4 }} />;",
    },
    { filename, code: 'declare const s: object; export const a = <div style={s} />;' },
  ],
  invalid: [
    {
      filename,
      code: "export const a = <div style={{ ['--avatar-corner-' + 'ratio']: 0.5 }} />;",
      errors: [{ messageId: 'computed' }],
    },
    {
      filename,
      code: 'declare const k: string; export const a = <div style={{ [k]: 1 }} />;',
      errors: [{ messageId: 'computed' }],
    },
    {
      filename,
      code: 'declare const k: string; export const a = <div style={{ [`--${k}`]: 1 }} />;',
      errors: [{ messageId: 'computed' }],
    },
  ],
});
