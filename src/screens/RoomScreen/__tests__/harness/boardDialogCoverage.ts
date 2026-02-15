/**
 * Board Dialog Coverage Definitions
 *
 * Dynamically generates required dialog types based on board composition.
 * This is the single source of truth for what dialogs each board MUST cover.
 *
 * Coverage is split into TWO layers:
 * 1. UI-TRIGGERABLE: Dialogs that UI tests MUST cover (prompts, confirms, skips, gates)
 * 2. HOST-DATA-REQUIRED: Reveal dialogs requiring Host broadcast data (covered by integration tests)
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { PRESET_TEMPLATES } from '@werewolf/game-engine/models/Template';

import type { DialogType } from './RoomScreenTestHarness';

// =============================================================================
// Board Configuration
// =============================================================================

export interface BoardConfig {
  name: string;
  roles: RoleId[];
}

/**
 * Get all 10 12P board configurations
 */
export function getAll12PBoards(): BoardConfig[] {
  // NOTE: "12人板子" is a strict contract in this repo: it refers to the 10
  // Chinese-named presets used by production UI.
  // If someone adds/removes/renames presets, update BOARD_TEST_FILE_MAP
  // and the UI coverage contract tests accordingly.
  const boards = PRESET_TEMPLATES.filter((t) => t.name.includes('12人')).map((t) => ({
    name: t.name,
    roles: t.roles,
  }));

  // Fail-fast: avoid silently picking up unexpected presets.
  if (boards.length !== 10) {
    throw new Error(
      `Expected exactly 10 presets with name including "12人", but got ${boards.length}. ` +
        `Update board UI coverage mapping/tests if presets changed.`,
    );
  }

  return boards;
}

/**
 * Get a specific board by name
 */
export function getBoardByName(name: string): BoardConfig | undefined {
  const template = PRESET_TEMPLATES.find((t) => t.name === name);
  if (!template) return undefined;
  return { name: template.name, roles: template.roles };
}

// =============================================================================
// Role → Dialog Type Mapping (Two Layers)
// =============================================================================

/**
 * Base dialog types that ALL boards must cover (UI-triggerable)
 */
const BASE_UI_DIALOG_TYPES: DialogType[] = ['actionPrompt', 'wolfVote', 'wolfVoteEmpty'];

/**
 * UI-TRIGGERABLE role-specific dialog requirements
 * These MUST be covered by UI tests (render → interaction → showAlert)
 *
 * CRITICAL: ALL these dialogs are MANDATORY and cannot be excluded.
 * Tests must properly mock hooks/buttons to trigger these dialogs.
 */
const ROLE_UI_DIALOG_REQUIREMENTS: Partial<Record<RoleId, DialogType[]>> = {
  // Witch: save/poison prompt + no-kill info (UI can trigger with mock state)
  witch: ['witchSavePrompt', 'witchPoisonPrompt', 'witchNoKill'],

  // Seer: chooseSeat confirm + skip
  seer: ['actionConfirm', 'skipConfirm'],

  // Magician: first target + action confirm (requires tapping two seats)
  magician: ['magicianFirst', 'actionConfirm', 'skipConfirm'],

  // Nightmare: causes actionRejected for blocked players + own chooseSeat
  nightmare: ['actionRejected', 'actionConfirm', 'skipConfirm'],

  // Guard: chooseSeat confirm + skip
  guard: ['actionConfirm', 'skipConfirm'],

  // Hunter: confirm trigger (requires pressing '查看发动状态' button)
  hunter: ['confirmTrigger'],

  // DarkWolfKing: confirm trigger (requires pressing '查看发动状态' button)
  darkWolfKing: ['confirmTrigger'],

  // WolfRobot: hunter gate + chooseSeat confirm + skip
  wolfRobot: ['wolfRobotHunterStatus', 'actionConfirm', 'skipConfirm'],

  // WolfQueen: charm chooseSeat confirm + skip
  wolfQueen: ['actionConfirm', 'skipConfirm'],

  // Dreamcatcher: chooseSeat confirm + skip
  dreamcatcher: ['actionConfirm', 'skipConfirm'],

  // Gargoyle: chooseSeat confirm + skip
  gargoyle: ['actionConfirm', 'skipConfirm'],

  // Psychic: chooseSeat confirm + skip
  psychic: ['actionConfirm', 'skipConfirm'],
};

/**
 * HOST-DATA-REQUIRED dialog types
 * These require Host broadcast data and are covered by integration tests
 */
