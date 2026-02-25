/**
 * Import Boundary Tests
 *
 * Ensures server-authority modules (resolvers) are not imported by UI code.
 * This is a static analysis test that validates the import structure.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const workspaceRoot = path.resolve(__dirname, '../../../../..');
const srcRoot = path.join(workspaceRoot, 'src');

/**
 * Recursively find all .ts/.tsx files in a directory
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and test directories
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
        findTsFiles(fullPath, files);
      }
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Check if a file imports from a forbidden path
 */
function checkForbiddenImports(filePath: string, forbiddenPatterns: RegExp[]): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match import statements
    if (/^\s*(import|export)\s/.test(line)) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(line)) {
          violations.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }
    }
  }

  return violations;
}

describe('Import Boundary Enforcement', () => {
  describe('UI components should not import server-authority resolvers', () => {
    // Forbidden import patterns
    const forbiddenPatterns = [
      /from\s+['"].*\/services\/night\/resolvers/,
      /from\s+['"]@\/services\/night\/resolvers/,
    ];

    // UI directories that should NOT import resolvers
    const uiDirs = ['components', 'screens', 'navigation', 'contexts', 'hooks'];

    for (const uiDir of uiDirs) {
      it(`src/${uiDir}/** should not import from services/night/resolvers`, () => {
        const dirPath = path.join(srcRoot, uiDir);
        const tsFiles = findTsFiles(dirPath);

        const allViolations: { file: string; violations: string[] }[] = [];

        for (const file of tsFiles) {
          const violations = checkForbiddenImports(file, forbiddenPatterns);
          if (violations.length > 0) {
            allViolations.push({
              file: path.relative(srcRoot, file),
              violations,
            });
          }
        }

        if (allViolations.length > 0) {
          const report = allViolations
            .map((v) => `${v.file}:\n  ${v.violations.join('\n  ')}`)
            .join('\n\n');
          fail(`Found forbidden imports from server-authority resolvers:\n\n${report}`);
        }
      });
    }
  });

  describe('Resolver imports should only come from services/night/', () => {
    // Source of truth is now in @werewolf/game-engine
    const gameEngineResolversDir = path.join(workspaceRoot, 'packages/game-engine/src/resolvers');

    it('resolvers/index.ts should exist and export RESOLVERS', () => {
      const resolversIndexPath = path.join(gameEngineResolversDir, 'index.ts');
      expect(fs.existsSync(resolversIndexPath)).toBe(true);

      const content = fs.readFileSync(resolversIndexPath, 'utf-8');
      expect(content).toContain('RESOLVERS');
    });

    it('resolvers should not import from UI directories', () => {
      const tsFiles = findTsFiles(gameEngineResolversDir);

      const forbiddenPatterns = [
        /from\s+['"].*\/components\//,
        /from\s+['"].*\/screens\//,
        /from\s+['"].*\/navigation\//,
        /from\s+['"].*\/contexts\//,
        /from\s+['"].*\/hooks\//,
        /from\s+['"]@\/components\//,
        /from\s+['"]@\/screens\//,
        /from\s+['"]@\/navigation\//,
        /from\s+['"]@\/contexts\//,
        /from\s+['"]@\/hooks\//,
      ];

      const allViolations: { file: string; violations: string[] }[] = [];

      for (const file of tsFiles) {
        const violations = checkForbiddenImports(file, forbiddenPatterns);
        if (violations.length > 0) {
          allViolations.push({
            file: path.relative(srcRoot, file),
            violations,
          });
        }
      }

      if (allViolations.length > 0) {
        const report = allViolations
          .map((v) => `${v.file}:\n  ${v.violations.join('\n  ')}`)
          .join('\n\n');
        fail(`Resolvers should not import from UI directories:\n\n${report}`);
      }
    });
  });

  describe('Public API exports validation', () => {
    // Source of truth is now in @werewolf/game-engine
    const gameEngineSpecRoot = path.join(
      workspaceRoot,
      'packages/game-engine/src/models/roles/spec',
    );

    it('spec/index.ts should NOT export resolvers', () => {
      const specIndexPath = path.join(gameEngineSpecRoot, 'index.ts');
      expect(fs.existsSync(specIndexPath)).toBe(true);

      const content = fs.readFileSync(specIndexPath, 'utf-8');
      // Check for actual exports of resolvers, not just mentions in comments
      expect(content).not.toMatch(/export\s+\*\s+from\s+['"].*resolvers/);
      expect(content).not.toMatch(/export\s+{.*RESOLVERS.*}/);
    });

    it('spec/index.ts should export types, schemas, specs, and plan', () => {
      const specIndexPath = path.join(gameEngineSpecRoot, 'index.ts');
      const content = fs.readFileSync(specIndexPath, 'utf-8');

      expect(content).toContain('./types');
      expect(content).toContain('./schemas');
      expect(content).toContain('./specs');
      expect(content).toContain('./plan');
    });
  });
});
