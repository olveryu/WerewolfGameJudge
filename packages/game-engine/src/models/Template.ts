/**
 * Template - 游戏模板数据模型
 *
 * 定义 GameTemplate 接口、模板校验、预设模板和模板工厂。
 * 导出类型定义、纯函数校验/工厂及预设常量，不包含 service 依赖、副作用或 IO。
 */
import { isValidRoleId, RoleId } from './roles';

// ---------------------------------------------------------------------------
// Template categories (for grouped display in TemplatePicker)
// ---------------------------------------------------------------------------

export enum TemplateCategory {
  /** 经典板（预女猎白、狼美守卫、狼王守卫等入门阵容） */
  Classic = 'classic',
  /** 进阶板（石像鬼、血月猎魔等需要经验的阵容） */
  Advanced = 'advanced',
  /** 特色板（噩梦之影、灯影、假面等独特机制） */
  Special = 'special',
  /** 第三方板（混血儿、吹笛、野孩等含第三方阵营） */
  ThirdParty = 'thirdParty',
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  [TemplateCategory.Classic]: '经典',
  [TemplateCategory.Advanced]: '进阶',
  [TemplateCategory.Special]: '特色',
  [TemplateCategory.ThirdParty]: '第三方',
};

export interface PresetTemplate {
  name: string;
  roles: RoleId[];
  category: TemplateCategory;
}

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
  // Rule 1: must have at least MINIMUM_PLAYERS (actual players, excluding bottom cards)
  const playerCount = getPlayerCount(roles);
  if (playerCount < MINIMUM_PLAYERS) {
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

/** 盗宝大师底牌数量 */
export const BOTTOM_CARD_COUNT = 3;

/** 盗贼底牌数量 */
export const THIEF_BOTTOM_CARD_COUNT = 2;

/** 底牌角色 ID 列表（互斥：同一模板最多一个） */
const BOTTOM_CARD_ROLE_IDS = ['treasureMaster', 'thief'] as const;

/**
 * 获取模板中底牌角色的 ID（如有）。
 * treasureMaster 和 thief 互斥。
 */
export function getBottomCardRoleId(roles: readonly RoleId[]): RoleId | null {
  for (const id of BOTTOM_CARD_ROLE_IDS) {
    if (roles.includes(id as RoleId)) return id as RoleId;
  }
  return null;
}

/**
 * 获取底牌张数。treasureMaster=3, thief=2, 无底牌角色=0。
 */
export function getBottomCardCount(roles: readonly RoleId[]): number {
  const bottomCardRole = getBottomCardRoleId(roles);
  if (bottomCardRole === 'treasureMaster') return BOTTOM_CARD_COUNT;
  if (bottomCardRole === 'thief') return THIEF_BOTTOM_CARD_COUNT;
  return 0;
}

/**
 * 计算实际玩家数（座位数）。
 * 含底牌角色时，roles 比座位多 N 张底牌。
 */
export function getPlayerCount(roles: readonly RoleId[]): number {
  return roles.length - getBottomCardCount(roles);
}

// Create custom template (roles are NOT shuffled here - shuffling happens at "分配角色")
export const createCustomTemplate = (roles: RoleId[]): GameTemplate => {
  return {
    name: '',
    numberOfPlayers: getPlayerCount(roles),
    roles: roles, // Keep original order, shuffle later when assigning roles
  };
};

// Create template from existing roles (for loading from database)
export const createTemplateFromRoles = (roles: RoleId[]): GameTemplate => ({
  name: '',
  numberOfPlayers: getPlayerCount(roles),
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
export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: '预女猎白',
    category: TemplateCategory.Classic,
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
    name: '狼美守卫',
    category: TemplateCategory.Classic,
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
      'knight',
      'guard',
    ],
  },
  {
    name: '狼王守卫',
    category: TemplateCategory.Classic,
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
    name: '白狼王守卫',
    category: TemplateCategory.Classic,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolfKing',
      'seer',
      'witch',
      'hunter',
      'guard',
    ],
  },
  {
    name: '石像鬼守墓人',
    category: TemplateCategory.Advanced,
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
    name: '梦魇守卫',
    category: TemplateCategory.Advanced,
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
    name: '血月猎魔',
    category: TemplateCategory.Advanced,
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
    name: '狼王摄梦人',
    category: TemplateCategory.Advanced,
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
    name: '狼王魔术师',
    category: TemplateCategory.Advanced,
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
    name: '机械狼通灵师',
    category: TemplateCategory.Advanced,
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
    name: '恶灵骑士',
    category: TemplateCategory.Advanced,
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
  {
    name: '纯白夜影',
    category: TemplateCategory.Special,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolfWitch',
      'guard',
      'witch',
      'hunter',
      'pureWhite',
    ],
  },
  {
    name: '灯影预言家',
    category: TemplateCategory.Special,
    roles: [
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'darkWolfKing',
      'seer',
      'mirrorSeer',
      'witch',
      'guard',
      'knight',
    ],
  },
  {
    name: '假面舞会',
    category: TemplateCategory.Special,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'masquerade',
      'seer',
      'witch',
      'dancer',
      'idiot',
    ],
  },
  {
    name: '吹笛者',
    category: TemplateCategory.ThirdParty,
    roles: [
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolf',
      'piper',
      'seer',
      'witch',
      'hunter',
      'guard',
    ],
  },
  {
    name: '预女猎白混',
    category: TemplateCategory.ThirdParty,
    roles: [
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolf',
      'slacker',
      'seer',
      'witch',
      'hunter',
      'idiot',
    ],
  },
  {
    name: '预女猎白野',
    category: TemplateCategory.ThirdParty,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wildChild',
      'seer',
      'witch',
      'hunter',
      'idiot',
    ],
  },
  {
    name: '唯邻是从',
    category: TemplateCategory.Special,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'awakenedGargoyle',
      'seer',
      'witch',
      'hunter',
      'guard',
      'graveyardKeeper',
    ],
  },
  {
    name: '孤注一掷',
    category: TemplateCategory.Special,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'warden',
      'seer',
      'witch',
      'hunter',
      'dreamcatcher',
    ],
  },
  {
    name: '影子复仇者',
    category: TemplateCategory.ThirdParty,
    roles: [
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'shadow',
      'avenger',
      'slacker',
      'seer',
      'witch',
      'guard',
    ],
  },
  {
    name: '盗宝大师',
    category: TemplateCategory.ThirdParty,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'darkWolfKing',
      'psychic',
      'poisoner',
      'hunter',
      'dreamcatcher',
      'maskedMan',
      'treasureMaster',
    ],
  },
  {
    name: '盗贼丘比特',
    category: TemplateCategory.ThirdParty,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'idiot',
      'thief',
      'cupid',
    ],
  },
  {
    name: '咒狐乌鸦',
    category: TemplateCategory.ThirdParty,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'darkWolfKing',
      'cursedFox',
      'seer',
      'witch',
      'hunter',
      'crow',
    ],
  },
];
