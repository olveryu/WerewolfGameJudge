/**
 * A value written elsewhere names where (P1 QA8/QA9 FIX-FIRST-2): the report carries `Written at
 * file:line`, the gate puts those lines in the fingerprint, so changing that value is new debt.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { REPO_ROOT } from './bundle.mjs';
import { scriptKey } from './gate.mjs';
import { originsOf, withOrigins } from './values.mjs';

const FIXTURES = path.join(import.meta.dirname, '__fixtures__');
const PROBE = path.join(FIXTURES, 'origins-probe.tsx');
const TABLE = path.join(FIXTURES, 'origins-table.ts');
const relative = (file) => path.relative(REPO_ROOT, file).split(path.sep).join('/');
afterEach(() => {
  fs.rmSync(PROBE, { force: true });
  fs.rmSync(TABLE, { force: true });
});

// Each lint runs in a fresh process: typescript-eslint keeps the program of a project between
// runs in one process, so a rewritten table would be read stale.
const LINT = `
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import uiLint from ${JSON.stringify(path.join(import.meta.dirname, 'eslint-plugin.mjs'))};
const eslint = new ESLint({
  cwd: ${JSON.stringify(FIXTURES)},
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: ${JSON.stringify(FIXTURES)} },
    },
    plugins: { ui: uiLint },
    rules: { 'ui/inline-style-keys': 'error' },
  }],
});
const [result] = await eslint.lintFiles([${JSON.stringify(PROBE)}]);
process.stdout.write(JSON.stringify(result.messages));
`;

/** Lints the probe against the table and returns the gate's fingerprints for it. */
function keys(table, probe) {
  fs.writeFileSync(TABLE, table);
  fs.writeFileSync(PROBE, probe);
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', LINT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(run.stderr);
  const lines = probe.split('\n');
  return JSON.parse(run.stdout).map((message) => ({
    messageId: message.messageId,
    origins: originsOf(message.message),
    key: scriptKey(REPO_ROOT, relative(PROBE), lines, message),
  }));
}

describe('value origins', () => {
  it('round-trips through the message', () => {
    const message = withOrigins('`#f00` is not allowed.', ['a/b.ts:3', 'a/b.ts:3', 'c.ts:9']);
    expect(message).toBe('`#f00` is not allowed. Written at a/b.ts:3, c.ts:9.');
    expect(originsOf(message)).toEqual([
      { file: 'a/b.ts', line: 3 },
      { file: 'c.ts', line: 9 },
    ]);
    expect(originsOf('`#f00` is not allowed.')).toEqual([]);
  });

  it('names the line of another file that writes the value', async () => {
    const [report] = keys(
      "export const card = { color: '#f00' };\n",
      "import { card } from './origins-table';\nexport const a = <div style={card} />;\n",
    );
    expect(report.origins).toEqual([{ file: relative(TABLE), line: 1 }]);
  }, 60_000);

  // Changing a value written elsewhere changes the fingerprint, however it is read: a table
  // entry, a member of a mapped element, a literal type of a prop, an enum member.
  it.each([
    [
      'a table entry',
      (v) => `export const C = { chip: '${v}' };\n`,
      "import { C } from './origins-table';\nexport const a = <div style={{ color: C.chip }} />;\n",
    ],
    [
      'an element of a mapped list',
      (v) => `export const CHIPS = [{ c: 'var(--a)' }, { c: '${v}' }];\n`,
      "import { CHIPS } from './origins-table';\nexport const a = CHIPS.map((x) => <div style={{ color: x.c }} />);\n",
    ],
    [
      'a literal type',
      (v) => `export interface P { tone: '${v}' }\n`,
      "import type { P } from './origins-table';\nexport const A = ({ tone }: P) => <div style={{ color: tone }} />;\n",
    ],
    [
      'an enum member',
      (v) => `export enum Gap { Wide = ${v} }\n`,
      "import { Gap } from './origins-table';\nexport const a = <div style={{ gap: Gap.Wide }} />;\n",
    ],
  ])(
    'changes with %s',
    async (_name, table, probe) => {
      const isEnum = table('x').includes('enum');
      const before = keys(table(isEnum ? '12' : '#f00'), probe);
      const after = keys(table(isEnum ? '14' : '#0f0'), probe);
      expect(before.map((r) => r.messageId)).toEqual(['value']);
      expect(after.map((r) => r.messageId)).toEqual(['value']);
      expect(after[0].key).not.toBe(before[0].key);
    },
    120_000,
  );
});
