/**
 * Template - game template data model
 *
 * Defines the GameTemplate interface, template validation, preset templates, and template factories.
 * Exports type definitions, pure-function validators/factories, and preset constants. No service deps, side effects, or IO.
 */
import {
  countBottomCardRoles,
  getBottomCardCount,
  getBottomCardRoleId,
  getValidBottomCardDeals,
} from './BottomCards';
import { Faction, ROLE_SPECS, type RoleId } from './roles';

// ---------------------------------------------------------------------------
// Template categories (for grouped display in TemplatePicker)
// ---------------------------------------------------------------------------

export enum TemplateCategory {
  /** Classic boards (Seer/Witch/Hunter/Idiot, Wolf+Queen+Guard, Wolf King+Guard — beginner lineups) */
  Classic = 'classic',
  /** Advanced boards (Gargoyle, Blood Moon Witcher, etc. — lineups requiring experience) */
  Advanced = 'advanced',
  /** Special boards (Nightmare, Lampshade, Masquerade, etc. — unique mechanics) */
  Special = 'special',
  /** Third-party boards (Slacker, Piper, Wild Child, etc. — include third-party factions) */
  ThirdParty = 'thirdParty',
}

/** Template category -> Chinese label mapping. */
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  [TemplateCategory.Classic]: '经典',
  [TemplateCategory.Advanced]: '进阶',
  [TemplateCategory.Special]: '特色',
  [TemplateCategory.ThirdParty]: '第三方',
};

