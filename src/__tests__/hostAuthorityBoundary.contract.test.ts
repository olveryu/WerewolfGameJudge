/**
 * Contract test: Host authority import boundary
 *
 * Ensures that hooks and screens DO NOT import Host-only business logic modules:
 * - services/engine/reducer (state transitions)
 * - services/engine/handlers (action handlers)
 * - services/night/resolvers (night action resolvers)
 * - NightFlowController (night flow state machine)
 * - DeathCalculator (death calculation)
 *
 * UI/hooks should only interact via GameFacade or transport layer.
 */

describe('Host authority import boundary', () => {
   
  const fs = require('node:fs');
   
  const path = require('node:path');

  /**
   * Recursively get all production files under a directory
   */
  function getAllProductionFiles(dir: string): string[] {
    const results: string[] = [];

    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip test directories
        if (
          entry.name === '__tests__' ||
          entry.name === 'node_modules' ||
          entry.name === '__mocks__'
        ) {
          continue;
        }
        results.push(...getAllProductionFiles(fullPath));
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.stories.')
      ) {
        results.push(fullPath);
      }
    }

    return results;
  }

  // Host-only module patterns (both absolute and relative paths)
  // These modules contain Host-only business logic and MUST NOT be imported by hooks/screens
  const forbiddenPatterns = [
    // Absolute path patterns
    /from\s+['"].*services\/engine\/reducer/,
    /from\s+['"].*services\/engine\/handlers/,
    /from\s+['"].*services\/engine\/DeathCalculator/,
    /from\s+['"].*services\/engine\/resolveWolfVotes/,
    /from\s+['"].*services\/night\/resolvers/,
    // Relative path patterns (for imports like ../../services/engine/reducer)
    // eslint-disable-next-line no-useless-escape
    /from\s+['"][.\/]+services\/engine\/reducer/,
    // eslint-disable-next-line no-useless-escape
    /from\s+['"][.\/]+services\/engine\/handlers/,
    // eslint-disable-next-line no-useless-escape
    /from\s+['"][.\/]+services\/engine\/DeathCalculator/,
    // eslint-disable-next-line no-useless-escape
    /from\s+['"][.\/]+services\/engine\/resolveWolfVotes/,
    // eslint-disable-next-line no-useless-escape
    /from\s+['"][.\/]+services\/night\/resolvers/,
    // Direct imports from gameReducer
    /from\s+['"].*gameReducer/,
    // Direct imports from resolvers index
    /from\s+['"].*resolvers.*['"]\s*;?\s*$/m,
  ];

  // Directories to check (UI layer - should not import Host-only modules)
  const hooksDir = path.join(process.cwd(), 'src', 'hooks');
  const screensDir = path.join(process.cwd(), 'src', 'screens');

  const hooksFiles = getAllProductionFiles(hooksDir);
  const screensFiles = getAllProductionFiles(screensDir);
  const allFilesToCheck = [...hooksFiles, ...screensFiles];

  // Ensure we found files to check
  it('should find hooks and screens files to check', () => {
    expect(allFilesToCheck.length).toBeGreaterThan(0);
  });

  it.each(allFilesToCheck)('should not import Host-only modules in %s', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const pattern of forbiddenPatterns) {
      const match = content.match(pattern);
      if (match) {
        fail(
          `File ${filePath} imports Host-only module: "${match[0]}"\n` +
            'Hooks and screens should not import reducer, handlers, resolvers, DeathCalculator, or resolveWolfVotes.\n' +
            'Use GameFacade or transport layer instead.',
        );
      }
    }
  });
});
