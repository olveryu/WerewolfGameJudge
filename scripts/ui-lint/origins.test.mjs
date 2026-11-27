/**
 * A value written elsewhere names where (P1 QA8 FIX-FIRST-2): the report carries `Written at
 * file:line`, which the gate puts in the fingerprint, so changing that value is new debt.
 */
import fs from 'node:fs';
import path from 'node:path';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, expect, it } from 'vitest';

import uiLint from './eslint-plugin.mjs';
import { originsOf, withOrigins } from './values.mjs';

const FIXTURES = path.join(import.meta.dirname, '__fixtures__');
const PROBE = path.join(FIXTURES, 'origins-probe.tsx');
afterAll(() => fs.rmSync(PROBE, { force: true }));

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
    fs.writeFileSync(
      PROBE,
      "import { badCard } from './styles';\nexport const a = <div style={badCard} />;\n",
    );
    const eslint = new ESLint({
      cwd: FIXTURES,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.tsx'],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: { project: './tsconfig.json', tsconfigRootDir: FIXTURES },
          },
          plugins: { ui: uiLint },
          rules: { 'ui/inline-style-keys': 'error' },
        },
      ],
    });
    const [result] = await eslint.lintFiles([PROBE]);
    expect(result.messages.map((m) => m.messageId)).toEqual(['value']);
    const origins = result.messages.flatMap((message) => originsOf(message.message));
    const styles = fs.readFileSync(path.join(FIXTURES, 'styles.ts'), 'utf8').split('\n');
    const line = styles.findIndex((text) => text.includes('badCard')) + 1;
    expect(origins).toEqual([{ file: 'scripts/ui-lint/__fixtures__/styles.ts', line }]);
  }, 60_000);
});
