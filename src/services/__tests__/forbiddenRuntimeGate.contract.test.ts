/**
 * Forbidden runtime import gate.
 *
 * Ensures runtime entry points do not import removed local state services.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

const FORBIDDEN_IMPORT_PATTERNS = [
  // Any form of GameStateService import (including type imports)
  // is forbidden, because UI state types should be imported from hooks/adapters/werewolfStateTypes
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

function hasForbiddenImport(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const matches: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (FORBIDDEN_IMPORT_PATTERNS.some((p) => p.test(line))) {
      matches.push(`L${i + 1}: ${line.trim()}`);
    }
  }
  return matches;
}

function isTestPath(filePath: string): boolean {
  return /__tests__|\.test\.|\.spec\.|\.stories\./.test(filePath);
}

function collectViolations(baseDir: string): { file: string; lines: string[] }[] {
  const violations: { file: string; lines: string[] }[] = [];
  const files = collectTsFiles(baseDir).filter((f) => !isTestPath(f));

  for (const file of files) {
    const matches = hasForbiddenImport(file);
    if (matches.length > 0) {
      violations.push({ file: path.relative(WORKSPACE_ROOT, file), lines: matches });
    }
  }
  return violations;
}

describe('Forbidden runtime import gate', () => {
  test('src/hooks should not import removed GameStateService', () => {
    const violations = collectViolations(path.join(WORKSPACE_ROOT, 'src/hooks'));
    expect(violations).toEqual([]);
  });

  test('src/screens should not import removed GameStateService', () => {
    const violations = collectViolations(path.join(WORKSPACE_ROOT, 'src/screens'));
    expect(violations).toEqual([]);
  });

  test('src/contexts should not import removed GameStateService', () => {
    const violations = collectViolations(path.join(WORKSPACE_ROOT, 'src/contexts'));
    expect(violations).toEqual([]);
  });

  test('App.tsx should not import removed GameStateService', () => {
    const appPath = path.join(WORKSPACE_ROOT, 'App.tsx');
    if (!fs.existsSync(appPath)) return;

    const matches = hasForbiddenImport(appPath);
    expect(matches).toEqual([]);
  });
});
