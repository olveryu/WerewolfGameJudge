/**
 * Role Specs Registry - 角色固有属性表
 *
 * Single source of truth for all role definitions.
 * Derived from authoritative role files.
 *
 * 27 roles total:
 * - Villager faction: villager, mirrorSeer, drunkSeer (3)
 * - God faction: seer, witch, hunter, guard, idiot, knight, magician, witcher, psychic, dreamcatcher, graveyardKeeper, pureWhite (12)
 * - Wolf faction: wolf, wolfQueen, wolfKing, darkWolfKing, nightmare, gargoyle, bloodMoon, wolfRobot, wolfWitch, spiritKnight (10)
 * - Third-party: slacker, wildChild (2)
 *
 * 提供声明式角色属性定义（faction / team / night1 / wolfMeeting 等），
 * 不依赖 service、不含副作用或 resolver 逻辑。
 */
import type { RoleSpec } from './spec.types';
import { Faction } from './types';

export const ROLE_SPECS = {
  // ===================================================================
  // VILLAGER FACTION
  villager: {
    id: 'villager',
    displayName: '普通村民',
    shortName: '民',
    faction: Faction.Villager,
    team: 'good',
    description: '没有特殊能力，依靠推理和投票帮助好人阵营获胜',
    night1: { hasAction: false },
  },

  mirrorSeer: {
    id: 'mirrorSeer',
    displayName: '灯影预言家',
    shortName: '灯',
    faction: Faction.Villager,
    team: 'good',
    description:
      '每晚可以查验一名玩家的身份阵营，但查验结果与玩家真实阵营相反。灯影预言家无法知晓自己的真实身份，拿到的身份是预言家',
    night1: { hasAction: true },
    displayAs: 'seer',
  },

  drunkSeer: {
    id: 'drunkSeer',
    displayName: '酒鬼预言家',
    shortName: '酒',
    faction: Faction.Villager,
    team: 'good',
    description:
      '每晚可以查验一名玩家的身份阵营，但查验结果随机（50%正确/50%错误）。酒鬼预言家无法知晓自己的真实身份，拿到的身份是预言家',
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
    faction: Faction.God,
    team: 'good',
    description: '每晚可以查验一名玩家的身份，获知该玩家是好人还是狼人',
    night1: { hasAction: true },
  },

  witch: {
    id: 'witch',
    displayName: '女巫',
    shortName: '女',
    faction: Faction.God,
    team: 'good',
    description:
      '拥有一瓶解药和一瓶毒药，每晚可以选择救活被狼人袭击的玩家或毒死一名玩家，每瓶药只能使用一次',
    night1: { hasAction: true },
    // Night-1-only: "女巫不能自救"规则在 schema.witchAction.save.constraints=['notSelf'] 中定义
  },

  hunter: {
    id: 'hunter',
    displayName: '猎人',
    shortName: '猎',
    faction: Faction.God,
    team: 'good',
    description: '被狼人杀害时，可以开枪带走一名玩家。被女巫毒死则不能开枪',
    night1: { hasAction: true },
  },

  guard: {
    id: 'guard',
    displayName: '守卫',
    shortName: '守',
    faction: Faction.God,
    team: 'good',
    description:
      '每晚可以守护一名玩家使其不被狼人杀害，但不能连续两晚守护同一人。守卫无法防御女巫的毒药',
    night1: { hasAction: true },
  },

  idiot: {
    id: 'idiot',
    displayName: '白痴',
    shortName: '白',
    faction: Faction.God,
    team: 'good',
    description: '被投票放逐时可以翻牌免死，但之后不能投票和发动技能',
    night1: { hasAction: false },
  },

  knight: {
    id: 'knight',
    displayName: '骑士',
    shortName: '骑',
    faction: Faction.God,
    team: 'good',
    description: '白天可以翻牌与一名玩家决斗，狼人死；若对方是好人，骑士死',
    night1: { hasAction: false },
  },

  magician: {
    id: 'magician',
    displayName: '魔术师',
    shortName: '术',
    faction: Faction.God,
    team: 'good',
    description: '每晚在其他所有人之前行动，交换2个人的号码牌，当晚有效',
    night1: { hasAction: true },
  },

  witcher: {
    id: 'witcher',
    displayName: '猎魔人',
    shortName: '魔',
    faction: Faction.God,
    team: 'good',
    description:
      '从第二晚开始，每晚可选择一名玩家狩猎。若对方是狼人则次日对方出局，若对方是好人则次日猎魔人出局。女巫毒药对猎魔人无效',
    // Night-1-only scope: witcher starts from night 2, so no night-1 action
    night1: { hasAction: false },
  },

  psychic: {
    id: 'psychic',
    displayName: '通灵师',
    shortName: '通',
    faction: Faction.God,
    team: 'good',
    description: '每晚可以查验一名玩家的具体身份牌（不只是阵营）',
    night1: { hasAction: true },
  },

  dreamcatcher: {
    id: 'dreamcatcher',
    displayName: '摄梦人',
    shortName: '摄',
    englishName: 'Dreamcatcher',
    faction: Faction.God,
    team: 'good',
    description:
      '每晚可以选择一名玩家成为梦游者，梦游者不知道自己正在梦游，且免疫夜间伤害。摄梦人夜间出局则梦游者一并出局，连续两晚成为梦游者也会出局',
    night1: { hasAction: true },
  },

  graveyardKeeper: {
    id: 'graveyardKeeper',
    displayName: '守墓人',
    shortName: '墓',
    faction: Faction.God,
    team: 'good',
    description: '每晚可以得知上一个白天被放逐的玩家是好人或狼人',
    // Night-1-only scope: no "last day exile" on first night
    night1: { hasAction: false },
  },

  pureWhite: {
    id: 'pureWhite',
    displayName: '纯白之女',
    shortName: '纯',
    faction: Faction.God,
    team: 'good',
    description: '每晚可以查验一名玩家的具体身份。从第二夜起，查验到狼人则该狼人被查验出局',
    night1: { hasAction: true },
  },

  // ===================================================================
  // WOLF FACTION
  // ===================================================================
  wolf: {
    id: 'wolf',
    displayName: '狼人',
    shortName: '狼',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '每晚与狼队友共同选择一名玩家猎杀',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  wolfQueen: {
    id: 'wolfQueen',
    displayName: '狼美人',
    shortName: '美',
    faction: Faction.Wolf,
    team: 'wolf',
    description:
      '每晚参与袭击后可魅惑一名玩家，狼美人白天出局时被魅惑者随之殉情出局。被魅惑者不知情',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    flags: { immuneToWolfKill: true },
  },

  wolfKing: {
    id: 'wolfKing',
    displayName: '白狼王',
    shortName: '王',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '白天可以自爆并带走一名玩家，被带走的玩家无遗言。非自爆出局不能发动技能',
    // Day ability only, no night action
    night1: { hasAction: false },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  darkWolfKing: {
    id: 'darkWolfKing',
    displayName: '黑狼王',
    shortName: '黑',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '被刀杀时可以开枪带走一名玩家（狼人版猎人）',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  nightmare: {
    id: 'nightmare',
    displayName: '梦魇',
    shortName: '魇',
    faction: Faction.Wolf,
    team: 'wolf',
    description:
      '每晚在所有人行动之前恐惧一名玩家，使其当夜无法使用技能。不能连续两晚恐惧同一名玩家。首夜进行恐惧时与其他狼人不互知身份；若首夜选择到狼人，则狼人阵营当夜不能刀人。',
    night1: { hasAction: true },
    // 狼人刀人阶段：互知+参刀
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    flags: { blocksSkill: true },
  },

  gargoyle: {
    id: 'gargoyle',
    displayName: '石像鬼',
    shortName: '石',
    faction: Faction.Wolf,
    team: 'wolf',
    description:
      '每晚可以查验一名玩家的具体身份。当其他所有狼人出局后，可在夜间进行袭击。石像鬼不参与狼人投票。',
    night1: { hasAction: true },
    // 永远不互知不参刀
    wolfMeeting: { canSeeWolves: false, participatesInWolfVote: false },
  },

  bloodMoon: {
    id: 'bloodMoon',
    displayName: '血月使徒',
    shortName: '血',
    faction: Faction.Wolf,
    team: 'wolf',
    description:
      '血月使徒自爆后的当晚所有好人的技能都将会被封印，若血月使徒是最后一个被放逐出局的狼人，他可以存活到下一个白天天亮之后才出局。',
    // No night-1 action
    night1: { hasAction: false },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  wolfRobot: {
    id: 'wolfRobot',
    displayName: '机械狼',
    shortName: '机',
    faction: Faction.Wolf,
    team: 'wolf',
    description:
      '与普通狼人互不相认，第一晚最早睁眼学习任一玩家技能并获得其身份，当夜不能使用，下一夜可用。普通狼人全死后带刀，不能自爆（不参与狼人刀人）',
    night1: { hasAction: true },
    // 永远不互知不参刀
    wolfMeeting: { canSeeWolves: false, participatesInWolfVote: false },
  },

  wolfWitch: {
    id: 'wolfWitch',
    displayName: '狼巫',
    shortName: '巫',
    faction: Faction.Wolf,
    team: 'wolf',
    description:
      '每晚可以查验场上除狼人阵营外一名玩家的具体身份。从第二夜起，验到纯白之女则纯白之女被查验出局',
    night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
  },

  spiritKnight: {
    id: 'spiritKnight',
    displayName: '恶灵骑士',
    shortName: '灵',
    faction: Faction.Wolf,
    team: 'wolf',
    description:
      '永久免疫夜间伤害（无法自刀、吃毒不死）。被预言家查验或女巫毒杀，则次日对方神职死亡（反伤）。不能自爆，只能被放逐或猎人枪杀',
    // No night action (passive ability)
    night1: { hasAction: false },
    // 互知+参刀
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    flags: { immuneToNightDamage: true, reflectsDamage: true, immuneToWolfKill: true },
  },

  // ===================================================================
  // THIRD-PARTY FACTION
  // ===================================================================
  slacker: {
    id: 'slacker',
    displayName: '混子',
    shortName: '混',
    faction: Faction.Special,
    team: 'third', // Before choosing idol; seer sees "好人" (not "第三方")
    description: '第一晚选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份',
    night1: { hasAction: true },
  },
  wildChild: {
    id: 'wildChild',
    displayName: '野孩子',
    shortName: '野',
    faction: Faction.Special,
    team: 'third',
    description:
      '第一晚选择一名玩家作为榜样。当榜样被投票出局时，野孩子变为狼人。若野孩子先于榜样死亡，则始终为好人阵营',
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
