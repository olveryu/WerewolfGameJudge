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
 * Get all board configurations (all preset templates)
 */
export function getAll12PBoards(): BoardConfig[] {
  const boards = PRESET_TEMPLATES.map((t) => ({
    name: t.name,
    roles: t.roles,
  }));

  // Fail-fast: avoid silently picking up unexpected presets.
  if (boards.length !== 20) {
    throw new Error(
      `Expected exactly 20 presets, but got ${boards.length}. ` +
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

  // AwakenedGargoyle: chooseSeat confirm only (canSkip: false, 强制发动)
  awakenedGargoyle: ['actionConfirm'],

  // Psychic: chooseSeat confirm + skip
  psychic: ['actionConfirm', 'skipConfirm'],

  // MirrorSeer: chooseSeat confirm + skip (same as seer)
  mirrorSeer: ['actionConfirm', 'skipConfirm'],

  // PureWhite: chooseSeat confirm + skip
  pureWhite: ['actionConfirm', 'skipConfirm'],

  // WolfWitch: chooseSeat confirm + skip
  wolfWitch: ['actionConfirm', 'skipConfirm'],

  // Slacker: chooseSeat (canSkip=false, must choose)
  slacker: ['actionConfirm'],

  // WildChild: chooseSeat (canSkip=false, must choose)
  wildChild: ['actionConfirm'],

  // Shadow: chooseSeat (canSkip=false, must choose)
  shadow: ['actionConfirm'],

  // Avenger: confirm trigger (displays faction)
  avenger: ['confirmTrigger'],

  // Piper: multiChooseSeat confirm + skip
  piper: ['actionConfirm', 'skipConfirm'],
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
  预女猎白: 'standard.12p.board.ui.test.tsx',
  狼美守卫: 'wolfQueen.12p.board.ui.test.tsx',
  狼王守卫: 'darkWolfKing.12p.board.ui.test.tsx',
  石像鬼守墓人: 'gargoyle.12p.board.ui.test.tsx',
  梦魇守卫: 'nightmare.12p.board.ui.test.tsx',
  血月猎魔: 'bloodMoon.12p.board.ui.test.tsx',
  狼王摄梦人: 'dreamcatcher.12p.board.ui.test.tsx',
  狼王魔术师: 'magician.12p.board.ui.test.tsx',
  机械狼通灵师: 'wolfRobot.12p.board.ui.test.tsx',
  恶灵骑士: 'spiritKnight.12p.board.ui.test.tsx',
  纯白夜影: 'pureWhite.12p.board.ui.test.tsx',
  灯影预言家: 'mirrorSeer.12p.board.ui.test.tsx',
  假面舞会: 'masquerade.12p.board.ui.test.tsx',
  吹笛者: 'piper.12p.board.ui.test.tsx',
  预女猎白混: 'slacker.12p.board.ui.test.tsx',
  预女猎白野: 'wildChild.12p.board.ui.test.tsx',
  唯邻是从: 'awakenedGargoyle.12p.board.ui.test.tsx',
  孤注一掷: 'warden.12p.board.ui.test.tsx',
  影子复仇者: 'shadowAvenger.11p.board.ui.test.tsx',
  盗宝大师: 'treasureMaster.12p.board.ui.test.tsx',
};
