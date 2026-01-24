/**
 * V2 Boundary Guard Tests
 *
 * 确保 v2 harness 不会 import legacy 代码
 */

import * as fs from 'fs';
import * as path from 'path';

const V2_BOARDS_DIR = path.resolve(__dirname, '.');
const V2_ROOT_DIR = path.resolve(__dirname, '../..');

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkForbiddenImports(
  filePath: string,
  forbiddenPatterns: RegExp[],
): { file: string; violations: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations: string[] = [];
  for (const pattern of forbiddenPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push(...matches);
    }
  }
  return { file: filePath, violations };
}

describe('V2 Boundary Guard', () => {
  describe('v2 boards harness 禁止 import legacy', () => {
    it('hostGameFactory.v2.ts 不应 import legacy 代码', () => {
      const harnessPath = path.join(V2_BOARDS_DIR, 'hostGameFactory.v2.ts');
      const content = fs.readFileSync(harnessPath, 'utf-8');

      const forbiddenPatterns = [
        /import.*from.*['"].*GameStateService['"]/g,
        /import.*from.*['"].*legacy['"]/g,
        /import.*from.*['"].*NightFlowController['"]/g,
        /firstSeat\s*\+\s*secondSeat\s*\*\s*100/g,
        /target\s*%\s*100/g,
        /Math\.floor\s*\(\s*target\s*\/\s*100\s*\)/g,
      ];

      const violations: string[] = [];
      for (const pattern of forbiddenPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          violations.push(...matches);
        }
      }

      expect(violations).toEqual([]);
    });

    it('v2/__tests__/boards 目录下所有文件不应 import legacy', () => {
      const files = getAllTsFiles(V2_BOARDS_DIR);

      const forbiddenPatterns = [
        /import\s+.*\s+from\s+['"].*GameStateService['"]/g,
        /import\s+.*\s+from\s+['"].*\/legacy\//g,
      ];

      const allViolations: Array<{ file: string; violations: string[] }> = [];

      for (const file of files) {
        if (file.includes('boundary.guard.test.ts')) continue;
        const result = checkForbiddenImports(file, forbiddenPatterns);
        if (result.violations.length > 0) {
          allViolations.push(result);
        }
      }

      if (allViolations.length > 0) {
        const errorMsg = allViolations
          .map((v) => `${v.file}:\n  ${v.violations.join('\n  ')}`)
          .join('\n\n');
        fail(`Legacy imports found in v2 boards:\n${errorMsg}`);
      }
    });
  });

  describe('v2 核心目录禁止 import legacy', () => {
    it('v2/handlers 不应 import legacy', () => {
      const handlersDir = path.join(V2_ROOT_DIR, 'handlers');
      if (!fs.existsSync(handlersDir)) {
        return;
      }
      const files = getAllTsFiles(handlersDir);
      const forbiddenPatterns = [/import\s+.*\s+from\s+['"].*\/legacy\//g];

      const allViolations: Array<{ file: string; violations: string[] }> = [];
      for (const file of files) {
        const result = checkForbiddenImports(file, forbiddenPatterns);
        if (result.violations.length > 0) {
          allViolations.push(result);
        }
      }
      expect(allViolations).toEqual([]);
    });

    it('v2/reducer 不应 import legacy', () => {
      const reducerDir = path.join(V2_ROOT_DIR, 'reducer');
      if (!fs.existsSync(reducerDir)) {
        return;
      }
      const files = getAllTsFiles(reducerDir);
      const forbiddenPatterns = [/import\s+.*\s+from\s+['"].*\/legacy\//g];

      const allViolations: Array<{ file: string; violations: string[] }> = [];
      for (const file of files) {
        const result = checkForbiddenImports(file, forbiddenPatterns);
        if (result.violations.length > 0) {
          allViolations.push(result);
        }
      }
      expect(allViolations).toEqual([]);
    });
  });
});
