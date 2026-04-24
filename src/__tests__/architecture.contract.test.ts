/**
 * architecture.contract — Layer boundary guard
 *
 * Enforces the project's unidirectional dependency rules:
 *   UI (screens/components) → Application (services/facade) → Domain (game-engine)
 *   UI → Application → Infrastructure (services/infra, services/transport)
 *
 * Forbidden directions:
 *   - services/ → screens/  (infra must not know about UI)
 *   - game-engine → @/ or src/ client code  (domain is leaf)
 *   - screens/ → services/ with runtime (non-type) imports, except allowed enums
 */

const fs = require('node:fs');
const path = require('node:path');

// ─── Shared file walker ─────────────────────────────────────────────────────

function getAllProductionFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['__tests__', '__mocks__', 'node_modules'].includes(entry.name)) continue;
      results.push(...getAllProductionFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.') &&
      !entry.name.includes('.stories.')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const screensDir = path.join(process.cwd(), 'src', 'screens');
const servicesDir = path.join(process.cwd(), 'src', 'services');
const gameEngineDir = path.join(process.cwd(), 'packages', 'game-engine', 'src');

const screensFiles = getAllProductionFiles(screensDir);
const servicesFiles = getAllProductionFiles(servicesDir);
const gameEngineFiles = getAllProductionFiles(gameEngineDir);

// ─── Rule 1: services/ must NOT import screens/ ─────────────────────────────

describe('Layer boundary: services → screens (forbidden)', () => {
  it('should find services files to check', () => {
    expect(servicesFiles.length).toBeGreaterThan(0);
  });

  const screensImportPattern = /^\s*import\b.*from\s+['"].*screens\//m;

  it.each(servicesFiles)('%s must not import screens/', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(screensImportPattern);
    expect(match).toBeNull();
  });
});

// ─── Rule 2: game-engine must NOT import client code ─────────────────────────

describe('Layer boundary: game-engine → client (forbidden)', () => {
  it('should find game-engine files to check', () => {
    expect(gameEngineFiles.length).toBeGreaterThan(0);
  });

  // game-engine must not import from @/ alias or ../../../src/ relative paths
  // Only match actual import statements (not comments)
  const clientImportPatterns = [
    /^\s*import\b.*from\s+['"]@\//m,
    /^\s*import\b.*from\s+['"]\.\.\/(.*)\/src\/(screens|services|hooks|components|contexts|utils|config|navigation)\//m,
  ];

  it.each(gameEngineFiles)('%s must not import client code', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of clientImportPatterns) {
      const match = content.match(pattern);
      expect(match).toBeNull();
    }
  });
});

// ─── Rule 3: screens/ runtime imports from services/ are restricted ──────────

describe('Layer boundary: screens → services runtime imports (restricted)', () => {
  it('should find screens files to check', () => {
    expect(screensFiles.length).toBeGreaterThan(0);
  });

  // Allowed runtime imports from services/ (enums that must be runtime values)
  const allowedRuntimeImports = [
    'ConnectionStatus',
    'isAIChatReady',
    'BGM_TRACKS',
    'BGM_VOLUME',
    'fetchUserStats',
    'fetchUserProfile',
    'fetchUserUnlocks',
    'uploadShareImage',
  ];

  it.each(screensFiles)('%s runtime imports from services/ must be in allow-list', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      // Skip type-only imports
      if (/import\s+type\b/.test(line)) continue;
      // Skip non-import lines
      if (!/from\s+['"]@\/services\//.test(line)) continue;

      // Extract imported symbols
      const symbolMatch = line.match(/import\s+\{([^}]+)\}/);
      if (!symbolMatch) continue;

      const symbols = symbolMatch[1]
        .split(',')
        .map((s: string) => s.trim().replace(/\s+as\s+\w+/, ''));
      const disallowed = symbols.filter(
        (s: string) => s.length > 0 && !s.startsWith('type ') && !allowedRuntimeImports.includes(s),
      );

      expect(disallowed).toEqual([]);
    }
  });
});
