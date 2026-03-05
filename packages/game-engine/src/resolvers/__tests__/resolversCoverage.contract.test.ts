/**
 * Resolver Coverage Contract Test
 *
 * 确保 resolvers/ 目录下每个 resolver 源文件都有对应的 *.resolver.test.ts。
 * 新增 resolver 源文件但忘记写测试 → 此测试失败。
 *
 * 策略：扫描源文件而非 RESOLVERS registry key，避免 key 名称
 * 与文件名不匹配（如 seerCheck → seer.ts）导致的大量误报。
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Resolver test coverage contract', () => {
  const resolverDir = path.resolve(__dirname, '..');
  const testDir = path.resolve(__dirname);

  /** Infrastructure / utility files that are NOT individual resolvers */
  const UTILITY_FILES = new Set(['index.ts', 'types.ts', 'shared.ts', 'constraintValidator.ts']);

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
