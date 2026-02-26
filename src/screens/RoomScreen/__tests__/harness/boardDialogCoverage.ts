/**
 * Board Dialog Coverage Definitions
 *
 * Dynamically generates required dialog types based on board composition.
 * This is the single source of truth for what dialogs each board MUST cover.
 *
 * Coverage is split into TWO layers:
 * 1. UI-TRIGGERABLE: Dialogs that UI tests MUST cover (prompts, confirms, skips, gates)
 * 2. SERVER-DATA-REQUIRED: Reveal dialogs requiring server broadcast data (covered by integration tests)
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
  if (boards.length !== 13) {
    throw new Error(
      `Expected exactly 13 presets with name including "12人", but got ${boards.length}. ` +
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

  // Hunter: confirm trigger (requires pressing '发动状态' button)
  hunter: ['confirmTrigger'],

  // DarkWolfKing: confirm trigger (requires pressing '发动状态' button)
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

  // MirrorSeer: chooseSeat confirm + skip (same as seer)
  mirrorSeer: ['actionConfirm', 'skipConfirm'],

  // PureWhite: chooseSeat confirm + skip
  pureWhite: ['actionConfirm', 'skipConfirm'],

  // WolfWitch: chooseSeat confirm + skip
  wolfWitch: ['actionConfirm', 'skipConfirm'],
};

/**
 * SERVER-DATA-REQUIRED dialog types
 * These require server broadcast data and are covered by integration tests
 */
const ROLE_SERVER_DATA_DIALOG_REQUIREMENTS: Partial<Record<RoleId, DialogType[]>> = {
  // Reveals require server to provide result data
  seer: ['seerReveal'],
  psychic: ['psychicReveal'],
  gargoyle: ['gargoyleReveal'],
  wolfRobot: ['wolfRobotReveal'],
  mirrorSeer: ['mirrorSeerReveal'],
  drunkSeer: ['drunkSeerReveal'],
  pureWhite: ['pureWhiteReveal'],
  wolfWitch: ['wolfWitchReveal'],
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
 * Generate SERVER-DATA-REQUIRED dialog types for a board
 * These are covered by integration tests
 */
export function getRequiredServerDataDialogTypes(board: BoardConfig): DialogType[] {
  const types = new Set<DialogType>();

  for (const role of board.roles) {
    const roleRequirements = ROLE_SERVER_DATA_DIALOG_REQUIREMENTS[role];
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

// =============================================================================
// Test File Naming
// =============================================================================

/**
 * Map board name to expected test file name pattern
 */
export const BOARD_TEST_FILE_MAP: Record<string, string> = {
  预女猎白12人: 'standard.12p.board.ui.test.tsx',
  狼美守卫12人: 'wolfQueen.12p.board.ui.test.tsx',
  狼王守卫12人: 'darkWolfKing.12p.board.ui.test.tsx',
  石像守墓12人: 'gargoyle.12p.board.ui.test.tsx',
  梦魇守卫12人: 'nightmare.12p.board.ui.test.tsx',
  血月猎魔12人: 'bloodMoon.12p.board.ui.test.tsx',
  狼王摄梦12人: 'dreamcatcher.12p.board.ui.test.tsx',
  狼王魔术12人: 'magician.12p.board.ui.test.tsx',
  机械通灵12人: 'wolfRobot.12p.board.ui.test.tsx',
  恶灵骑士12人: 'spiritKnight.12p.board.ui.test.tsx',
  纯白夜影12人: 'pureWhite.12p.board.ui.test.tsx',
  灯影预言12人: 'mirrorSeer.12p.board.ui.test.tsx',
  假面舞会12人: 'masquerade.12p.board.ui.test.tsx',
};
