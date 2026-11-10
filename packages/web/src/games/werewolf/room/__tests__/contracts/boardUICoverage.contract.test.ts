/**
 * Board UI Coverage Contract Test
 *
 * UNBYPASSABLE GATE TEST that enforces:
 * 1. All preset boards have corresponding UI test files
 * 2. Each test file must have REAL UI interactions (render + interaction + assertCoverage)
 * 3. No placeholder/cheating patterns allowed
 * 4. Coverage must match board requirements (UI-triggerable types)
 * 5. Nightmare boards must cover blocked → actionRejected with real interaction
 * 6. WolfRobot boards must cover hunter gate with real interaction
 *
 * CHEATING DETECTION:
 * - Placeholder patterns (typeof/bind/placeholder keyword)
 * - Direct record() calls in tests
 * - A mocked alert module bypassing the harness recorder
 * - Missing room renders
 * - Missing real interactions (tapSeat/pressText/click/press*)
 * - assertCoverage that filters out required types
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  BOARD_TEST_FILE_MAP,
  type BoardConfig,
  boardHasNightmare,
  boardHasRole,
  type DialogType,
  getAll12PBoards,
  getRequiredServerDataDialogTypes,
  getRequiredUiDialogTypes,
} from '@/games/werewolf/room/__tests__/harness';

// =============================================================================
// Constants
// =============================================================================

const BOARD_UI_TEST_DIR = path.join(import.meta.dirname, '../boards');

// Cheating patterns that MUST cause test failure
const CHEATING_PATTERNS = {
  placeholder: /placeholder/i,
  typeofAssertCoverage: /typeof\s+.*assertCoverage/,
  bindAssertCoverage: /assertCoverage\.bind/,
  directRecord: /harness\.record\s*\(/,
  // A mocked alert module never reaches the alert store the harness records from.
  mockedAlertModule: /vi\.(?:mock|doMock)\(\s*['"]@\/utils\/alert['"]/,
  customShowAlertMock: /vi\.fn\(\s*\(\s*title.*message.*buttons?\s*\)\s*=>/,
  // ANTI-CHEAT: Dynamic function call bypasses the literal array requirement
  dynamicGetRequiredTypes: /harness\.assertCoverage\s*\(\s*getRequiredUiDialogTypes\s*\(/,
  // ANTI-CHEAT: it.skip on required dialogs bypasses coverage
  itSkipOnRequiredDialogs:
    /it\.skip\s*\(\s*['"`][^'"`]*(confirmTrigger|skipConfirm|actionConfirm|wolfRobotHunterStatus|actionRejected)/,
} as const;

// Required structural patterns for valid UI test
const REQUIRED_PATTERNS = {
  // The production room screen is mounted through the harness render helpers.
  renderRoomScreen: /\b(?:renderWerewolfRoom|mountWerewolfRoom|mountRoomFor|mount)\s*\(/,
  realInteraction: /tapSeat|pressText|\bclick\(|\.press[A-Za-z]*\(/,
  // ONLY accept literal array - getRequiredUiDialogTypes() is CHEATING
  assertCoverageCall: /harness\.assertCoverage\s*\(\s*\[/,
  alertRecorderFromHarness: /recordAlerts\s*\(\s*harness\s*\)/,
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

function getBoardUITestFiles(): string[] {
  if (!fs.existsSync(BOARD_UI_TEST_DIR)) {
    return [];
  }
  return fs.readdirSync(BOARD_UI_TEST_DIR).filter((f) => f.endsWith('.board.ui.test.tsx'));
}

function readTestFileContent(filename: string): string {
  const filepath = path.join(BOARD_UI_TEST_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return '';
  }
  return fs.readFileSync(filepath, 'utf-8');
}

function countPatternMatches(content: string, pattern: RegExp): number {
  return content.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
}

// =============================================================================
// Cheating Detection
// =============================================================================

function detectCheating(content: string, filename: string): string[] {
  return Object.entries(CHEATING_PATTERNS)
    .filter(([, pattern]) => pattern.test(content))
    .map(([name]) => `[CHEAT] Found ${name} pattern in ${filename}`);
}

// =============================================================================
// Structure Validation
// =============================================================================

interface StructureReport {
  isValid: boolean;
  issues: string[];
  stats: {
    renderCount: number;
    interactionCount: number;
    assertCoverageCount: number;
  };
}

function validateTestStructure(content: string, filename: string): StructureReport {
  const issues: string[] = [];

  const renderCount = countPatternMatches(content, REQUIRED_PATTERNS.renderRoomScreen);
  const interactionCount = countPatternMatches(content, REQUIRED_PATTERNS.realInteraction);
  const assertCoverageCount = countPatternMatches(content, REQUIRED_PATTERNS.assertCoverageCall);

  if (renderCount === 0) {
    issues.push(`[STRUCTURE] ${filename}: No room render (renderWerewolfRoom/mount…) found`);
  }

  if (interactionCount === 0) {
    issues.push(`[STRUCTURE] ${filename}: No real UI interactions found (tapSeat/pressText/press)`);
  }

  if (assertCoverageCount === 0) {
    issues.push(`[STRUCTURE] ${filename}: No harness.assertCoverage([...]) call found`);
  }

  // Must record alerts through the harness
  if (!REQUIRED_PATTERNS.alertRecorderFromHarness.test(content)) {
    issues.push(`[STRUCTURE] ${filename}: Must record alerts with recordAlerts(harness)`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    stats: { renderCount, interactionCount, assertCoverageCount },
  };
}

// =============================================================================
// Coverage Assertion Validation
// =============================================================================

interface CoverageAssertionReport {
  isValid: boolean;
  issues: string[];
  assertedTypes: DialogType[];
  missingTypes: DialogType[];
}

function validateCoverageAssertion(
  content: string,
  board: BoardConfig,
  filename: string,
): CoverageAssertionReport {
  const requiredUiTypes = getRequiredUiDialogTypes(board);

  // ANTI-CHEAT: Detect dynamic getRequiredUiDialogTypes() usage - this is CHEATING
  if (/harness\.assertCoverage\s*\(\s*getRequiredUiDialogTypes\s*\(/m.test(content)) {
    return {
      isValid: false,
      issues: [
        `[CHEAT] ${filename}: Using getRequiredUiDialogTypes() in assertCoverage is CHEATING! Must use literal array.`,
      ],
      assertedTypes: [],
      missingTypes: requiredUiTypes,
    };
  }

  // Extract all assertCoverage calls with literal arrays and their quoted types
  const allAssertedTypes = new Set<string>();
  for (const match of content.matchAll(/harness\.assertCoverage\s*\(\s*\[([^\]]*)\]/g)) {
    for (const quoted of match[1]!.match(/'[^']+'/g) ?? []) {
      allAssertedTypes.add(quoted.replaceAll("'", ''));
    }
  }

  const missingTypes = requiredUiTypes.filter((t) => !allAssertedTypes.has(t));
  const issues =
    missingTypes.length > 0
      ? [
          `[COVERAGE] ${filename}: Missing required UI dialog types in assertCoverage: [${missingTypes.join(', ')}]`,
        ]
      : [];

  return {
    isValid: issues.length === 0,
    issues,
    assertedTypes: requiredUiTypes.filter((t) => allAssertedTypes.has(t)),
    missingTypes,
  };
}

// =============================================================================
// Special Case Validation
// =============================================================================

function validateNightmareBoard(content: string, filename: string): string[] {
  const issues: string[] = [];

  // Nightmare board must have BLOCKED_UI_DEFAULTS reference
  if (!content.includes('BLOCKED_UI_DEFAULTS')) {
    issues.push(
      `[NIGHTMARE] ${filename}: Must import and use BLOCKED_UI_DEFAULTS to verify blocked message`,
    );
  }

  // Must have actionRejected assertion
  if (!content.includes("'actionRejected'")) {
    issues.push(`[NIGHTMARE] ${filename}: Must assert actionRejected for blocked player`);
  }

  // Must have real interaction before actionRejected (not just state injection)
  const hasTapSeatBeforeRejection =
    /tapSeat.*[\s\S]*actionRejected/m.test(content) ||
    /submitAction.*[\s\S]*actionRejected/m.test(content);

  if (!hasTapSeatBeforeRejection) {
    issues.push(
      `[NIGHTMARE] ${filename}: actionRejected must be triggered by real UI interaction (tapSeat/submit), not just state injection`,
    );
  }

  return issues;
}

function validateWolfRobotBoard(content: string, filename: string): string[] {
  const issues: string[] = [];

  // WolfRobot board must cover hunter gate
  if (!content.includes('wolfRobotHunterStatus')) {
    issues.push(
      `[WOLFROBOT] ${filename}: Must test wolfRobotHunterStatus gate (hunter learned case)`,
    );
  }

  // Must have hunter gate interaction (pressPrimary or confirm button)
  const hasHunterGateInteraction =
    /wolfRobotHunterStatus[\s\S]*pressPrimary|pressPrimary[\s\S]*wolfRobotHunterStatus/m.test(
      content,
    );

  if (!hasHunterGateInteraction) {
    issues.push(
      `[WOLFROBOT] ${filename}: Must have real button interaction for hunter gate (pressPrimary)`,
    );
  }

  // Must have no-loop assertion
  if (!content.includes('assertNoLoop')) {
    issues.push(
      `[WOLFROBOT] ${filename}: Must use assertNoLoop to verify no death loop for hunter gate`,
    );
  }

  return issues;
}

// =============================================================================
// Tests
// =============================================================================

describe('Board UI Coverage Contract', () => {
  const boards = getAll12PBoards();

  describe('File Existence', () => {
    it('should have exactly one board UI test file per preset board', () => {
      expect(getBoardUITestFiles()).toHaveLength(boards.length);
    });

    it('should have a test file mapping for every 12P board', () => {
      const mappedNames = new Set(Object.keys(BOARD_TEST_FILE_MAP));
      const boardNames = new Set(boards.map((b) => b.name));

      const missingMappings = [...boardNames].filter((n) => !mappedNames.has(n));
      const extraMappings = [...mappedNames].filter((n) => !boardNames.has(n));

      if (missingMappings.length || extraMappings.length) {
        throw new Error(
          `Board UI test file mapping mismatch.\n` +
            `Missing mappings for boards: [${missingMappings.join(', ')}]\n` +
            `Extra mappings without a board: [${extraMappings.join(', ')}]`,
        );
      }
    });

    it.each(boards)('board "$name" should have a UI test file', (board) => {
      const expectedFile = BOARD_TEST_FILE_MAP[board.name];
      expect(expectedFile).toBeDefined();
      expect(getBoardUITestFiles()).toContain(expectedFile);
    });
  });

  describe('Cheating Detection (MUST FAIL if cheating)', () => {
    it.each(boards)('board "$name" test must not contain cheating patterns', (board) => {
      const expectedFile = BOARD_TEST_FILE_MAP[board.name];
      if (!expectedFile) return;

      const content = readTestFileContent(expectedFile);
      if (!content) return;

      const violations = detectCheating(content, expectedFile);
      if (violations.length > 0) {
        throw new Error(`CHEATING DETECTED in ${expectedFile}:\n${violations.join('\n')}`);
      }
    });
  });

  describe('Test Structure Validation', () => {
    it.each(boards)('board "$name" test must have valid structure', (board) => {
      const expectedFile = BOARD_TEST_FILE_MAP[board.name];
      if (!expectedFile) return;

      const content = readTestFileContent(expectedFile);
      if (!content) return;

      const report = validateTestStructure(content, expectedFile);

      if (!report.isValid) {
        throw new Error(
          `INVALID TEST STRUCTURE in ${expectedFile}:\n` +
            `${report.issues.join('\n')}\n` +
            `Stats: renders=${report.stats.renderCount}, interactions=${report.stats.interactionCount}, assertCoverage=${report.stats.assertCoverageCount}`,
        );
      }
    });
  });

  describe('Coverage Assertion Validation', () => {
    it.each(boards)('board "$name" must assert all required UI dialog types', (board) => {
      const expectedFile = BOARD_TEST_FILE_MAP[board.name];
      if (!expectedFile) return;

      const content = readTestFileContent(expectedFile);
      if (!content) return;

      const report = validateCoverageAssertion(content, board, expectedFile);

      if (!report.isValid) {
        throw new Error(
          `INCOMPLETE COVERAGE in ${expectedFile}:\n` +
            `${report.issues.join('\n')}\n\n` +
            `Required UI types (MUST cover): [${getRequiredUiDialogTypes(board).join(', ')}]\n` +
            `Required Server-data types (covered by integration): [${getRequiredServerDataDialogTypes(board).join(', ')}]\n` +
            `Asserted types: [${report.assertedTypes.join(', ')}]\n` +
            `Missing types: [${report.missingTypes.join(', ')}]`,
        );
      }
    });
  });

  describe('Special Case Validation', () => {
    const nightmareBoards = boards.filter((b) => boardHasNightmare(b));
    const wolfRobotBoards = boards.filter((b) => boardHasRole(b, 'wolfRobot'));

    it.each(nightmareBoards)(
      'nightmare board "$name" must cover blocked → actionRejected with real interaction',
      (board) => {
        const expectedFile = BOARD_TEST_FILE_MAP[board.name];
        if (!expectedFile) return;

        const content = readTestFileContent(expectedFile);
        if (!content) return;

        const issues = validateNightmareBoard(content, expectedFile);
        if (issues.length > 0) {
          throw new Error(`NIGHTMARE VALIDATION FAILED for ${expectedFile}:\n${issues.join('\n')}`);
        }
      },
    );

    it.each(wolfRobotBoards)(
      'wolfRobot board "$name" must cover hunter gate with real interaction and no-loop assertion',
      (board) => {
        const expectedFile = BOARD_TEST_FILE_MAP[board.name];
        if (!expectedFile) return;

        const content = readTestFileContent(expectedFile);
        if (!content) return;

        const issues = validateWolfRobotBoard(content, expectedFile);
        if (issues.length > 0) {
          throw new Error(`WOLFROBOT VALIDATION FAILED for ${expectedFile}:\n${issues.join('\n')}`);
        }
      },
    );
  });

  describe('Required Dialog Types Documentation', () => {
    it.each(boards)('board "$name" required types should be documented', (board) => {
      const requiredUiTypes = getRequiredUiDialogTypes(board);

      expect(requiredUiTypes).toContain('actionPrompt');
      expect(requiredUiTypes).toContain('wolfVote');
    });
  });
});
