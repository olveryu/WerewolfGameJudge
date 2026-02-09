/**
 * Contract test: Forbid custom arePropsEqual in React.memo()
 *
 * Custom comparators in memo() are error-prone — they can skip callback
 * comparisons, leading to stale closure bugs. Use default memo() instead.
 *
 * Background: A custom arePropsEqual that excluded onPress caused
 * ActionButton to keep a stale click handler, making wolf empty-knife
 * votes overwrite the wrong player's vote.
 *
 * Scan scope: all .tsx files in src, excluding tests.
 */

describe('No custom React.memo comparator', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path');

  function getAllComponentFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === '__tests__' ||
          entry.name === 'node_modules' ||
          entry.name === '__mocks__'
        ) {
          continue;
        }
        results.push(...getAllComponentFiles(fullPath));
      } else if (
        entry.name.endsWith('.tsx') &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.stories.')
      ) {
        results.push(fullPath);
      }
    }

    return results;
  }

  const srcDir = path.join(process.cwd(), 'src');
  const allComponentFiles = getAllComponentFiles(srcDir);

  it('should find component files to check', () => {
    expect(allComponentFiles.length).toBeGreaterThan(0);
  });

  it.each(allComponentFiles)(
    'should not use memo() with custom comparator in %s',
    (filePath: string) => {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Match: memo(Component, <anything>) — any second argument to memo()
      // Catches both named comparators and inline arrows: memo(X, fn) / memo(X, (a,b)=>...)
      // Allows: memo(Component) — no second argument
      const customMemoPattern = /\bmemo\s*\(\s*\w+\s*,/g;
      const matches = content.match(customMemoPattern);

      if (matches) {
        fail(
          `Found custom memo comparator in ${path.relative(process.cwd(), filePath)}:\n` +
            `  ${matches.join('\n  ')}\n\n` +
            `Use default memo() instead. Custom arePropsEqual is error-prone ` +
            `(can skip callback comparison → stale closure bugs).`,
        );
      }
    },
  );
});
