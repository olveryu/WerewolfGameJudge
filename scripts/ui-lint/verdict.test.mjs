/**
 * The one exit of the value check (plan v3.12 §2 E4, D15 ②): `verdict` is the only code that
 * decides a value passes, a TSX value is read from its write site's syntax alone
 * (`written.mjs`), and every entry point that writes a style value rejects any other expression.
 * Pins: what may call into the value rules and read a value (static), what `writtenValue` reads
 * from every expression kind, what `verdict` does with each reading kind, and every entry point
 * fed an expression (it must report).
 */
import fs from 'node:fs';
import path from 'node:path';

import { Linter } from 'eslint';
import stylelint from 'stylelint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import uiLint from './eslint-plugin.mjs';
import config from './stylelint.gate.mjs';
import { DOM_VALUE_WRITERS, SVG_ATTRIBUTES } from './registry.mjs';
import * as values from './values.mjs';
import { writtenValue } from './written.mjs';

const HERE = import.meta.dirname;
const source = (name) => fs.readFileSync(path.join(HERE, name), 'utf8');
const count = (text, pattern) => text.match(pattern)?.length ?? 0;

describe('UI gate value exit (static)', () => {
  it('exports `verdict` and no other value decision', () => {
    expect(Object.keys(values).sort()).toEqual(['domainOf', 'valueMessages', 'verdict'].sort());
  });

  it('routes every value report of the rules through `verdict`', () => {
    const eslintPlugin = source('eslint-plugin.mjs');
    const stylelintPlugin = source('stylelint-plugin.mjs');
    // The ESLint rule reports a verdict's problems in one place (`judge`), and never names a
    // value message ID itself.
    expect(count(eslintPlugin, /\bverdict\(/g)).toBe(1);
    expect(count(eslintPlugin, /messageId: '(?:value|untracked)'/g)).toBe(0);
    // The Stylelint rule: a declaration and an `@supports` test.
    expect(count(stylelintPlugin, /\bverdict\(/g)).toBe(2);
    for (const text of [eslintPlugin, stylelintPlugin])
      expect(text).not.toMatch(/\bvalueProblems\b/);
  });

  // v3.12 (D15 ②): a TSX value is read from its write site's syntax and import source alone.
  it('reads a TSX value only through `written.mjs`, which uses no types', () => {
    // Code only: comments may name what the module does not do.
    const written = source('written.mjs').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(written).not.toMatch(/^import /m);
    expect(written).not.toMatch(/checker|getType|program|symbol|services/i);
    const rule = source('eslint-plugin.mjs').slice(
      source('eslint-plugin.mjs').indexOf('const inlineStyleKeys = {'),
    );
    // A literal reading is built only by `writtenValue`; the rule builds only the readings that
    // never pass a value (`runtime`) and the registered publisher's.
    expect(rule).not.toMatch(/\{ text:|\{ token:|\{ wrapped:/);
    expect(count(rule, /\{ runtime: '(?:expression|object)' \}/g)).toBe(3);
    expect(count(rule, /\{ registered: TOKEN_PUBLISHER \}/g)).toBe(1);
    // The checker names entry points (a style declaration, a `CSSProperties` position, a DOM
    // writer, an import's module) and is never asked what a value holds.
    expect(rule).not.toMatch(
      /getTypeOfSymbol|getBaseTypeOfLiteralType|getWidenedType|\.isStringLiteral\(\)|\.isNumberLiteral\(\)|\.isLiteral\(\)/,
    );
  });
});

// Every ESTree expression kind other than the four forms reads as a runtime expression, whatever
// type it has: the reading takes a node and an import lookup, nothing else.
describe('UI gate written value', () => {
  const parse = (code) => {
    const { ast } = tseslint.parser.parseForESLint(`(${code});`, {
      ecmaFeatures: { jsx: true },
      filePath: 'probe.tsx',
    });
    return ast.body[0].expression;
  };
  const px = (number) => (number === 0 ? '0' : `${number}px`);
  const noImport = () => null;
  const imported = (identifier) =>
    identifier.name === 'tokens' || identifier.name === 'wrap'
      ? { module: 'm', name: identifier.name }
      : null;
  it.each([
    ["'var(--a)'", { text: 'var(--a)' }],
    ['`var(--a)`', { text: 'var(--a)' }],
    ['0', { text: '0' }],
    ['12', { text: '12px' }],
    ['-1', { text: '-1px' }],
    ["'var(--a)' as const", { text: 'var(--a)' }],
  ])('%s is a literal', (code, reading) => {
    expect(writtenValue(parse(code), px, noImport)).toEqual(reading);
  });
  it('reads a member of an import and a call of one by the import alone', () => {
    expect(writtenValue(parse('tokens.space.md'), px, imported)).toEqual({
      token: 'm#tokens',
      path: ['space', 'md'],
    });
    expect(writtenValue(parse('wrap(x)'), px, imported)).toEqual({ wrapped: 'm#wrap' });
    expect(writtenValue(parse('tokens.space.md'), px, noImport)).toEqual({
      runtime: 'expression',
    });
    expect(writtenValue(parse('tokens["space"]'), px, imported)).toEqual({
      runtime: 'expression',
    });
    expect(writtenValue(parse('tokens?.space'), px, imported)).toEqual({ runtime: 'expression' });
    expect(writtenValue(parse('tokens'), px, imported)).toEqual({ runtime: 'expression' });
  });
  it.each([
    'x',
    'x.y',
    'x[0]',
    'f()',
    'f?.()',
    'new F()',
    'a + b',
    "'1' + 'px'",
    'a ? b : c',
    "true ? 'var(--a)' : 'var(--b)'",
    'a || b',
    'a ?? b',
    '`${a}`',
    "`${'var(--a)'}`",
    'String.raw`x`',
    '(a, b)',
    '-x',
    '+1',
    'typeof x',
    'void 0',
    '!x',
    'x = 1',
    'x++',
    '() => 1',
    'function () {}',
    'class {}',
    'this',
    '[1]',
    '({})',
    'await x',
    'import("x")',
    '<a />',
    "x as 'var(--a)'",
    'x!',
    'null',
    'undefined',
    'true',
    '/x/',
    '1n',
  ])('%s is a runtime expression', (code) => {
    expect(writtenValue(parse(code), px, imported)).toEqual({ runtime: 'expression' });
  });
});

describe('UI gate verdict', () => {
  it('passes only what it shows to be tokens', () => {
    expect(values.verdict([{ text: 'var(--a)' }], 'color')).toEqual([]);
    const tokens = new Map([['m#tokens', 'color']]);
    const runtimeSources = new Set(['m#wrap']);
    const options = { tokens, runtimeSources };
    expect(values.verdict([{ token: 'm#tokens', path: ['a'] }], 'color', options)).toEqual([]);
    expect(values.verdict([{ token: 'm#tokens', path: ['a'] }], '--x', options)).toEqual([]);
    expect(values.verdict([{ wrapped: 'm#wrap' }], '--x', options)).toEqual([]);
  });

  it('rejects everything else', () => {
    const ids = (readings, prop, options) =>
      values.verdict(readings, prop, options).map((p) => p.messageId);
    const options = {
      tokens: new Map([['m#tokens', 'color']]),
      runtimeSources: new Set(['m#wrap']),
    };
    expect(() => values.verdict([], 'color')).toThrow('no reading');
    expect(ids([{ text: '#f00' }], 'color')).toEqual(['value']);
    expect(ids([{ text: 'x' }], 'mystery-property')).toEqual(['value']);
    expect(ids([{ runtime: 'expression' }], 'color')).toEqual(['untracked']);
    expect(ids([{ runtime: 'expression' }], '--x')).toEqual(['untracked']);
    expect(ids([{ token: 'm#tokens', path: ['a'] }], 'padding', options)).toEqual(['untracked']);
    expect(ids([{ token: 'm#other', path: ['a'] }], 'color', options)).toEqual(['untracked']);
    expect(ids([{ wrapped: 'm#wrap' }], 'width', options)).toEqual(['untracked']);
    expect(ids([{ wrapped: 'm#other' }], '--x', options)).toEqual(['untracked']);
    expect(ids([{ registered: 'packages/web/src/x.ts' }], '--color-a')).toEqual(['untracked']);
    expect(ids([{ runtime: 'object' }], null)).toEqual(['untracked']);
    expect(() => values.verdict([{ runtime: 'number' }], 'width')).toThrow('runtime number');
    expect(() => values.verdict([{}], 'color')).toThrow('has no kind');
  });
});

const FIXTURES = path.join(HERE, '__fixtures__');
const linter = new Linter({ configType: 'flat' });
const lint = (code) =>
  linter.verify(
    code,
    {
      files: ['**/*.tsx'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          project: './tsconfig.json',
          tsconfigRootDir: FIXTURES,
          ecmaFeatures: { jsx: true },
          disallowAutomaticSingleRunInference: true,
        },
      },
      plugins: { ui: uiLint },
      rules: { 'ui/inline-style-keys': 'error' },
    },
    path.join(FIXTURES, 'probe.tsx'),
  );
const HEAD =
  "import type { CSSProperties } from 'react';\ndeclare const u: unknown; declare const el: HTMLElement;\n";

// Every entry point of `ui/inline-style-keys`, fed a value of unknown type.
const ENTRIES = [
  'export const a = <div style={{ color: u }} />;',
  'export const a = <div style={u as CSSProperties} />;',
  'export const a = <div style={{ ...(u as CSSProperties) }} />;',
  'export const a = <img width={u as number} />;',
  'el.style.color = u as string;',
  "el.style.setProperty('color', u as string);",
  "el.setAttribute('fill', u as string);",
  'el.animate([{ color: u as string }], 0);',
  'el.animate([{ opacity: 0, easing: u as string }], 0);',
  'el.animate([{ opacity: 0 }], { duration: u as number });',
  'el.animate([{ opacity: 0 }], u as number);',
  // A writer is found by the member it resolves to, however it is spelled (QA14 F4, N1).
  "el['animate']([{ color: u as string }]);",
  "el.style['setProperty']('color', u as string);",
  "el['setAttribute']('fill', u as string);",
  "el.setAttributeNS(null, 'fill', u as string);",
  'Object.assign(el.style, { color: u as string });',
  'export const anim = el.animate.call(el, [], 0);',
  "const s = { color: 'var(--a)' }; export const a = <div style={s} />;",
  "const s: CSSProperties = { color: 'var(--a)' }; s.color = u as string;",
  'const s: CSSProperties = {}; Object.assign(s, { color: u as string });',
  'const s: CSSProperties = { color: u as string }; export { s };',
  'function mk(): CSSProperties { return u as CSSProperties; } export { mk };',
  'declare function K(p: { style: CSSProperties }): null; export const k = <K style={u as CSSProperties} />;',
  'export const a = <div style={{ color: (0, u) as string }} />;',
  'export const a = <div style={{ color: String.raw`${u}` }} />;',
  'export const a = <div style={{ color: new String(u) as string }} />;',
  'export const a = <div style={{ color: `${u}` }} />;',
  ...[...SVG_ATTRIBUTES.keys()].map(
    (name) => `export const a = <svg><g ${name}={u as string} /></svg>;`,
  ),
];

describe('UI gate TSX entry points reject an unknown value', () => {
  it.each(ENTRIES)(
    '%s',
    (code) => {
      const messages = lint(HEAD + code);
      expect(messages.filter((m) => m.fatal)).toEqual([]);
      expect(messages.map((m) => m.ruleId)).toContain('ui/inline-style-keys');
    },
    30_000,
  );
});

describe('UI gate DOM value writers', () => {
  // The writers are named as the default library declares them: a renamed interface would leave
  // a writer unrecognised, so each must exist there.
  const lib = fs.readFileSync(
    path.join(
      path.dirname(import.meta.resolve('typescript').replace('file://', '')),
      'lib.dom.d.ts',
    ),
    'utf8',
  );
  it.each([...DOM_VALUE_WRITERS.keys()])('%s is declared by lib.dom', (key) => {
    const [owner, member] = key.split('.');
    const body = lib.match(new RegExp(`interface ${owner}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1];
    expect(body).toBeDefined();
    expect(body).toMatch(new RegExp(`\\n    ${member}\\(`));
  });
});

describe('UI gate stylesheet entry points reject an unread value', () => {
  it.each([
    'a { color: attr(data-x); }',
    'a { color: env(x); }',
    '@supports (color: attr(data-x)) { a { opacity: 1; } }',
  ])('%s', async (code) => {
    const { results } = await stylelint.lint({
      code,
      codeFilename: 'packages/web/src/features/x/X.css',
      config,
      configBasedir: process.cwd(),
    });
    expect(results[0].warnings.length).toBeGreaterThan(0);
  });
});
