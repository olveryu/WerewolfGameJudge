/**
 * Contract test: Enforce design token usage in style files
 *
 * Scans production .ts/.tsx files in src/screens/ and src/components/ for
 * hardcoded style values that should reference design tokens from
 * src/theme/tokens.ts or theme colors.
 *
 * Checked patterns:
 *   - fontSize: <number>          → use typography.*
 *   - padding/margin: <number≥2>  → use spacing.*
 *   - borderRadius: <number≥2>    → use borderRadius.*
 *   - fontWeight: '<digits>'      → use typography.weights.*
 *   - '#hex' color literals       → use colors.*
 *   - 'rgba(…)' / 'hsla(…)'      → use colors.*
 *
 * Exemptions (per screens.instructions.md):
 *   - RoleRevealEffects/ — animation constants
 *   - AIChatBubble/ — self-contained chat UI (Phase 3)
 *   - ErrorBoundary.tsx — fallback UI (Phase 1)
 *   - Emoji fontSize, statusDot 6×6, sub-pixel borderRadius (0/1)
 *
 * Uses a ratchet allowlist: KNOWN_VIOLATIONS records the exact violation count
 * per file. New violations fail; fixed violations also fail until the allowlist
 * is updated (can only decrease).
 */

const fs = require('node:fs');
const path = require('node:path');

// ─── File walker ────────────────────────────────────────────────────────────

/** Directories excluded entirely from scanning */
const EXCLUDED_DIRS = new Set([
  'RoleRevealEffects',
  'AIChatBubble',
  'avatarFrames',
  '__tests__',
  '__mocks__',
  'node_modules',
]);

/** Files excluded entirely from scanning */
const EXCLUDED_FILES = new Set(['ErrorBoundary.tsx', 'SkiaShaderWarmup.tsx']);

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

// ─── Violation patterns ─────────────────────────────────────────────────────

interface ViolationPattern {
  /** Human-readable rule name */
  name: string;
  /** Regex applied per line (after stripping trailing comments) */
  regex: RegExp;
}

const SPACING_PROPS = [
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
].join('|');

const PATTERNS: ViolationPattern[] = [
  // fontSize: <any numeric literal> → should use typography.*
  { name: 'fontSize', regex: /\bfontSize\s*:\s*\d+/ },

  // padding*/margin* with literal ≥ 2 → should use spacing.*
  // 0 = reset, 1 = hairline — allowed
  {
    name: 'padding/margin',
    regex: new RegExp(`\\b(${SPACING_PROPS})\\s*:\\s*([2-9]|\\d{2,})`),
  },

  // borderRadius* with literal ≥ 2 → should use borderRadius.*
  // 0 = none, 1 = sub-pixel for progress bars — allowed
  { name: 'borderRadius', regex: /\bborderRadius\w*\s*:\s*([2-9]|\d{2,})/ },

  // fontWeight: '<digits>' → should use typography.weights.*
  { name: 'fontWeight', regex: /\bfontWeight\s*:\s*['"][0-9]+['"]/ },

  // '#hex' color literal → should use theme colors
  { name: 'hex color', regex: /['"]#[0-9a-fA-F]{3,8}['"]/ },

  // 'rgb(…)' / 'rgba(…)' / 'hsl(…)' / 'hsla(…)' color function literals
  { name: 'color function', regex: /['"](rgba?|hsla?)\([^)]+\)['"]/ },
];

interface Violation {
  line: number;
  name: string;
  text: string;
}

function findViolations(content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip pure comment lines
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Strip trailing line comment before matching
    const commentIdx = line.indexOf('//');
    if (commentIdx !== -1) {
      line = line.slice(0, commentIdx);
    }

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({
          line: i + 1,
          name: pattern.name,
          text: lines[i].trim(),
        });
        // One violation per line is enough to flag it
        break;
      }
    }
  }

  return violations;
}

// ─── Known violations ratchet ───────────────────────────────────────────────
// Each entry: relative file path → exact number of current violations.
// As violations are fixed, decrease the count. Adding new violations fails CI.

const KNOWN_VIOLATIONS: Record<string, number> = {
  // Emoji fontSize: 28 for 🐺 logo — exempt per instructions
  'src/screens/HomeScreen/components/styles.ts': 1,

  // TODO: Phase 1 — fontSize: 14 → typography.secondary
  'src/screens/RoomScreen/components/SeatTile.tsx': 0,

  // TODO: Phase 1 — paddingBottom: 60 → spacing/layout token
  'src/screens/ConfigScreen/components/templatePicker.styles.ts': 1,

  // statusDot borderRadius: 3 — exempt per instructions (statusDot 6×6)
  'src/screens/SettingsScreen/components/styles.ts': 1,

  // TODO: Phase 1 — paddingVertical: 60 → spacing/layout token
  'src/components/LoadingScreen/LoadingScreen.tsx': 1,
};

// ─── Test ───────────────────────────────────────────────────────────────────

describe('No hardcoded style values', () => {
  const screensDir = path.join(process.cwd(), 'src', 'screens');
  const componentsDir = path.join(process.cwd(), 'src', 'components');

  const files = [...getProductionFiles(screensDir), ...getProductionFiles(componentsDir)];

  const testCases = files.map((f) => path.relative(process.cwd(), f).replace(/\\/g, '/'));

  it('should find production files to check', () => {
    expect(testCases.length).toBeGreaterThan(0);
  });

  it.each(testCases)('%s', (relativePath) => {
    const fullPath = path.join(process.cwd(), relativePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const violations = findViolations(content);
    const allowedCount = KNOWN_VIOLATIONS[relativePath] ?? 0;

    if (violations.length > allowedCount) {
      const details = violations.map((v) => `  L${v.line}: [${v.name}] ${v.text}`).join('\n');
      throw new Error(
        `New hardcoded style value(s) in ${relativePath}\n` +
          `Expected ≤ ${allowedCount}, found ${violations.length}:\n${details}\n\n` +
          `Use design tokens instead:\n` +
          `  fontSize → typography.*  |  padding/margin → spacing.*\n` +
          `  borderRadius → borderRadius.*  |  colors → theme colors\n` +
          `  fontWeight → typography.weights.*`,
      );
    }

    if (violations.length < allowedCount) {
      throw new Error(
        `Violations decreased in ${relativePath}: ${allowedCount} → ${violations.length}.\n` +
          `Update KNOWN_VIOLATIONS in noHardcodedStyleValues.contract.test.ts ` +
          `to tighten the ratchet.`,
      );
    }
  });
});
