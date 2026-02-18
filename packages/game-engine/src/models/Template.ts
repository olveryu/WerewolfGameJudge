/**
 * Template - 游戏模板数据模型
 *
 * 定义 GameTemplate 接口、模板校验、预设模板和模板工厂。
 *
 * ✅ 允许：类型定义、纯函数校验/工厂、预设常量
 * ❌ 禁止：import service / 副作用 / IO
 */
import { getRoleSpec, isValidRoleId, RoleId } from './roles';

// ---------------------------------------------------------------------------
// Template validation
// ---------------------------------------------------------------------------

/** Minimum number of players for a valid template */
export const MINIMUM_PLAYERS = 1;

/**
 * Validate a list of roles for template creation.
 * Returns null if valid, otherwise a human-readable reason string.
 */
export function validateTemplateRoles(roles: RoleId[]): string | null {
  // Rule 1: must have at least MINIMUM_PLAYERS
  if (roles.length < MINIMUM_PLAYERS) {
    return `至少需要 ${MINIMUM_PLAYERS} 名玩家`;
  }

  // Rule 2: all roles must be valid RoleId (defensive, in case of external data)
  for (const r of roles) {
    if (!isValidRoleId(r)) {
      return '包含无效角色配置，请重新选择';
    }
  }

  return null;
}

// ---------------------------------------------------------------------------

/**
 * GameTemplate - defines the player composition for a game.
 *
 * Phase 5: actionOrder has been removed. Night action order is now
 * derived dynamically from roles via buildNightPlan(roles).
 */
export interface GameTemplate {
  name: string;
  numberOfPlayers: number;
  roles: RoleId[];
}

// Create custom template (roles are NOT shuffled here - shuffling happens at "准备看牌")
export const createCustomTemplate = (roles: RoleId[]): GameTemplate => {
  return {
    name: '',
    numberOfPlayers: roles.length,
    roles: roles, // Keep original order, shuffle later when assigning roles
  };
};

// Create template from existing roles (for loading from database)
export const createTemplateFromRoles = (roles: RoleId[]): GameTemplate => ({
  name: '',
  numberOfPlayers: roles.length,
  roles,
});

/**
 * Find matching preset name for given roles.
 * Returns the preset name if roles match exactly (sorted), otherwise null.
 */
export const findMatchingPresetName = (roles: RoleId[]): string | null => {
  const sortedRoles = [...roles].sort((a, b) => a.localeCompare(b));
  for (const preset of PRESET_TEMPLATES) {
    const sortedPreset = [...preset.roles].sort((a, b) => a.localeCompare(b));
    if (
      sortedPreset.length === sortedRoles.length &&
      sortedPreset.every((r, i) => r === sortedRoles[i])
    ) {
      return preset.name;
    }
  }
  return null;
};

// Predefined templates matching Flutter app
export const PRESET_TEMPLATES: { name: string; roles: RoleId[] }[] = [
  {
    name: '标准板12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'idiot',
    ],
  },
  {
    name: '狼美守卫12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolfQueen',
      'seer',
      'witch',
      'hunter',
      'guard',
    ],
  },
  {
    name: '狼王守卫12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'darkWolfKing',
      'seer',
      'witch',
      'hunter',
      'guard',
    ],
  },
  {
    name: '石像鬼守墓人12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'gargoyle',
      'seer',
      'witch',
      'hunter',
      'graveyardKeeper',
    ],
  },
  {
    name: '梦魇守卫12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'nightmare',
      'seer',
      'witch',
      'hunter',
      'guard',
    ],
  },
  {
    name: '血月猎魔12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'bloodMoon',
      'seer',
      'witch',
      'idiot',
      'witcher',
    ],
  },
  {
    name: '狼王摄梦人12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'darkWolfKing',
      'seer',
      'witch',
      'hunter',
      'dreamcatcher',
    ],
  },
  {
    name: '狼王魔术师12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'darkWolfKing',
      'seer',
      'witch',
      'hunter',
      'magician',
    ],
  },
  {
    name: '机械狼通灵师12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolfRobot',
      'psychic',
      'witch',
      'hunter',
      'guard',
    ],
  },
  {
    name: '恶灵骑士12人',
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'spiritKnight',
      'seer',
      'witch',
      'hunter',
      'guard',
    ],
  },
];

// Get room info string (matching Flutter)
export const getTemplateRoomInfo = (template: GameTemplate): string => {
  const villagerCount = template.roles.filter((r) => r === 'villager').length;
  const wolfCount = template.roles.filter((r) => r === 'wolf').length;

  let info = `村民x${villagerCount}, 普狼x${wolfCount}, `;

  const specialRoles = template.roles.filter((r) => r !== 'wolf' && r !== 'villager');
  const uniqueSpecialRoles = [...new Set(specialRoles)];

  info += uniqueSpecialRoles.map((r) => getRoleSpec(r).displayName).join(', ');

  return info;
};
