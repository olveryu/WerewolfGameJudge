/**
 * Legacy Runtime=0 Gate Test (PR8)
 *
 * 确保运行时入口不再 import legacy 模块。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../..');

const LEGACY_IMPORT_PATTERNS = [
  // 任何形式的 GameStateService import（包括 type import）
  // 都应该被禁止，因为 LocalGameState 等类型应从 types/GameStateTypes 导入
  /^\s*import\s+.*GameStateService/,
];

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      files.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function hasLegacyImport(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const matches: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (LEGACY_IMPORT_PATTERNS.some((p) => p.test(line))) {
      matches.push(`L${i + 1}: ${line.trim()}`);
    }
  }
  return matches;
}

function isTestPath(filePath: string): boolean {
  return /__tests__|\.test\.|\.spec\.|\.stories\./.test(filePath) || /legacy\//.test(filePath);
}

function collectViolations(baseDir: string): { file: string; lines: string[] }[] {
  const violations: { file: string; lines: string[] }[] = [];
  const files = collectTsFiles(baseDir).filter((f) => !isTestPath(f));

  for (const file of files) {
    const matches = hasLegacyImport(file);
    if (matches.length > 0) {
      violations.push({ file: path.relative(WORKSPACE_ROOT, file), lines: matches });
    }
  }
  return violations;
}

describe('Legacy Runtime=0 Gate', () => {
  test('src/hooks should not import legacy GameStateService', () => {
    const violations = collectViolations(path.join(WORKSPACE_ROOT, 'src/hooks'));
    expect(violations).toEqual([]);
  });

  test('src/screens should not import legacy GameStateService', () => {
    const violations = collectViolations(path.join(WORKSPACE_ROOT, 'src/screens'));
    expect(violations).toEqual([]);
  });

  test('src/contexts should not import legacy GameStateService', () => {
    const violations = collectViolations(path.join(WORKSPACE_ROOT, 'src/contexts'));
    expect(violations).toEqual([]);
  });

  test('src/services/v2 should not import from src/services/legacy', () => {
    const v2Dir = path.join(WORKSPACE_ROOT, 'src/services/v2');
    const files = collectTsFiles(v2Dir);

    const violations: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/from\s+['"].*\/legacy\//.test(content)) {
        violations.push(path.relative(WORKSPACE_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });

  test('App.tsx should not import legacy GameStateService', () => {
    const appPath = path.join(WORKSPACE_ROOT, 'App.tsx');
    if (!fs.existsSync(appPath)) return;

    const matches = hasLegacyImport(appPath);
    expect(matches).toEqual([]);
  });
});
