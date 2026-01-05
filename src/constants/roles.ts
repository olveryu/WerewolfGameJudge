// Role type definitions matching Flutter app
export type RoleType = 'wolf' | 'god' | 'villager' | 'special';

export type RoleName =
  | 'villager'
  | 'wolf'
  | 'wolfQueen'
  | 'wolfKing'
  | 'darkWolfKing'
  | 'nightmare'
  | 'gargoyle'
  | 'bloodMoon'
  | 'wolfRobot'
  | 'seer'
  | 'hunter'
  | 'witch'
  | 'guard'
  | 'idiot'
  | 'graveyardKeeper'
  | 'slacker'
  | 'knight'
  | 'celebrity'
  | 'magician'
  | 'witcher'
  | 'psychic';

export interface RoleDefinition {
  name: RoleName;
  displayName: string;
  type: RoleType;
  description: string;
  hasNightAction: boolean;
  actionOrder: number;
  actionMessage?: string;
  actionConfirmMessage?: string;
}

// All roles with action order matching Flutter's allActionOrder
export const ACTION_ORDER: RoleName[] = [
  'slacker',
  'wolfRobot',
  'magician',
  'celebrity',
  'gargoyle',
  'nightmare',
  'guard',
  'wolf',
  'wolfQueen',
  'witch',
  'seer',
  'psychic',
  'hunter',
  'darkWolfKing',
];

// Role definitions matching Flutter app
export const ROLES: Record<RoleName, RoleDefinition> = {
  villager: {
    name: 'villager',
    displayName: '普通村民',
    type: 'villager',
    description: '没有特殊能力，依靠推理和投票帮助好人阵营获胜',
    hasNightAction: false,
    actionOrder: -1,
  },
  wolf: {
    name: 'wolf',
    displayName: '狼人',
    type: 'wolf',
    description: '每晚与狼队友共同选择一名玩家猎杀',
    hasNightAction: true,
    actionOrder: 8,
    actionMessage: '请选择猎杀对象',
    actionConfirmMessage: '猎杀',
  },
  wolfQueen: {
    name: 'wolfQueen',
    displayName: '狼美人',
    type: 'wolf',
    description: '每晚参与袭击后可魅惑一名玩家，狼美人白天出局时被魅惑者随之殉情出局。被魅惑者不知情',
    hasNightAction: true,
    actionOrder: 9,
    actionMessage: '请选择魅惑对象',
    actionConfirmMessage: '魅惑',
  },
  wolfKing: {
    name: 'wolfKing',
    displayName: '白狼王',
    type: 'wolf',
    description: '白天可以自爆并带走一名玩家，被带走的玩家无遗言。非自爆出局不能发动技能',
    hasNightAction: false,
    actionOrder: -1,
  },
  darkWolfKing: {
    name: 'darkWolfKing',
    displayName: '黑狼王',
    type: 'wolf',
    description: '被刀杀时可以开枪带走一名玩家（狼人版猎人）',
    hasNightAction: true,
    actionOrder: 14,
    actionMessage: '请确认你的发动状态',
    actionConfirmMessage: '确认',
  },
  nightmare: {
    name: 'nightmare',
    displayName: '梦魇',
    type: 'wolf',
    description: '每晚可以封锁一名玩家，被封锁的玩家当晚技能失效',
    hasNightAction: true,
    actionOrder: 5,
    actionMessage: '请选择封锁对象',
    actionConfirmMessage: '封锁',
  },
  gargoyle: {
    name: 'gargoyle',
    displayName: '石像鬼',
    type: 'wolf',
    description: '每晚可以查验一名玩家是否为神职（不参与狼人刀人）',
    hasNightAction: true,
    actionOrder: 4,
    actionMessage: '请选择查验对象',
    actionConfirmMessage: '查验',
  },
  bloodMoon: {
    name: 'bloodMoon',
    displayName: '血月使徒',
    type: 'wolf',
    description: '第一晚随机获得一个神职技能，之后作为普通狼人',
    hasNightAction: false,
    actionOrder: -1,
  },
  wolfRobot: {
    name: 'wolfRobot',
    displayName: '机械狼',
    type: 'wolf',
    description: '第一晚必须查验一名玩家，被查验者知道自己被查（不参与狼人刀人）',
    hasNightAction: true,
    actionOrder: 1,
    actionMessage: '请选择查验对象',
    actionConfirmMessage: '查验',
  },
  seer: {
    name: 'seer',
    displayName: '预言家',
    type: 'god',
    description: '每晚可以查验一名玩家的身份，获知该玩家是好人还是狼人',
    hasNightAction: true,
    actionOrder: 11,
    actionMessage: '请选择查验对象',
    actionConfirmMessage: '查验',
  },
  hunter: {
    name: 'hunter',
    displayName: '猎人',
    type: 'god',
    description: '被狼人杀害或被投票放逐时，可以开枪带走一名玩家。被女巫毒死则不能开枪',
    hasNightAction: true,
    actionOrder: 13,
    actionMessage: '请确认你的发动状态',
    actionConfirmMessage: '确认',
  },
  witch: {
    name: 'witch',
    displayName: '女巫',
    type: 'god',
    description: '拥有一瓶解药和一瓶毒药，每晚可以选择救活被狼人袭击的玩家或毒死一名玩家，每瓶药只能使用一次',
    hasNightAction: true,
    actionOrder: 10,
    actionMessage: '请选择使用毒药或解药',
    actionConfirmMessage: '使用',
  },
  guard: {
    name: 'guard',
    displayName: '守卫',
    type: 'god',
    description: '每晚可以守护一名玩家使其不被狼人杀害，但不能连续两晚守护同一人。守卫无法防御女巫的毒药',
    hasNightAction: true,
    actionOrder: 6,
    actionMessage: '请选择守护对象',
    actionConfirmMessage: '守护',
  },
  idiot: {
    name: 'idiot',
    displayName: '白痴',
    type: 'god',
    description: '被投票放逐时可以翻牌免死，但之后不能投票和发动技能',
    hasNightAction: false,
    actionOrder: -1,
  },
  graveyardKeeper: {
    name: 'graveyardKeeper',
    displayName: '守墓人',
    type: 'god',
    description: '每晚可以查验一名死亡玩家的身份牌',
    hasNightAction: false,
    actionOrder: -1,
  },
  slacker: {
    name: 'slacker',
    displayName: '混子',
    type: 'special',
    description: '第一晚选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份',
    hasNightAction: true,
    actionOrder: 0,
    actionMessage: '请选择你的榜样',
    actionConfirmMessage: '确认',
  },
  knight: {
    name: 'knight',
    displayName: '骑士',
    type: 'god',
    description: '白天可以翻牌与一名玩家决斗，狼人死；若对方是好人，骑士死',
    hasNightAction: false,
    actionOrder: -1,
  },
  celebrity: {
    name: 'celebrity',
    displayName: '摄梦人',
    type: 'god',
    description: '每晚必须选择一名玩家成为梦游者，梦游者不知道自己正在梦游，且免疫夜间伤害。摄梦人夜间出局则梦游者一并出局，连续两晚成为梦游者也会出局',
    hasNightAction: true,
    actionOrder: 3,
    actionMessage: '请选择摄梦对象',
    actionConfirmMessage: '摄梦',
  },
  magician: {
    name: 'magician',
    displayName: '魔术师',
    type: 'god',
    description: '每晚可以交换两名玩家的身份牌（不改变座位）',
    hasNightAction: true,
    actionOrder: 2,
    actionMessage: '请选择两名交换对象',
    actionConfirmMessage: '交换',
  },
  witcher: {
    name: 'witcher',
    displayName: '猎魔人',
    type: 'god',
    description: '免疫女巫毒药，被毒不会死亡',
    hasNightAction: false,
    actionOrder: -1,
  },
  psychic: {
    name: 'psychic',
    displayName: '通灵师',
    type: 'god',
    description: '每晚可以查验一名玩家的具体身份牌（不只是阵营）',
    hasNightAction: true,
    actionOrder: 12,
    actionMessage: '请选择查验对象',
    actionConfirmMessage: '查验',
  },
};