const ROLE_HOST_DATA_DIALOG_REQUIREMENTS: Partial<Record<RoleId, DialogType[]>> = {
  // Reveals require Host to provide result data
  seer: ['seerReveal'],
  psychic: ['psychicReveal'],
  gargoyle: ['gargoyleReveal'],
  wolfRobot: ['wolfRobotReveal'],
};

// =============================================================================
// Required Dialog Type Generation (Two Layers)
// =============================================================================

/**
 * Generate UI-TRIGGERABLE required dialog types for a board
 * These MUST be covered by UI tests
 */
export function getRequiredUiDialogTypes(board: BoardConfig): DialogType[] {
  const types = new Set<DialogType>(BASE_UI_DIALOG_TYPES);

  for (const role of board.roles) {
    const roleRequirements = ROLE_UI_DIALOG_REQUIREMENTS[role];
    if (roleRequirements) {
      for (const type of roleRequirements) {
        types.add(type);
      }
    }
  }

  return [...types];
}

/**
 * Generate HOST-DATA-REQUIRED dialog types for a board
 * These are covered by integration tests
 */
export function getRequiredHostDataDialogTypes(board: BoardConfig): DialogType[] {
  const types = new Set<DialogType>();

  for (const role of board.roles) {
    const roleRequirements = ROLE_HOST_DATA_DIALOG_REQUIREMENTS[role];
    if (roleRequirements) {
      for (const type of roleRequirements) {
        types.add(type);
      }
    }
  }

  return [...types];
}

/**
 * Check if a board contains a specific role
 */
export function boardHasRole(board: BoardConfig, role: RoleId): boolean {
  return board.roles.includes(role);
}

/**
 * Check if a board contains nightmare (requires additional branch coverage)
 */
export function boardHasNightmare(board: BoardConfig): boolean {
  return boardHasRole(board, 'nightmare');
}

/**
 * Get the "special" role for a board (non-wolf, non-villager, non-standard god)
 * Used for naming test files
 */
export function getBoardSpecialRole(board: BoardConfig): RoleId | null {
  const specialRoles = new Set<RoleId>([
    'wolfQueen',
    'darkWolfKing',
    'gargoyle',
    'nightmare',
    'bloodMoon',
    'dreamcatcher',
    'magician',
    'wolfRobot',
    'spiritKnight',
    'witcher',
    'graveyardKeeper',
  ]);

  for (const role of board.roles) {
    if (specialRoles.has(role)) {
      return role;
    }
  }

  return null;
}

// =============================================================================
// Coverage Matrix
// =============================================================================

export interface CoverageEntry {
  board: string;
  requiredUiTypes: DialogType[];
  requiredHostDataTypes: DialogType[];
  hasNightmare: boolean;
  hasWolfRobot: boolean;
}

/**
 * Generate the complete coverage matrix for all 12P boards
 */
export function generateCoverageMatrix(): CoverageEntry[] {
  const boards = getAll12PBoards();
  return boards.map((board) => ({
    board: board.name,
    requiredUiTypes: getRequiredUiDialogTypes(board),
    requiredHostDataTypes: getRequiredHostDataDialogTypes(board),
    hasNightmare: boardHasNightmare(board),
    hasWolfRobot: boardHasRole(board, 'wolfRobot'),
  }));
}

// =============================================================================
// Test File Naming
// =============================================================================

/**
 * Map board name to expected test file name pattern
 */
export const BOARD_TEST_FILE_MAP: Record<string, string> = {
  标准板12人: 'standard.12p.board.ui.test.tsx',
  狼美守卫12人: 'wolfQueen.12p.board.ui.test.tsx',
  狼王守卫12人: 'darkWolfKing.12p.board.ui.test.tsx',
  石像鬼守墓人12人: 'gargoyle.12p.board.ui.test.tsx',
  梦魇守卫12人: 'nightmare.12p.board.ui.test.tsx',
  血月猎魔12人: 'bloodMoon.12p.board.ui.test.tsx',
  狼王摄梦人12人: 'dreamcatcher.12p.board.ui.test.tsx',
  狼王魔术师12人: 'magician.12p.board.ui.test.tsx',
  机械狼通灵师12人: 'wolfRobot.12p.board.ui.test.tsx',
  恶灵骑士12人: 'spiritKnight.12p.board.ui.test.tsx',
};

/**
 * Get expected test file name for a board
 */
export function getTestFileName(boardName: string): string {
  return BOARD_TEST_FILE_MAP[boardName] || `${boardName}.12p.board.ui.test.tsx`;
}
