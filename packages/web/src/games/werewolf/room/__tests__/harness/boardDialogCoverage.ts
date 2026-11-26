/**
 * Preset board definitions used by the board UI coverage contract.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { PRESET_TEMPLATES } from '@game-judge/game-engine/games/werewolf/public';

import type { DialogType } from './RoomScreenTestHarness';

// =============================================================================
// Board Configuration
// =============================================================================

interface BoardConfig {
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
  if (boards.length !== 28) {
    throw new Error(
      `Expected exactly 28 presets, but got ${boards.length}. ` +
        `Update board UI coverage mapping/tests if presets changed.`,
    );
  }

  return boards;
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
  白狼王守卫: 'wolfKing.12p.board.ui.test.tsx',
  猩红蜂舞: 'scarletBee.12p.board.ui.test.tsx',
  石像鬼守墓人: 'gargoyle.12p.board.ui.test.tsx',
  噩梦之影守卫: 'nightmare.12p.board.ui.test.tsx',
  血月猎魔: 'bloodMoon.12p.board.ui.test.tsx',
  狼王摄梦人: 'dreamcatcher.12p.board.ui.test.tsx',
  狼王魔术师: 'magician.12p.board.ui.test.tsx',
  机械狼人通灵师: 'wolfRobot.12p.board.ui.test.tsx',
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
  盗贼丘比特: 'thiefCupid.12p.board.ui.test.tsx',
  咒狐乌鸦: 'cursedFox.12p.board.ui.test.tsx',
  永序之轮: 'eclipseWolfQueen.12p.board.ui.test.tsx',
  隐狼乌鸦: 'hiddenWolf.12p.board.ui.test.tsx',
  种狼骑士: 'seedWolf.12p.board.ui.test.tsx',
  狼女孩: 'wolfGirl.12p.board.ui.test.tsx',
};

const ROLE_REQUIRED_UI_DIALOG_TYPES: Partial<Record<RoleId, readonly DialogType[]>> = {
  scarletWolfKing: ['actionPrompt', 'actionConfirm'],
};

/** Dialogs and inline prompts required by the roles on a board. */
export function getRequiredUiDialogTypes(roles: readonly RoleId[]): DialogType[] {
  return [...new Set(roles.flatMap((role) => ROLE_REQUIRED_UI_DIALOG_TYPES[role] ?? []))];
}
