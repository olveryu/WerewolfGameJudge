import { RoleName, ROLES, isValidRoleName, getActionOrderViaNightPlan } from './roles';

// ---------------------------------------------------------------------------
// Template validation
// ---------------------------------------------------------------------------

/** Minimum number of players for a valid template */
export const MINIMUM_PLAYERS = 2;

/**
 * Validate a list of roles for template creation.
 * Returns null if valid, otherwise a human-readable reason string.
 */
export function validateTemplateRoles(roles: RoleName[]): string | null {
  // Rule 1: must have at least MINIMUM_PLAYERS
  if (roles.length < MINIMUM_PLAYERS) {
    return `至少需要 ${MINIMUM_PLAYERS} 名玩家`;
  }

  // Rule 2: all roles must be valid RoleName (defensive, in case of external data)
  for (const r of roles) {
    if (!isValidRoleName(r)) {
      return `无效角色: ${r}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------

export interface GameTemplate {
  name: string;
  numberOfPlayers: number;
  roles: RoleName[];
  actionOrder: RoleName[];
}

/**
 * Get action order based on roles in the template.
 * Uses NightPlan-based implementation (new declarative path).
 * 
 * @deprecated Legacy internal function, use getActionOrderViaNightPlan directly
 */
const getActionOrderForRoles = (roles: RoleName[]): RoleName[] => {
  // New path: use NightPlan-based implementation
  return getActionOrderViaNightPlan(roles);
};

// Create custom template (roles are NOT shuffled here - shuffling happens at "准备看牌")
export const createCustomTemplate = (roles: RoleName[]): GameTemplate => {
  return {
    name: '',
    numberOfPlayers: roles.length,
    roles: roles,  // Keep original order, shuffle later when assigning roles
    actionOrder: getActionOrderForRoles(roles),
  };
};

// Create template from existing roles (for loading from database)
export const createTemplateFromRoles = (roles: RoleName[]): GameTemplate => ({
  name: '',
  numberOfPlayers: roles.length,
  roles,
  actionOrder: getActionOrderForRoles(roles),
});

// Check if template has skilled wolves
export const templateHasSkilledWolf = (template: GameTemplate): boolean => {
  const skilledWolves: RoleName[] = [
    'wolfKing',
    'darkWolfKing',
    'wolfQueen',
    'nightmare',
    'bloodMoon',
  ];
  return template.roles.some((role) => skilledWolves.includes(role));
};

// Predefined templates matching Flutter app
export const PRESET_TEMPLATES: { name: string; roles: RoleName[] }[] = [
  {
    name: '标准板12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'wolf',
      'seer', 'witch', 'hunter', 'idiot',
    ],
  },
  {
    name: '狼美守卫12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'wolfQueen',
      'seer', 'witch', 'hunter', 'guard',
    ],
  },
  {
    name: '狼王守卫12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'darkWolfKing',
      'seer', 'witch', 'hunter', 'guard',
    ],
  },
  {
    name: '石像鬼守墓人12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'gargoyle',
      'seer', 'witch', 'hunter', 'graveyardKeeper',
    ],
  },
  {
    name: '梦魇守卫12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'nightmare',
      'seer', 'witch', 'hunter', 'guard',
    ],
  },
  {
    name: '血月猎魔12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'bloodMoon',
      'seer', 'witch', 'idiot', 'witcher',
    ],
  },
  {
    name: '狼王摄梦人12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'darkWolfKing',
  'seer', 'witch', 'hunter', 'dreamcatcher',
    ],
  },
  {
    name: '狼王魔术师12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'darkWolfKing',
      'seer', 'witch', 'hunter', 'magician',
    ],
  },
  {
    name: '机械狼通灵师12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'wolfRobot',
      'psychic', 'witch', 'hunter', 'guard',
    ],
  },
  {
    name: '恶灵骑士12人',
    roles: [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'spiritKnight',
      'seer', 'witch', 'hunter', 'guard',
    ],
  },
];

// Get room info string (matching Flutter)
export const getTemplateRoomInfo = (template: GameTemplate): string => {
  const villagerCount = template.roles.filter((r) => r === 'villager').length;
  const wolfCount = template.roles.filter((r) => r === 'wolf').length;

  let info = `村民x${villagerCount}, 普狼x${wolfCount}, `;

  const specialRoles = template.roles.filter(
    (r) => r !== 'wolf' && r !== 'villager'
  );
  const uniqueSpecialRoles = [...new Set(specialRoles)];

  info += uniqueSpecialRoles.map((r) => ROLES[r].displayName).join(', ');

  return info;
};
