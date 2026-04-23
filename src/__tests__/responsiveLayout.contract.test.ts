/**
 * Contract test: Responsive layout anti-patterns
 *
 * Scans production style files for common layout issues that cause
 * content overflow or truncation on small screens:
 *
 * 1. ScrollView flexGrow: 0 — prevents ScrollView from expanding to fill
 *    available space, causing content to be un-scrollable. Should use flex: 1.
 * 2. Bottom sheet/modal paddingBottom too small — must be ≥ spacing.xlarge
 *    to clear Home Indicator on notched devices.
 *
 * Uses the same file walker pattern as noHardcodedStyleValues.contract.test.ts.
 */

const fs = require('node:fs');
const path = require('node:path');

// ─── File walker ────────────────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  'RoleRevealEffects',
  'AIChatBubble',
  'avatarFrames',
  '__tests__',
  '__mocks__',
  'node_modules',
]);

const EXCLUDED_FILES = new Set(['ErrorBoundary.tsx']);

function getProductionFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      results.push(...getProductionFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.') &&
      !entry.name.includes('.stories.') &&
      !EXCLUDED_FILES.has(entry.name)
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Anti-pattern checks ────────────────────────────────────────────────────

/**
 * Detect `flexGrow: 0` on ScrollView styles.
 *
 * Pattern: a style object assigned to a ScrollView's `style` prop uses
 * `flexGrow: 0`, which prevents the ScrollView from expanding.
 * This is almost always a bug — should be `flex: 1` or omitted.
 */
const FLEX_GROW_ZERO_RE = /\bflexGrow\s*:\s*0\b/;

/**
 * Detect bottom-anchored containers with small paddingBottom.
 *
 * Looks for paddingBottom with a raw numeric literal < 32 in style objects
 * near keywords like 'content', 'sheet', 'panel', 'bottom'.
 * This catches bottom modals/sheets that don't account for Home Indicator.
 */
const SMALL_PADDING_BOTTOM_RE = /\bpaddingBottom\s*:\s*([1-9]|[12]\d|3[01])\b/;

interface Violation {
  line: number;
  rule: string;
  text: string;
}

function findViolations(content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Strip trailing comment
    const commentIdx = line.indexOf('//');
    const codePart = commentIdx !== -1 ? line.slice(0, commentIdx) : line;

    // Rule 1: flexGrow: 0
    if (FLEX_GROW_ZERO_RE.test(codePart)) {
      violations.push({
        line: i + 1,
        rule: 'no-flexGrow-zero',
        text: lines[i].trim(),
      });
    }

    // Rule 2: Small paddingBottom in bottom container contexts
    // Only flag if the file has bottom-sheet/modal patterns
    if (SMALL_PADDING_BOTTOM_RE.test(codePart)) {
      // Look for context: is this near a bottom sheet/modal style?
      const contextWindow = lines
        .slice(Math.max(0, i - 10), i + 1)
        .join('\n')
        .toLowerCase();
      const isBottomContext =
        contextWindow.includes('sheet') ||
        contextWindow.includes('bottom') ||
        contextWindow.includes('panel') ||
        contextWindow.includes('modal');
      if (isBottomContext) {
        violations.push({
          line: i + 1,
          rule: 'min-paddingBottom-for-safe-area',
          text: lines[i].trim(),
        });
      }
    }
  }

  return violations;
}

// ─── Known violations (ratchet: only remove, never add) ────────────────────
//
// Key: relative file path → array of allowed (rule, line) pairs.
// flexGrow: 0 on flex-grid items is intentional (prevents grow beyond basis).
// ShareReviewModal scrollView uses flexGrow:0 to shrink-wrap a short seat list.
const KNOWN_VIOLATIONS: Record<string, { rule: string; line: number }[]> = {
  'src/components/SettingsSheet/SettingsOptionGroup.tsx': [{ rule: 'no-flexGrow-zero', line: 128 }],
  'src/components/SettingsSheet/SettingsSheet.tsx': [{ rule: 'no-flexGrow-zero', line: 308 }],
};

// ─── Test ───────────────────────────────────────────────────────────────────

describe('Responsive layout anti-patterns', () => {
  const screensDir = path.join(process.cwd(), 'src', 'screens');
  const componentsDir = path.join(process.cwd(), 'src', 'components');

  const files = [...getProductionFiles(screensDir), ...getProductionFiles(componentsDir)];

  it('should find production files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('should not contain flexGrow: 0 or unsafe small paddingBottom in bottom containers', () => {
    const allViolations: { file: string; violations: Violation[] }[] = [];

    for (const fullPath of files) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const violations = findViolations(content);
      if (violations.length > 0) {
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        const allowed = KNOWN_VIOLATIONS[relativePath] ?? [];
        const newViolations = violations.filter(
          (v) => !allowed.some((a) => a.rule === v.rule && a.line === v.line),
        );
        if (newViolations.length > 0) {
          allViolations.push({ file: relativePath, violations: newViolations });
        }
      }
    }

    if (allViolations.length > 0) {
      const details = allViolations
        .map(
          ({ file, violations }) =>
            `${file}:\n` + violations.map((v) => `  L${v.line} [${v.rule}]: ${v.text}`).join('\n'),
        )
        .join('\n\n');
      throw new Error(
        `Responsive layout anti-patterns detected:\n\n${details}\n\n` +
          `Fixes:\n` +
          `  flexGrow: 0 → flex: 1 (let ScrollView expand)\n` +
          `  paddingBottom < 32 in bottom containers → use spacing.xlarge or larger (Home Indicator)`,
      );
    }
  });
});
