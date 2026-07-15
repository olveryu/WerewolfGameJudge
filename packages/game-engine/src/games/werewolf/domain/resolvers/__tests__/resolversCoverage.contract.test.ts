/**
 * Resolver Coverage Contract Test
 *
 * Ensures every resolver source file under resolvers/ has a corresponding *.resolver.test.ts.
 * Adding a new resolver source file but forgetting the test -> this test fails.
 *
 * Strategy: scan source files instead of RESOLVERS registry keys, to avoid mass false
 * positives when key names do not match file names (e.g. seerCheck -> seer.ts).
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Resolver test coverage contract', () => {
  const resolverDir = path.resolve(__dirname, '..');
  const testDir = path.resolve(__dirname);

  /** Infrastructure / utility files that are NOT individual resolvers */
  const UTILITY_FILES = new Set([
    'index.ts',
    'types.ts',
    'shared.ts',
    'constraintValidator.ts',
    'genericResolver.ts',
  ]);

  // Source: resolvers/*.ts (exclude utility files)
  const sourceFiles = fs
    .readdirSync(resolverDir)
    .filter((f) => f.endsWith('.ts') && !UTILITY_FILES.has(f));
  const sourceNames = new Set(sourceFiles.map((f) => f.replace('.ts', '')));

  // Tests: __tests__/*.resolver.test.ts
  const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith('.resolver.test.ts'));
  const testedResolvers = new Set(testFiles.map((f) => f.replace('.resolver.test.ts', '')));

  it('every resolver source file should have a corresponding test file', () => {
    const missing = [...sourceNames].filter((name) => !testedResolvers.has(name));
    expect(missing).toEqual([]);
  });

  it('resolver source directory should not be empty', () => {
    expect(sourceNames.size).toBeGreaterThan(0);
  });
});
