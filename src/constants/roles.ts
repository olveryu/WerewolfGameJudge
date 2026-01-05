// Role type definitions
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
  | 'spiritKnight'
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
  actionMessage?: string;
  actionConfirmMessage?: string;
}

// Night action order (roles act in this sequence)
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

// Role definitions
export const ROLES: Record<RoleName, RoleDefinition> = {
  villager: {
    name: 'villager',
    displayName: '普通村民',
    type: 'villager',
    description: '没有特殊能力，依靠推理和投票帮助好人阵营获胜',
  },
  wolf: {
    name: 'wolf',
    displayName: '狼人',
    type: 'wolf',
    description: '每晚与狼队友共同选择一名玩家猎杀',
    actionMessage: '请选择猎杀对象',
    actionConfirmMessage: '猎杀',
  },
  wolfQueen: {
    name: 'wolfQueen',
    displayName: '狼美人',
    type: 'wolf',
    description: '每晚参与袭击后可魅惑一名玩家，狼美人白天出局时被魅惑者随之殉情出局。被魅惑者不知情',
    actionMessage: '请选择魅惑对象',
    actionConfirmMessage: '魅惑',
  },
  wolfKing: {
    name: 'wolfKing',
    displayName: '白狼王',
    type: 'wolf',
    description: '白天可以自爆并带走一名玩家，被带走的玩家无遗言。非自爆出局不能发动技能',
  },
  darkWolfKing: {
    name: 'darkWolfKing',
    displayName: '黑狼王',
    type: 'wolf',
    description: '被刀杀时可以开枪带走一名玩家（狼人版猎人）',
    actionMessage: '请确认你的发动状态',
    actionConfirmMessage: '确认',
  },
  nightmare: {
    name: 'nightmare',
    displayName: '梦魇',
    type: 'wolf',
    description: '每晚可以封锁一名玩家，被封锁的玩家当晚技能失效',
    actionMessage: '请选择封锁对象',
    actionConfirmMessage: '封锁',
  },
  gargoyle: {
    name: 'gargoyle',
    displayName: '石像鬼',
    type: 'wolf',
    description: '每晚可以查验一名玩家是否为神职（不参与狼人刀人）',
    actionMessage: '请选择查验对象',
    actionConfirmMessage: '查验',
  },
  bloodMoon: {
    name: 'bloodMoon',
    displayName: '血月使徒',
    type: 'wolf',
    description: '第一晚随机获得一个神职技能，之后作为普通狼人',
  },
  wolfRobot: {
    name: 'wolfRobot',
    displayName: '机械狼',
    type: 'wolf',
    description: '与普通狼人互不相认，第一晚最早睁眼学习任一玩家技能并获得其身份，当夜不能使用，下一夜可用。普通狼人全死后带刀，不能自爆（不参与狼人刀人）',
    actionMessage: '请选择学习对象',
    actionConfirmMessage: '学习',
  },
  spiritKnight: {
    name: 'spiritKnight',
    displayName: '恶灵骑士',
    type: 'wolf',
    description: '永久免疫夜间伤害（无法自刀、吃毒不死）。被预言家查验或女巫毒杀，则次日对方神职死亡（反伤）。不能自爆，只能被放逐或猎人枪杀',
  },
  seer: {
    name: 'seer',
    displayName: '预言家',
    type: 'god',
    description: '每晚可以查验一名玩家的身份，获知该玩家是好人还是狼人',
    actionMessage: '请选择查验对象',
    actionConfirmMessage: '查验',
  },
  hunter: {
    name: 'hunter',
    displayName: '猎人',
    type: 'god',
    description: '被狼人杀害或被投票放逐时，可以开枪带走一名玩家。被女巫毒死则不能开枪',
    actionMessage: '请确认你的发动状态',
    actionConfirmMessage: '确认',
  },
  witch: {
    name: 'witch',
    displayName: '女巫',
    type: 'god',
    description: '拥有一瓶解药和一瓶毒药，每晚可以选择救活被狼人袭击的玩家或毒死一名玩家，每瓶药只能使用一次',
    actionMessage: '请选择使用毒药或解药',
    actionConfirmMessage: '使用',
  },
  guard: {
    name: 'guard',
    displayName: '守卫',
    type: 'god',
    description: '每晚可以守护一名玩家使其不被狼人杀害，但不能连续两晚守护同一人。守卫无法防御女巫的毒药',
    actionMessage: '请选择守护对象',
    actionConfirmMessage: '守护',
  },
  idiot: {
    name: 'idiot',
    displayName: '白痴',
    type: 'god',
    description: '被投票放逐时可以翻牌免死，但之后不能投票和发动技能',
  },
  graveyardKeeper: {
    name: 'graveyardKeeper',
    displayName: '守墓人',
    type: 'god',
    description: '每晚可以查验一名死亡玩家的身份牌',
  },
  slacker: {
    name: 'slacker',
    displayName: '混子',
    type: 'special',
    description: '第一晚选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份',
    actionMessage: '请选择你的榜样',
    actionConfirmMessage: '确认',
  },
  knight: {
    name: 'knight',
    displayName: '骑士',
    type: 'god',
    description: '白天可以翻牌与一名玩家决斗，狼人死；若对方是好人，骑士死',
  },
  celebrity: {
    name: 'celebrity',
    displayName: '摄梦人',
    type: 'god',
    description: '每晚必须选择一名玩家成为梦游者，梦游者不知道自己正在梦游，且免疫夜间伤害。摄梦人夜间出局则梦游者一并出局，连续两晚成为梦游者也会出局',
    actionMessage: '请选择摄梦对象',
    actionConfirmMessage: '摄梦',
  },
  magician: {
    name: 'magician',
    displayName: '魔术师',
    type: 'god',
    description: '每晚在其他所有人之前行动，交换2个人的号码牌，当晚有效',
    actionMessage: '请选择两名交换对象',
    actionConfirmMessage: '交换',
  },
  witcher: {
    name: 'witcher',
    displayName: '猎魔人',
    type: 'god',
    description: '从第二晚开始，每晚可选择一名玩家狩猎。若对方是狼人则次日对方出局，若对方是好人则次日猎魔人出局。女巫毒药对猎魔人无效',
  },
  psychic: {
    name: 'psychic',
    displayName: '通灵师',
    type: 'god',
    description: '每晚可以查验一名玩家的具体身份牌（不只是阵营）',
    actionMessage: '请选择查验对象',
    actionConfirmMessage: '查验',
  },
};

// Check if a role is a wolf (for night phase)
export const isWolfRole = (role: RoleName): boolean => {
  const wolfRoles: RoleName[] = [
    'wolf', 'wolfQueen', 'wolfKing', 'darkWolfKing', 'nightmare', 
    'gargoyle', 'bloodMoon', 'wolfRobot'
  ];
  return wolfRoles.includes(role);
};

// Check if a role has night action (derived from ACTION_ORDER)
export const hasNightAction = (role: RoleName): boolean =>
  ACTION_ORDER.includes(role);
