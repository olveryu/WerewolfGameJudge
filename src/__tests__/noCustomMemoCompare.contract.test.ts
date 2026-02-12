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
  const fs = require('node:fs');
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

      // Strategy: detect any non-comment reference to `arePropsEqual`,
      // OR the closing pattern `, <identifier>)` / `, <identifier>,`
      // right after a memo() call's function body.
      //
      // Pattern 1: any `arePropsEqual` usage (covers all forms)
      // Pattern 2: `}, <identifier>);` at end of memo — catches any custom comparator name
      //
      // Strip comments first to avoid false positives from JSDoc/inline comments.
      const stripped = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
        .replace(/\/\/.*/g, ''); // line comments

      const violations: string[] = [];

      // Check for arePropsEqual declarations or references
      if (/\barePropsEqual\b/.test(stripped)) {
        violations.push('Contains arePropsEqual');
      }

      // Check for memo(Component, comparator) — second arg on same line as memo(
      const memoWithSecondArg = /\bmemo\s*(?:<[^>]+>)?\s*\(\s*\w+\s*,/g;
      const memoMatches = stripped.match(memoWithSecondArg);
      if (memoMatches) {
        violations.push(...memoMatches);
      }

      if (violations.length > 0) {
        throw new Error(
          `Found custom memo comparator in ${path.relative(process.cwd(), filePath)}:\n` +
            `  ${violations.join('\n  ')}\n\n` +
            `Use default memo() instead. Custom arePropsEqual is error-prone ` +
            `(can skip callback comparison → stale closure bugs).`,
        );
      }
    },
  );
});