/** Preset board structure (name + role list + category). */
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
export function validateTemplateRoles(roles: readonly RoleId[]): string | null {
  const bottomCardRoleCount = countBottomCardRoles(roles);
  if (bottomCardRoleCount > 1) {
    return '盗贼与盗宝大师只能选择一个，且同一角色不能重复选择';
  }

  // Rule 1: must have at least MINIMUM_PLAYERS (actual players, excluding bottom cards)
  const playerCount = getPlayerCount(roles);
  if (playerCount < MINIMUM_PLAYERS) {
    return `至少需要 ${MINIMUM_PLAYERS} 名玩家`;
  }

  const roleCounts = new Map<RoleId, number>();
  for (const roleId of roles) {
    const count = (roleCounts.get(roleId) ?? 0) + 1;
    roleCounts.set(roleId, count);
    if (count > 1 && roleId !== 'wolf' && ROLE_SPECS[roleId].nightSteps?.length) {
      return `${ROLE_SPECS[roleId].displayName}不能重复选择`;
    }
  }

  // Rule 2: treasureMaster bottom card constraint prerequisites
  // Bottom cards require exactly 1 wolf (regular) + 1 god + 1 villager.
  // If template cannot provide these, dealing will always fail.
  if (roles.includes('treasureMaster')) {
    const otherRoles = roles.filter((roleId) => roleId !== 'treasureMaster');
    const hasRegularWolf = otherRoles.includes('wolf');
    const hasGod = otherRoles.some((r) => ROLE_SPECS[r].faction === Faction.God);
    const hasVillager = otherRoles.some((r) => ROLE_SPECS[r].faction === Faction.Villager);
    if (!hasRegularWolf) {
      return '含宝藏猎人时必须有至少 1 名普通狼人（底牌需要）';
    }
    if (!hasGod) {
      return '含宝藏猎人时必须有至少 1 名神职（底牌需要）';
    }
    if (!hasVillager) {
      return '含宝藏猎人时必须有至少 1 名村民（底牌需要）';
    }
  }

  const bottomCardRoleId = getBottomCardRoleId(roles);
  if (bottomCardRoleId !== null && getValidBottomCardDeals(roles, bottomCardRoleId).length === 0) {
    return `当前角色组合无法为${bottomCardRoleId === 'thief' ? '盗贼' : '盗宝大师'}发出合法底牌`;
  }

  return null;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Game rule overrides (house rules / variant toggles)
// ---------------------------------------------------------------------------

/** Rule overrides that can be toggled per-room. */
export interface GameRuleOverrides {
  /** Plague mode: all wolf-faction roles replaced with villager during dealing */
  isPlagueMode?: boolean;
  /** Run the first-day sheriff election after the first night (default for new games: true). */
  isSheriffElectionEnabled?: boolean;
  /** Allow witch to save herself (default: false — witch cannot self-heal) */
  witchCanSelfHeal?: boolean;
}

/**
 * GameTemplate - defines the player composition for a game.
 *
 * Night action order is derived dynamically from roles via buildNightPlan(roles).
 */
export interface GameTemplate {
  name: string;
  numberOfPlayers: number;
  roles: RoleId[];
  /** Game rule overrides (plague mode, witch self-heal, etc.) */
  rules?: GameRuleOverrides;
}

/** Build the physical role-card pool used by assignment. */
export function getRoleDealPool(roles: readonly RoleId[], rules?: GameRuleOverrides): RoleId[] {
  if (rules?.isPlagueMode !== true) return [...roles];
  return roles.map((roleId) =>
    ROLE_SPECS[roleId].faction === Faction.Wolf || roleId === 'treasureMaster'
      ? 'villager'
      : roleId,
  );
}

/**
 * Compute the actual player count (seat count).
 * When a deck-card role is present, roles has N extra deck cards beyond seats.
 */
export function getPlayerCount(roles: readonly RoleId[]): number {
  return roles.length - getBottomCardCount(roles);
}

/** Create a custom template from a role list (no shuffle; shuffle later when assigning roles). */
export const createCustomTemplate = (roles: RoleId[]): GameTemplate => {
  return {
    name: '',
    numberOfPlayers: getPlayerCount(roles),
    roles: roles, // Keep original order, shuffle later when assigning roles
  };
};

/** Rebuild a template from an existing role list (used by database load). */
export const createTemplateFromRoles = (roles: RoleId[]): GameTemplate => ({
  name: '',
  numberOfPlayers: getPlayerCount(roles),
  roles,
});

/**
 * Find matching preset name for given roles.
 * Returns the preset name if roles match exactly (sorted), otherwise null.
 */
export const findMatchingPresetName = (roles: readonly RoleId[]): string | null => {
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

/**
 * Find the closest matching preset by multiset similarity.
 *
 * Similarity = |multiset intersection| / max(|A|, |B|).
 * Only considers presets whose names appear in `candidateNames` (if provided).
 * Returns the best match name if similarity >= threshold, otherwise null.
 */
export const findClosestPresetName = (
  roles: RoleId[],
  threshold = 0.7,
  candidateNames?: ReadonlySet<string>,
): string | null => {
  const roleCounts = toMultiset(roles);
  let bestName: string | null = null;
  let bestScore = threshold; // only beat threshold to qualify

  for (const preset of PRESET_TEMPLATES) {
    if (candidateNames && !candidateNames.has(preset.name)) continue;

    const presetCounts = toMultiset(preset.roles);
    const intersection = multisetIntersectionSize(roleCounts, presetCounts);
    const maxLen = Math.max(roles.length, preset.roles.length);
    if (maxLen === 0) continue;

    const score = intersection / maxLen;
    if (score > bestScore) {
      bestScore = score;
      bestName = preset.name;
    }
  }

  return bestName;
};

/** Convert array to multiset (Map<element, count>) */
const toMultiset = (arr: readonly string[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const item of arr) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return map;
};

/** Compute |A ∩ B| for two multisets (min-count intersection) */
const multisetIntersectionSize = (a: Map<string, number>, b: Map<string, number>): number => {
  let count = 0;
  for (const [key, countA] of a) {
    const countB = b.get(key);
    if (countB !== undefined) {
      count += Math.min(countA, countB);
    }
  }
  return count;
};

/** Registry of all preset boards. */
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
    name: '噩梦之影守卫',
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
    name: '机械狼人通灵师',
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
  {
    name: '永序之轮',
    category: TemplateCategory.Advanced,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'eclipseWolfQueen',
      'seer',
      'witch',
      'guard',
      'sequencePrince',
    ],
  },
  {
    name: '隐狼乌鸦',
    category: TemplateCategory.Advanced,
    roles: [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'hiddenWolf',
      'seer',
      'witch',
      'hunter',
      'crow',
    ],
  },
];
