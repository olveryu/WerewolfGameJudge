import { RoleName, ACTION_ORDER, ROLES } from '../constants/roles';

export interface GameTemplate {
  name: string;
  numberOfPlayers: number;
  roles: RoleName[];
  actionOrder: RoleName[];
}

// Get action order based on roles in the template
const getActionOrderForRoles = (roles: RoleName[]): RoleName[] => {
  const roleSet = new Set(roles);
  return ACTION_ORDER.filter((role) => roleSet.has(role));
};

// Fisher-Yates shuffle
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Create custom template (matching Flutter's CustomTemplate.newGame)
export const createCustomTemplate = (roles: RoleName[]): GameTemplate => {
  // Shuffle roles with the special algorithm from Flutter
  const shuffledRoles = shuffleArray(roles);
  const firstHalf: RoleName[] = [];
  const secondHalf: RoleName[] = [];

  shuffledRoles.forEach((role, i) => {
    if (i % 2 === 0) {
      firstHalf.push(role);
    } else {
      secondHalf.push(role);
    }
  });

  const finalRoles = shuffleArray([
    ...shuffleArray(firstHalf),
    ...shuffleArray(secondHalf),
  ]);

  return {
    name: '',
    numberOfPlayers: roles.length,
    roles: finalRoles,
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
      'seer', 'witch', 'hunter', 'celebrity',
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
