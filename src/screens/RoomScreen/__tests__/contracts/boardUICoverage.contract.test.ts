/**
 * Board UI Coverage Contract Test
 *
 * UNBYPASSABLE GATE TEST that enforces:
 * 1. All 10 12P boards have corresponding UI test files
 * 2. Each test file must have REAL UI interactions (render + interaction + assertCoverage)
 * 3. No placeholder/cheating patterns allowed
 * 4. Coverage must match board requirements (UI-triggerable types)
 * 5. Nightmare boards must cover blocked → actionRejected with real interaction
 * 6. WolfRobot boards must cover hunter gate with real interaction
 *
 * CHEATING DETECTION:
 * - Placeholder patterns (typeof/bind/placeholder keyword)
 * - Direct _record() calls in tests
 * - Custom showAlert mock bypassing harness
 * - Missing render() calls
 * - Missing real interactions (tapSeat/fireEvent/press)
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
  getRequiredHostDataDialogTypes,
  getRequiredUiDialogTypes,
} from '@/screens/RoomScreen/__tests__/harness';

// =============================================================================
// Constants
// =============================================================================

const BOARD_UI_TEST_DIR = path.join(__dirname, '../boards');

// Cheating patterns that MUST cause test failure
const CHEATING_PATTERNS = {
  placeholder: /placeholder/i,
  typeofAssertCoverage: /typeof\s+.*assertCoverage/,
  bindAssertCoverage: /assertCoverage\.bind/,
  directRecord: /harness\._record\s*\(/,
  customShowAlertMock: /jest\.fn\(\s*\(\s*title.*message.*buttons?\s*\)\s*=>/,
  // ANTI-CHEAT: Dynamic function call bypasses the literal array requirement
  dynamicGetRequiredTypes: /harness\.assertCoverage\s*\(\s*getRequiredUiDialogTypes\s*\(/,
  // ANTI-CHEAT: it.skip on required dialogs bypasses coverage
  itSkipOnRequiredDialogs:
    /it\.skip\s*\(\s*['"`][^'"`]*(confirmTrigger|skipConfirm|actionConfirm|wolfRobotHunterStatus|actionRejected)/,
} as const;

// Required structural patterns for valid UI test
const REQUIRED_PATTERNS = {
  renderRoomScreen: /render\s*\(\s*<\s*RoomScreen/,
  realInteraction: /tapSeat|fireEvent\.|\.press\(|pressPrimary|pressCancel/,
  // ONLY accept literal array - getRequiredUiDialogTypes() is CHEATING
  assertCoverageCall: /harness\.assertCoverage\s*\(\s*\[/,
  showAlertMockFromHarness: /createShowAlertMock\s*\(\s*harness\s*\)/,
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
  const globalPattern = new RegExp(pattern.source, 'g');
  let count = 0;
  while (globalPattern.exec(content) !== null) {
    count++;
  }
  return count;
}

// =============================================================================
// Cheating Detection
// =============================================================================

interface CheatingReport {
  isCheating: boolean;
  violations: string[];
}

function detectCheating(content: string, filename: string): CheatingReport {
  const violations: string[] = [];

  // Check for cheating patterns
  for (const [name, pattern] of Object.entries(CHEATING_PATTERNS)) {
    if (pattern.test(content)) {
      violations.push(`[CHEAT] Found ${name} pattern in ${filename}`);
    }
  }

  return {
    isCheating: violations.length > 0,
    violations,
  };
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

  // Count required patterns
  const renderCount = countPatternMatches(content, REQUIRED_PATTERNS.renderRoomScreen);
  const interactionCount = countPatternMatches(content, REQUIRED_PATTERNS.realInteraction);
  const assertCoverageCount = countPatternMatches(content, REQUIRED_PATTERNS.assertCoverageCall);

  // Validate required patterns exist
  if (renderCount === 0) {
    issues.push(`[STRUCTURE] ${filename}: No render(<RoomScreen .../>) found`);
  }

  if (interactionCount === 0) {
    issues.push(`[STRUCTURE] ${filename}: No real UI interactions found (tapSeat/fireEvent/press)`);
  }

  if (assertCoverageCount === 0) {
    issues.push(`[STRUCTURE] ${filename}: No harness.assertCoverage([...]) call found`);
  }

  // Must use harness's showAlert mock
  if (!REQUIRED_PATTERNS.showAlertMockFromHarness.test(content)) {
    issues.push(
      `[STRUCTURE] ${filename}: Must use createShowAlertMock(harness) for showAlert mock`,
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
    stats: {
      renderCount,
      interactionCount,
      assertCoverageCount,
    },
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
  const issues: string[] = [];

  // ANTI-CHEAT: Detect dynamic getRequiredUiDialogTypes() usage - this is CHEATING
  const usesDynamicCoverage = /harness\.assertCoverage\s*\(\s*getRequiredUiDialogTypes\s*\(/m.test(
    content,
  );

  if (usesDynamicCoverage) {
    issues.push(
      `[CHEAT] ${filename}: Using getRequiredUiDialogTypes() in assertCoverage is CHEATING! Must use literal array.`,
    );
    return {
      isValid: false,
      issues,
      assertedTypes: [],
      missingTypes: requiredUiTypes,
    };
  }

  // Extract all assertCoverage calls with literal arrays and their type arrays
  const assertCoverageMatches = content.matchAll(/harness\.assertCoverage\s*\(\s*\[([^\]]*)\]/g);
  const allAssertedTypes = new Set<string>();

  for (const match of assertCoverageMatches) {
    const typesStr = match[1];
    // Extract quoted strings
    const types = typesStr.match(/'[^']+'/g) || [];
    for (const t of types) {
      allAssertedTypes.add(t.replaceAll("'", ''));
    }
  }

  // Check for missing required UI types
  const assertedTypesArray = [...allAssertedTypes] as DialogType[];
  const missingTypes = requiredUiTypes.filter((t) => !allAssertedTypes.has(t));

  if (missingTypes.length > 0) {
    issues.push(
      `[COVERAGE] ${filename}: Missing required UI dialog types in assertCoverage: [${missingTypes.join(', ')}]`,
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
    assertedTypes: assertedTypesArray,
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
  // Check for tapSeat or submit interaction followed by actionRejected check
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
      `[WOLROBOT] ${filename}: Must test wolfRobotHunterStatus gate (hunter learned case)`,
    );
  }

  // Must have hunter gate interaction (pressPrimary or confirm button)
  const hasHunterGateInteraction =
    /wolfRobotHunterStatus[\s\S]*pressPrimary|pressPrimary[\s\S]*wolfRobotHunterStatus/m.test(
      content,
    );

  if (!hasHunterGateInteraction) {
    issues.push(
      `[WOLROBOT] ${filename}: Must have real button interaction for hunter gate (pressPrimary)`,
    );
  }

  // Must have no-loop assertion
  if (!content.includes('assertNoLoop')) {
    issues.push(
      `[WOLROBOT] ${filename}: Must use assertNoLoop to verify no death loop for hunter gate`,
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
    it('should have exactly 10 board UI test files', () => {
      const files = getBoardUITestFiles();
      expect(files.length).toBe(10);
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

      const files = getBoardUITestFiles();
      expect(files).toContain(expectedFile);
    });
  });

  describe('Cheating Detection (MUST FAIL if cheating)', () => {
    it.each(boards)('board "$name" test must not contain cheating patterns', (board) => {
      const expectedFile = BOARD_TEST_FILE_MAP[board.name];
      if (!expectedFile) return;

      const content = readTestFileContent(expectedFile);
      if (!content) return;

      const report = detectCheating(content, expectedFile);

      if (report.isCheating) {
        throw new Error(`CHEATING DETECTED in ${expectedFile}:\n${report.violations.join('\n')}`);
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
        const requiredUiTypes = getRequiredUiDialogTypes(board);
        const requiredHostDataTypes = getRequiredHostDataDialogTypes(board);

        throw new Error(
          `INCOMPLETE COVERAGE in ${expectedFile}:\n` +
            `${report.issues.join('\n')}\n\n` +
            `Required UI types (MUST cover): [${requiredUiTypes.join(', ')}]\n` +
            `Required Host-data types (covered by integration): [${requiredHostDataTypes.join(', ')}]\n` +
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
          throw new Error(`WOLROBOT VALIDATION FAILED for ${expectedFile}:\n${issues.join('\n')}`);
        }
      },
    );
  });

  describe('Required Dialog Types Documentation', () => {
    it.each(boards)('board "$name" required types should be documented', (board) => {
      const requiredUiTypes = getRequiredUiDialogTypes(board);

      // This test documents and validates the required types
      expect(requiredUiTypes).toContain('actionPrompt');
      expect(requiredUiTypes).toContain('wolfVote');

      // Document required types — test expectation already validates them above
    });
  });
});
