/**
 * Contract test: Ensure production code does not contain console calls
 *
 * Production files should not contain console.log/warn/error, use structured logger instead.
 * Scan scope: all .ts and .tsx files in src, excluding tests and stories.
 */

describe('No console.* in production code', () => {
   
  const fs = require('node:fs');
   
  const path = require('node:path');

  /**
   * Recursively get all production files under a directory
   */
  function getAllProductionFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip test directories and node_modules
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

  const srcDir = path.join(process.cwd(), 'src');
  const allProductionFiles = getAllProductionFiles(srcDir);

  // Ensure we found files to check
  it('should find production files to check', () => {
    expect(allProductionFiles.length).toBeGreaterThan(0);
  });

  it.each(allProductionFiles)('should not contain console.* in %s', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Should NOT contain console.log, console.warn, console.error, etc.
    expect(content).not.toMatch(/console\.(log|warn|error|info|debug)\s*\(/);
  });
});

describe('No Math.random in speakOrder logic', () => {
   
  const fs = require('node:fs');
   
  const path = require('node:path');

  it('should not use Math.random in useRoomHostDialogs.ts', () => {
    const fullPath = path.join(process.cwd(), 'src/screens/RoomScreen/useRoomHostDialogs.ts');
    const content = fs.readFileSync(fullPath, 'utf-8');

    expect(content).not.toMatch(/Math\.random\s*\(\s*\)/);
  });
});
