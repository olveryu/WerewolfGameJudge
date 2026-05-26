/**
 * Night-1 Boards Coverage Contract Test
 *
 * Gate test: enforces that all 10 12-player boards have integration test coverage.
 *
 * A. Enforce that all 10 boards have test files
 * B. Prevent "empty shell / deaths-only" tests
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { NIGHT_STEPS } from '@werewolf/game-engine/models/roles/spec/nightSteps';

// =============================================================================
// Authoritative list: 10 12-player boards (from PRESET_TEMPLATES)
// =============================================================================

const REQUIRED_12P_TEMPLATES = [
  '预女猎白',
  '狼美守卫',
  '狼王守卫',
  '石像鬼守墓人',
  '噩梦之影守卫',
  '血月猎魔',
  '狼王摄梦人',
  '狼王魔术师',
  '机械狼人通灵师',
  '恶灵骑士',
  '纯白夜影',
  '灯影预言家',
  '永序之轮',
] as const;

// =============================================================================
// Board name -> test file keyword mapping
// =============================================================================

/**
 * The test file for each board must contain one of these keywords.
 * Used to match the `TEMPLATE_NAME = '...'` statement.
 */
const TEMPLATE_TO_TEST_PATTERN: Record<string, RegExp> = {
  预女猎白: /TEMPLATE_NAME\s*=\s*['"]预女猎白['"]/,
  狼美守卫: /TEMPLATE_NAME\s*=\s*['"]狼美守卫['"]/,
  狼王守卫: /TEMPLATE_NAME\s*=\s*['"]狼王守卫['"]/,
  石像鬼守墓人: /TEMPLATE_NAME\s*=\s*['"]石像鬼守墓人['"]/,
  噩梦之影守卫: /TEMPLATE_NAME\s*=\s*['"噩梦之影守卫'"]/,
  血月猎魔: /TEMPLATE_NAME\s*=\s*['"]血月猎魔['"]/,
  狼王摄梦人: /TEMPLATE_NAME\s*=\s*['"]狼王摄梦人['"]/,
  狼王魔术师: /TEMPLATE_NAME\s*=\s*['"]狼王魔术师['"]/,
  机械狼人通灵师: /TEMPLATE_NAME\s*=\s*['"机械狼人通灵师'"]/,
  恶灵骑士: /TEMPLATE_NAME\s*=\s*['"]恶灵骑士['"]/,
  纯白夜影: /TEMPLATE_NAME\s*=\s*['"]纯白夜影['"]/,
  灯影预言家: /TEMPLATE_NAME\s*=\s*['"]灯影预言家['"]/,
  永序之轮: /TEMPLATE_NAME\s*=\s*['"]永序之轮['"]/,
};

// =============================================================================
// Theme field assertion keywords (must contain at least one)
// =============================================================================

const REQUIRED_ASSERTION_PATTERNS = [
  /\.currentNightResults\??\./,
  /\.seerReveal/,
  /\.mirrorSeerReveal/,
  /\.psychicReveal/,
  /\.gargoyleReveal/,
  /\.wolfRobotReveal/,
  /\.pureWhiteReveal/,
  /\.wolfWitchReveal/,
  /\.convertedSeat/,
  /\.actions\??\./,
  /\.actions\?\.\w+/,
];

// =============================================================================
// Test directory path
// =============================================================================

const BOARDS_TEST_DIR = path.join(__dirname, '.');

// =============================================================================
// Helpers
// =============================================================================

function getIntegrationTestFiles(): string[] {
  const files = fs.readdirSync(BOARDS_TEST_DIR);
  return files.filter((f) => f.startsWith('night1.') && f.endsWith('.12p.integration.test.ts'));
}

function readTestFileContent(filename: string): string {
  const filepath = path.join(BOARDS_TEST_DIR, filename);
  return fs.readFileSync(filepath, 'utf-8');
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileMentionsStepId(content: string, stepId: string): boolean {
  // We accept a few common usages:
  // - ctx.assertStep('wolfKill')
  // - currentStepId === 'seerCheck'
  // - executeStepsUntil(ctx, 'witchAction', ...)
  // - schemaId === 'dreamcatcherDream'
  const s = escapeRegExp(stepId);
  const patterns: RegExp[] = [
    new RegExp(String.raw`\.assertStep\(\s*['"]${s}['"]\s*\)`),
    new RegExp(String.raw`currentStepId\s*(?:===|!==|"toBe"|"not\.toBe")\s*['"]${s}['"]`),
    new RegExp(String.raw`executeStepsUntil\(\s*\w+\s*,\s*['"]${s}['"]`),
    new RegExp(String.raw`schemaId\s*===\s*['"]${s}['"]`),
    new RegExp(String.raw`stepId\s*===\s*['"]${s}['"]`),
    new RegExp(String.raw`findActionMessage\([^)]*['"]${s}['"]`),
  ];

  return patterns.some((p) => p.test(content));
}

// =============================================================================
// Contract Tests
// =============================================================================

describe('Night-1 Boards Coverage Contract', () => {
  const testFiles = getIntegrationTestFiles();

  describe('A. Enforce that all 10 boards have test files', () => {
    it('should find at least 10 night1.*.12p.integration.test.ts files', () => {
      expect(testFiles.length).toBeGreaterThanOrEqual(10);
    });

    it.each(REQUIRED_12P_TEMPLATES)(
      'board "%s" must have a corresponding integration test file',
      (templateName) => {
        const pattern = TEMPLATE_TO_TEST_PATTERN[templateName]!;
        expect(pattern).toBeDefined();

        // Find at least one test file that contains the template name
        const hasTestFile = testFiles.some((filename) => {
          const content = readTestFileContent(filename);
          return pattern.test(content);
        });

        expect(hasTestFile).toBe(true);
      },
    );
  });

  describe('B. Prevent "empty shell / deaths-only" tests', () => {
    it.each(testFiles)(
      'file "%s" must contain at least one theme field assertion (not a pure deaths test)',
      (filename) => {
        const content = readTestFileContent(filename);

        // Check whether it contains at least one theme field assertion
        const hasThemeAssertion = REQUIRED_ASSERTION_PATTERNS.some((pattern) =>
          pattern.test(content),
        );

        expect(hasThemeAssertion).toBe(true);
      },
    );
  });

  describe('C. Step-level coverage: every stepId in NIGHT_STEPS must appear in boards tests', () => {
    const stepIds = NIGHT_STEPS.map((s) => s.id);

    it('stepIds in NIGHT_STEPS must be non-empty and unique', () => {
      expect(stepIds.length).toBeGreaterThan(0);
      expect(new Set(stepIds).size).toBe(stepIds.length);
      expect(stepIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    });

    it.each(stepIds)(
      'stepId "%s" must be mentioned by at least one boards test (explicit assertion or progression to this step)',
      (stepId) => {
        // Search all boards tests (including non-12p helpers/contract tests)
        const allBoardTests = fs.readdirSync(BOARDS_TEST_DIR).filter((f) => f.endsWith('.test.ts'));

        const mentionedInSomeFile = allBoardTests.some((filename) => {
          const content = readTestFileContent(filename);
          return fileMentionsStepId(content, stepId);
        });

        expect(mentionedInSomeFile).toBe(true);
      },
    );
  });
});