// Role index for database serialization (matching Flutter)
export const ROLE_INDICES: Record<RoleName, number> = {
  villager: 0,
  wolf: 1,
  wolfQueen: 2,
  seer: 3,
  witch: 4,
  hunter: 5,
  guard: 6,
  slacker: 7,
  wolfKing: 8,
  nightmare: 9,
  gargoyle: 10,
  graveyardKeeper: 11,
  idiot: 12,
  knight: 15,
  celebrity: 16,
  magician: 19,
  witcher: 24,
  bloodMoon: 25,
  wolfRobot: 27,
  psychic: 28,
  darkWolfKing: 31,
};

export const indexToRole = (index: number): RoleName | null => {
  const entry = Object.entries(ROLE_INDICES).find(([, i]) => i === index);
  return entry ? (entry[0] as RoleName) : null;
};

export const roleToIndex = (role: RoleName): number => ROLE_INDICES[role];

// Helper functions
export const getWolfRoles = (): RoleDefinition[] =>
  Object.values(ROLES).filter((r) => r.type === 'wolf');

export const getGodRoles = (): RoleDefinition[] =>
  Object.values(ROLES).filter((r) => r.type === 'god');

export const getVillagerRoles = (): RoleDefinition[] =>
  Object.values(ROLES).filter((r) => r.type === 'villager');

export const getSpecialRoles = (): RoleDefinition[] =>
  Object.values(ROLES).filter((r) => r.type === 'special');

// Check if a role is a wolf (for night phase)
export const isWolfRole = (role: RoleName): boolean => {
  const wolfRoles: RoleName[] = [
    'wolf', 'wolfQueen', 'wolfKing', 'darkWolfKing', 'nightmare', 
    'gargoyle', 'bloodMoon', 'wolfRobot'
  ];
  return wolfRoles.includes(role);
};

// Skilled wolves that join wolf night
export const SKILLED_WOLF_TYPES: RoleName[] = [
  'wolfKing', 'darkWolfKing', 'wolfQueen', 'nightmare', 'bloodMoon'
];

// Get roles that have night actions, sorted by action order
export const getNightActionRoles = (): RoleDefinition[] =>
  Object.values(ROLES)
    .filter((r) => r.hasNightAction && r.actionOrder >= 0)
    .sort((a, b) => a.actionOrder - b.actionOrder);
