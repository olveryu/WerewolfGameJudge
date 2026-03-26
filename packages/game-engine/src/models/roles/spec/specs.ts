/**
 * Role Specs Registry - 角色固有属性表
 *
 * Single source of truth for all role definitions.
 * Derived from authoritative role files.
 *
 * 36 roles total:
 * - Villager faction: villager, mirrorSeer, drunkSeer (3)
 * - God faction: seer, witch, hunter, guard, idiot, knight, magician, witcher, psychic, dreamcatcher, graveyardKeeper, pureWhite, dancer, silenceElder, votebanElder (15)
 * - Wolf faction: wolf, wolfQueen, wolfKing, darkWolfKing, nightmare, gargoyle, awakenedGargoyle, bloodMoon, wolfRobot, wolfWitch, spiritKnight, masquerade, warden (13)
 * - Third-party: slacker, wildChild, piper, shadow, avenger (5)
 *
 * 提供声明式角色属性定义（faction / team / night1 / wolfMeeting 等），
 * 不依赖 service、不含副作用或 resolver 逻辑。
 */
import type { RoleSpec } from './spec.types';
import { Faction, Team } from './types';

export const ROLE_SPECS = {
  // ===================================================================
  // VILLAGER FACTION
  villager: {
    id: 'villager',
    displayName: '普通村民',
    shortName: '民',
    emoji: '👤',
    faction: Faction.Villager,
    team: Team.Good,
    description: '没有特殊技能，依靠推理和投票帮助好人阵营获胜',
    night1: { hasAction: false },
  },

  mirrorSeer: {
    id: 'mirrorSeer',
    displayName: '灯影预言家',
    shortName: '灯',
    emoji: '🪞',
    faction: Faction.Villager,
    team: Team.Good,
    description:
      '每晚可查验一名玩家的阵营，但结果与真实阵营相反；自身不知真实身份，以预言家身份示人',
    night1: { hasAction: true },
    displayAs: 'seer',
  },

  drunkSeer: {
    id: 'drunkSeer',
    displayName: '酒鬼预言家',
    shortName: '酒',
    emoji: '🍺🔮',
    faction: Faction.Villager,
    team: Team.Good,
    description:
      '每晚可查验一名玩家的阵营，但结果随机（50%正确/50%错误）；自身不知真实身份，以预言家身份示人',
    night1: { hasAction: true },
    displayAs: 'seer',
  },

  // ===================================================================
  // GOD FACTION
  // ===================================================================
  seer: {
    id: 'seer',
    displayName: '预言家',
    shortName: '预',
    emoji: '🔮',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
    night1: { hasAction: true },
  },

  witch: {
    id: 'witch',
    displayName: '女巫',
    shortName: '女',
    emoji: '🧙‍♀️',
    faction: Faction.God,
    team: Team.Good,
    description:
      '拥有一瓶解药和一瓶毒药，每晚可救活被狼人袭击的玩家或毒杀一名玩家；每瓶药限用一次，不能自救',
    night1: { hasAction: true },
    // Night-1-only: "女巫不能自救"规则在 schema.witchAction.save.constraints=['notSelf'] 中定义
  },

  hunter: {
    id: 'hunter',
    displayName: '猎人',
    shortName: '猎',
    emoji: '🏹',
    faction: Faction.God,
    team: Team.Good,
    description: '出局时可开枪带走一名玩家；被女巫毒杀则不能开枪',
    night1: { hasAction: true },
  },

  guard: {
    id: 'guard',
    displayName: '守卫',
    shortName: '守',
    emoji: '🛡️',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可守护一名玩家使其免受狼人袭击，不能连续两晚守护同一人；同时被守护和解药救活则仍然出局；无法防御女巫毒药',
    night1: { hasAction: true },
  },

  idiot: {
    id: 'idiot',
    displayName: '白痴',
    shortName: '白',
    emoji: '🤡',
    faction: Faction.God,
    team: Team.Good,
    description: '被投票放逐时可翻牌免死，此后失去投票权和技能使用权',
    night1: { hasAction: false },
  },

  knight: {
    id: 'knight',
    displayName: '骑士',
    shortName: '骑',
    emoji: '🗡️',
    faction: Faction.God,
    team: Team.Good,
    description: '白天可翻牌与一名玩家决斗：对方是狼人则对方出局，对方是好人则自身出局',
    night1: { hasAction: false },
  },

  magician: {
    id: 'magician',
    displayName: '魔术师',
    shortName: '术',
    emoji: '🎩',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚最先行动，交换两名玩家的号码牌，仅当晚有效',
    night1: { hasAction: true },
  },

  witcher: {
    id: 'witcher',
    displayName: '猎魔人',
    shortName: '魔',
    emoji: '🔪',
    faction: Faction.God,
    team: Team.Good,
    description:
      '从第二夜起，每晚可选择一名玩家狩猎：对方是狼人则对方次日出局，是好人则自身次日出局；免疫女巫毒药',
    // Night-1-only scope: witcher starts from night 2, so no night-1 action
    night1: { hasAction: false },
    flags: { immuneToPoison: true },
  },

  psychic: {
    id: 'psychic',
    displayName: '通灵师',
    shortName: '通',
    emoji: '👁️',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的身份，获知其具体角色名称',
    night1: { hasAction: true },
  },

  dreamcatcher: {
    id: 'dreamcatcher',
    displayName: '摄梦人',
    shortName: '摄',
    emoji: '🌙',
    englishName: 'Dreamcatcher',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可选择一名玩家成为梦游者，梦游者不知情且免疫夜间伤害；自身夜间出局则梦游者一并出局，连续两晚被摄梦也会出局',
    night1: { hasAction: true },
  },

  graveyardKeeper: {
    id: 'graveyardKeeper',
    displayName: '守墓人',
    shortName: '墓',
    emoji: '⚰️',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可得知上一个白天被放逐玩家的阵营（好人/狼人）',
    // Night-1-only scope: no "last day exile" on first night
    night1: { hasAction: false },
  },

  pureWhite: {
    id: 'pureWhite',
    displayName: '纯白之女',
    shortName: '纯',
    emoji: '🤍',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的身份，获知其具体角色名称；从第二夜起，查验到狼人则该狼人出局',
    night1: { hasAction: true },
  },

  dancer: {
    id: 'dancer',
    displayName: '舞者',
    shortName: '舞',
    emoji: '💃',
    faction: Faction.God,
    team: Team.Good,
    description:
      '从第二夜起，每晚必须选择三名玩家共舞（可含自身），若三人分属不同阵营则人数少的一方出局；仅当自身参舞时，舞池中三人当夜免疫狼人袭击；免疫女巫毒药',
    // Night-1-only scope: dancer starts from night 2, so no night-1 action
    night1: { hasAction: false },
    flags: { immuneToPoison: true },
  },

  silenceElder: {
    id: 'silenceElder',
    displayName: '禁言长老',
    shortName: '禁',
    emoji: '🤫',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可禁言一名玩家，使其次日发言阶段只能用肢体动作表达；不能连续两晚禁言同一人；禁言信息与死讯同时公布',
    night1: { hasAction: true },
  },

  votebanElder: {
    id: 'votebanElder',
    displayName: '禁票长老',
    shortName: '票',
    emoji: '🚫',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可禁票一名玩家，使其次日放逐环节不能投票；不能连续两晚禁票同一人；禁票信息与死讯同时公布',
    night1: { hasAction: true },
  },

  // ===================================================================
  // WOLF FACTION
  // ===================================================================
  wolf: {
    id: 'wolf',
    displayName: '狼人',
    shortName: '狼',
    emoji: '🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '每晚与狼队友共同选择一名玩家进行袭击',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  wolfQueen: {
    id: 'wolfQueen',
    displayName: '狼美人',
    shortName: '美',
    emoji: '👸🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '每晚可魅惑一名玩家；白天出局时被魅惑者随之殉情出局，被魅惑者不知情',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    flags: { immuneToWolfKill: true },
  },

  wolfKing: {
    id: 'wolfKing',
    displayName: '白狼王',
    shortName: '王',
    emoji: '👑🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '白天可自爆并带走一名玩家；非自爆出局时不能发动技能',
    // Day ability only, no night action
    night1: { hasAction: false },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  darkWolfKing: {
    id: 'darkWolfKing',
    displayName: '黑狼王',
    shortName: '黑',
    emoji: '🖤🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '出局时可开枪带走一名玩家；被女巫毒杀则不能开枪',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  nightmare: {
    id: 'nightmare',
    displayName: '梦魇',
    shortName: '魇',
    emoji: '😱',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '每晚在多数角色行动之前恐惧一名玩家，使其当夜无法使用技能；不能连续两晚恐惧同一人；首夜行动时尚未与狼队互认；若恐惧到狼人，狼人阵营当夜无法袭击',
    night1: { hasAction: true },
    // 狼人刀人阶段：互知+参刀
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  gargoyle: {
    id: 'gargoyle',
    displayName: '石像鬼',
    shortName: '石',
    emoji: '🗿',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '与其他狼人互不相认；每晚可查验一名玩家的身份，获知其具体角色名称；其他狼人全部出局后可主导袭击',
    night1: { hasAction: true },
    // 永远不互知不参刀
    wolfMeeting: { canSeeWolves: false, participatesInWolfVote: false },
  },

  awakenedGargoyle: {
    id: 'awakenedGargoyle',
    displayName: '觉醒石像鬼',
    shortName: '石',
    emoji: '🗿🔥',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '首夜必须选择一名与狼人阵营相邻的玩家转化至狼人阵营；被转化者天亮前知晓转变，不入狼队、不可自爆，保留自身技能；其他狼人全部出局后失去原技能并主导袭击',
    night1: { hasAction: true },
    // 入狼队参刀（区别于普通石像鬼）
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  bloodMoon: {
    id: 'bloodMoon',
    displayName: '血月使徒',
    shortName: '血',
    emoji: '🩸',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '自爆后的当晚所有好人阵营的技能被封印；若为最后一个被放逐的狼人，可存活至下一个白天天亮后才出局',
    // No night-1 action
    night1: { hasAction: false },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  wolfRobot: {
    id: 'wolfRobot',
    displayName: '机械狼',
    shortName: '机',
    emoji: '🤖🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '与其他狼人互不相认；首夜可学习一名玩家的技能并获知其身份，当夜不能使用，次夜可用；其他狼人全部出局后可主导袭击，不能自爆',
    night1: { hasAction: true },
    // 永远不互知不参刀
    wolfMeeting: { canSeeWolves: false, participatesInWolfVote: false },
  },

  wolfWitch: {
    id: 'wolfWitch',
    displayName: '狼巫',
    shortName: '巫',
    emoji: '🧙🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '每晚可查验一名非狼人阵营玩家的身份，获知其具体角色名称；从第二夜起，查验到纯白之女则其出局',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  spiritKnight: {
    id: 'spiritKnight',
    displayName: '恶灵骑士',
    shortName: '灵',
    emoji: '⚔️',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '永久免疫夜间伤害（无法被自刀、毒杀不死）；被预言家查验或女巫毒杀时反伤，次日对方出局；不能自爆，只能被放逐或猎人开枪带走',
    // No night action (passive ability)
    night1: { hasAction: false },
    // 互知+参刀
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    flags: { immuneToWolfKill: true, immuneToPoison: true, reflectsDamage: true },
  },

  masquerade: {
    id: 'masquerade',
    displayName: '假面',
    shortName: '假',
    emoji: '🎭🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '与其他狼人互不相认；从第二夜起可查看一名玩家是否在舞池中，并可赐予一名玩家面具使其共舞结算时阵营反转；其他狼人全部出局后可主导袭击；免疫女巫毒药',
    // Night-1-only scope: masquerade starts from night 2, so no night-1 action
    night1: { hasAction: false },
    // 不入狼队不参刀
    wolfMeeting: { canSeeWolves: false, participatesInWolfVote: false },
    flags: { immuneToPoison: true },
  },

  warden: {
    id: 'warden',
    displayName: '典狱长',
    shortName: '狱',
    emoji: '⛓️',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '从第二夜起，每晚选择2名玩家进行交易，随后与狼人共同袭击；双方得知对象但不知身份，各自选「交易」或「背叛」：同交易免夜间伤害，同背叛互为当夜技能目标，两人中一人选「交易」、另一人选「背叛」时，选了「交易」的那个人出局；选自身交易时，对方与自身同选则自身出局，不同则对方出局；每人限交易1次',
    // Night-1-only scope: warden starts from night 2, so no night-1 action
    night1: { hasAction: false },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  // ===================================================================
  // THIRD-PARTY FACTION
  // ===================================================================
  slacker: {
    id: 'slacker',
    displayName: '混子',
    shortName: '混',
    emoji: '😴',
    faction: Faction.Special,
    team: Team.Third, // Before choosing idol; seer sees "好人" (not "第三方")
    description: '首夜选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份',
    night1: { hasAction: true },
  },
  wildChild: {
    id: 'wildChild',
    displayName: '野孩子',
    shortName: '野',
    emoji: '👶',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜选择一名玩家作为榜样；榜样被投票出局时自身变为狼人，若先于榜样出局则始终为好人阵营',
    night1: { hasAction: true },
  },
  piper: {
    id: 'piper',
    displayName: '吹笛者',
    shortName: '笛',
    emoji: '🪈',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '每晚可选择 1~2 名玩家进行催眠，被催眠的玩家会醒来互相确认；当所有其他存活玩家均被催眠时获胜',
    night1: { hasAction: true },
  },
  shadow: {
    id: 'shadow',
    displayName: '影子',
    shortName: '影',
    emoji: '🌑',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜模仿一名玩家，目标出局后继承其身份和技能状态；模仿到复仇者时二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果；绑定胜利条件为屠城',
    night1: { hasAction: true },
  },
  avenger: {
    id: 'avenger',
    displayName: '复仇者',
    shortName: '仇',
    emoji: '⚔️',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜获知自身阵营，永远与影子模仿目标阵营对立；若影子模仿复仇者则二人绑定，失去原技能，成为同生共死第三方，胜利条件为屠城；非绑定时：出局可刺杀一名玩家，命中敌方有效、己方无效；命中未变身影子则单独胜利；帮好人时算神职，帮狼时与其他狼人互不相认，其他狼人全部出局后可主导袭击；预言家查验为好人',
    night1: { hasAction: true },
  },
} as const satisfies Record<string, RoleSpec>;

/** Role ID type (auto-derived from registry keys) */
export type RoleId = keyof typeof ROLE_SPECS;

/** Get spec by ID */
export function getRoleSpec<K extends RoleId>(id: K): (typeof ROLE_SPECS)[K] {
  return ROLE_SPECS[id];
}

/**
 * Get the displayAs target for a role.
 * Returns the RoleId the role masquerades as (for player-facing display),
 * or undefined if the role shows its own identity.
 */
export function getRoleDisplayAs(roleId: RoleId): RoleId | undefined {
  // Type-safe access: 'displayAs' is only present on some roles in the as-const literal
  const spec: RoleSpec = ROLE_SPECS[roleId];
  return spec.displayAs as RoleId | undefined;
}

/**
 * Get the emoji icon for a role (text character).
 * 用于纯文本场景（NightReview 行动摘要等）。
 * 卡片 UI 场景请使用 `getRoleBadge()` 获取 PNG badge image。
 */
export function getRoleEmoji(roleId: RoleId): string {
  return ROLE_SPECS[roleId].emoji;
}

/** Check if a string is a valid RoleId */
export function isValidRoleId(id: string): id is RoleId {
  return id in ROLE_SPECS;
}

/** Get all role IDs */
export function getAllRoleIds(): RoleId[] {
  return Object.keys(ROLE_SPECS) as RoleId[];
}

// Re-export types
export * from './spec.types';
