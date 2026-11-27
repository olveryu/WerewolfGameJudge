/**
 * The one exit of the value check (plan v3.9 §2 E4, P1 QA13): `verdict` is the only code that
 * decides a value passes, and every entry point that writes a style value rejects a value it
 * cannot read. Three pins: what may call into the value rules (static), what `verdict` does with
 * each reading kind, and every entry point fed a value of unknown type (it must report).
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

const HERE = import.meta.dirname;
const source = (name) => fs.readFileSync(path.join(HERE, name), 'utf8');
const count = (text, pattern) => text.match(pattern)?.length ?? 0;

describe('UI gate value exit (static)', () => {
  it('exports `verdict` and no other value decision', () => {
    expect(Object.keys(values).sort()).toEqual(
      ['domainOf', 'originsOf', 'valueMessages', 'verdict', 'withOrigins'].sort(),
    );
  });

  it('routes every value report of the rules through `verdict`', () => {
    const eslintPlugin = source('eslint-plugin.mjs');
    const stylelintPlugin = source('stylelint-plugin.mjs');
    // The ESLint rule reports a verdict's problems in one place (`judge`), and never names a
    // value message ID itself.
    expect(count(eslintPlugin, /\bverdict\(/g)).toBe(1);
    expect(count(eslintPlugin, /messageId: '(?:value|untracked|untraced)'/g)).toBe(0);
    // The Stylelint rule: a declaration and an `@supports` test.
    expect(count(stylelintPlugin, /\bverdict\(/g)).toBe(2);
    for (const text of [eslintPlugin, stylelintPlugin])
      expect(text).not.toMatch(/\bvalueProblems\b|\bruntimeFits\b/);
  });

  it('reads a declaration from what is written to it only through `provable`', () => {
    const eslintPlugin = source('eslint-plugin.mjs');
    // One definition, one gate in `sourcesOfDeclaration`; no other reading of later writes.
    expect(count(eslintPlugin, /\bprovable\(/g)).toBe(2);
    expect(eslintPlugin).toMatch(/if \(!provable\(declaration, checker\)\) return \[UNREAD\];/);
    expect(eslintPlugin).not.toMatch(/\bwritesIn\b|\bmemberWrites\b/);
  });
});

describe('UI gate verdict', () => {
  const at = { origins: [] };
  it('passes only what it shows to be tokens', () => {
    expect(values.verdict([{ text: 'var(--a)', ...at }], 'color')).toEqual([]);
    expect(values.verdict([{ none: true, ...at }], 'color')).toEqual([]);
    expect(values.verdict([{ runtime: 'string', ...at }], '--x')).toEqual([]);
  });

  it('rejects everything else', () => {
    const ids = (readings, prop) => values.verdict(readings, prop).map((p) => p.messageId);
    expect(ids([], 'color')).toEqual(['untracked']);
    expect(ids([{ text: '#f00', ...at }], 'color')).toEqual(['value']);
    expect(ids([{ text: 'x', ...at }], 'mystery-property')).toEqual(['value']);
    expect(ids([{ runtime: 'string', ...at }], 'color')).toEqual(['untracked']);
    expect(ids([{ runtime: 'number', text: '1px', ...at }], 'width')).toEqual(['untracked']);
    expect(ids([{ registered: 'packages/web/src/x.ts', ...at }], '--color-a')).toEqual([
      'untracked',
    ]);
    expect(ids([{ runtime: 'object', ...at }], null)).toEqual(['untracked']);
    expect(() => values.verdict([{ origins: [] }], 'color')).toThrow('has no kind');
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
  // A binding some use can change is read from its type (QA14 F1–F3).
  "const s = { color: 'var(--a)' }; (u as (x: object) => void)(s); export const a = <div style={s} />;",
  "const s: CSSProperties = { color: 'var(--a)' }; s.color = u as string;",
  'const s: CSSProperties = {}; Object.assign(s, { color: u as string });',
  'const s: CSSProperties = { color: u as string }; export { s };',
  'function mk(): CSSProperties { return u as CSSProperties; } export { mk };',
  // Expression kinds the reading does not follow are read from their (unknown) type.
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

// Every kind of write a program can make to a value after it is declared. Each starts from a
// token (which alone passes) and writes an unknown value: the reading must not drop the write,
// so the use reports (v3.11, P1 QA14: the reading reads only provable bindings).
const view = (value) => `export const a = <div style={{ color: ${value} }} />;`;
const WRITES = [
  `let c = 'var(--a)'; c = u as string; ${view('c')}`,
  `let c = 'var(--a)'; c += u as string; ${view('c')}`,
  `let c = 'var(--a)'; [c] = [u as string]; ${view('c')}`,
  `let w = 0; w++; export const a = <div style={{ width: w }} />;`,
  `const o = { c: 'var(--a)' }; o.c = u as string; ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; o['c'] = u as string; ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; ({ c: o.c } = { c: u as string }); ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; Object.assign(o, { c: u }); ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; Object.defineProperty(o, 'c', { value: u }); ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; Reflect.set(o, 'c', u); ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; (u as (x: object) => void)(o); ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; const p = o; p.c = u as string; ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; const get = () => o; get().c = u as string; ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; declare function K(p: { o: { c: string } }): null; export const k = <K o={o} />; ${view('o.c')}`,
  `const o = { c: 'var(--a)' }; for (const k of ['c'] as const) o[k] = u as string; ${view('o.c')}`,
  `const l = ['var(--a)']; l.push(u as string); declare const i: number; ${view('l[i]')}`,
  `const l = ['var(--a)']; l.splice(0, 1, u as string); ${view('l[0]')}`,
  `const l = ['var(--a)']; l[0] = u as string; ${view('l[0]')}`,
  `const s: CSSProperties = { color: 'var(--a)' }; s.color = u as string; export const a = <div style={s} />;`,
  `class K { static c = 'var(--a)'; } K.c = u as string; ${view('K.c')}`,
  `function f(c = 'var(--a)') { return <div style={{ color: c }} />; } export const a = f(u as string);`,
  `import { useState } from 'react'; export function A() { const [c, setC] = useState('var(--a)'); const set = setC; set(u as string); return <div style={{ color: c }} />; }`,
  `import { useState } from 'react'; declare function K(p: { on: (v: string) => void }): null; export function A() { const [c, setC] = useState('var(--a)'); return <><K on={setC} /><div style={{ color: c }} /></>; }`,
];

describe('UI gate reading keeps every write', () => {
  it.each(WRITES)(
    '%s',
    (code) => {
      const messages = lint(HEAD + code);
      expect(messages.filter((m) => m.fatal)).toEqual([]);
      expect(messages.map((m) => m.ruleId)).toContain('ui/inline-style-keys');
    },
    30_000,
  );

  // The baseline of the table: the same token, never written again, passes.
  it('passes the token when nothing writes it', () => {
    expect(lint(HEAD + `const o = { c: 'var(--a)' }; ${view('o.c')}`)).toEqual([]);
  });
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
