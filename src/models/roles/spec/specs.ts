/**
 * Role Specs Registry
 * 
 * Single source of truth for all role definitions.
 * Derived from authoritative role files.
 * 
 * 22 roles total:
 * - Villager faction: villager (1)
 * - God faction: seer, witch, hunter, guard, idiot, knight, magician, witcher, psychic, dreamcatcher, graveyardKeeper (11)
 * - Wolf faction: wolf, wolfQueen, wolfKing, darkWolfKing, nightmare, gargoyle, bloodMoon, wolfRobot, spiritKnight (9)
 * - Third-party: slacker (1)
 */
import type { RoleSpec } from './spec.types';
import { Faction } from './types';
import { NIGHT_STEPS } from './nightSteps';

export const ROLE_SPECS = {
  // ===================================================================
  // VILLAGER FACTION
  villager: {
    id: 'villager',
    displayName: '普通村民',
    faction: Faction.Villager,
    team: 'good',
    description: '没有特殊能力，依靠推理和投票帮助好人阵营获胜',
    night1: { hasAction: false },
    ux: {},
  },

  // ===================================================================
  // GOD FACTION
  // ===================================================================
  seer: {
    id: 'seer',
    displayName: '预言家',
    faction: Faction.God,
    team: 'good',
    description: '每晚可以查验一名玩家的身份，获知该玩家是好人还是狼人',
    night1: { hasAction: true },
    ux: {
      actionMessage: '请选择查验对象',
      actionConfirmMessage: '查验',
    },
  },

  witch: {
    id: 'witch',
    displayName: '女巫',
    faction: Faction.God,
    team: 'good',
    description: '拥有一瓶解药和一瓶毒药，每晚可以选择救活被狼人袭击的玩家或毒死一名玩家，每瓶药只能使用一次',
    night1: { hasAction: true },
    // Night-1-only: "女巫不能自救"规则已在 schema.witchAction.save.constraints=['notSelf'] 中定义
    // 不再使用 flags.canSaveSelf，避免双写漂移
    ux: {
      actionMessage: '请选择使用毒药或解药',
      actionConfirmMessage: '使用',
    },
  },

  hunter: {
    id: 'hunter',
    displayName: '猎人',
    faction: Faction.God,
    team: 'good',
    description: '被狼人杀害时，可以开枪带走一名玩家。被女巫毒死则不能开枪',
  night1: { hasAction: true },
    ux: {
      actionMessage: '请确认你的发动状态',
      actionConfirmMessage: '确认',
    },
  },

  guard: {
    id: 'guard',
    displayName: '守卫',
    faction: Faction.God,
    team: 'good',
    description: '每晚可以守护一名玩家使其不被狼人杀害，但不能连续两晚守护同一人。守卫无法防御女巫的毒药',
  night1: { hasAction: true },
    ux: {
      actionMessage: '请选择守护对象',
      actionConfirmMessage: '守护',
    },
  },

  idiot: {
    id: 'idiot',
    displayName: '白痴',
    faction: Faction.God,
    team: 'good',
    description: '被投票放逐时可以翻牌免死，但之后不能投票和发动技能',
    night1: { hasAction: false },
    ux: {},
  },

  knight: {
    id: 'knight',
    displayName: '骑士',
    faction: Faction.God,
    team: 'good',
    description: '白天可以翻牌与一名玩家决斗，狼人死；若对方是好人，骑士死',
    night1: { hasAction: false },
    ux: {},
  },

  magician: {
    id: 'magician',
    displayName: '魔术师',
    faction: Faction.God,
    team: 'good',
    description: '每晚在其他所有人之前行动，交换2个人的号码牌，当晚有效',
  night1: { hasAction: true },
    ux: {
      actionMessage: '请选择两名交换对象',
      actionConfirmMessage: '交换',
    },
  },

  witcher: {
    id: 'witcher',
    displayName: '猎魔人',
    faction: Faction.God,
    team: 'good',
    description: '从第二晚开始，每晚可选择一名玩家狩猎。若对方是狼人则次日对方出局，若对方是好人则次日猎魔人出局。女巫毒药对猎魔人无效',
    // Night-1-only scope: witcher starts from night 2, so no night-1 action
    night1: { hasAction: false },
    ux: {},
  },

  psychic: {
    id: 'psychic',
    displayName: '通灵师',
    faction: Faction.God,
    team: 'good',
    description: '每晚可以查验一名玩家的具体身份牌（不只是阵营）',
  night1: { hasAction: true },
    ux: {
      actionMessage: '请选择查验对象',
      actionConfirmMessage: '查验',
    },
  },

  dreamcatcher: {
    id: 'dreamcatcher',
    displayName: '摄梦人',
    englishName: 'Dreamcatcher',
    faction: Faction.God,
    team: 'good',
    description: '每晚必须选择一名玩家成为梦游者，梦游者不知道自己正在梦游，且免疫夜间伤害。摄梦人夜间出局则梦游者一并出局，连续两晚成为梦游者也会出局',
  night1: { hasAction: true },
    ux: {
      actionMessage: '请选择摄梦对象',
      actionConfirmMessage: '摄梦',
    },
  },

  graveyardKeeper: {
    id: 'graveyardKeeper',
    displayName: '守墓人',
    faction: Faction.God,
    team: 'good',
    description: '每晚可以得知上一个白天被放逐的玩家是好人或狼人',
    // Night-1-only scope: no "last day exile" on first night
    night1: { hasAction: false },
    ux: {},
  },

  // ===================================================================
  // WOLF FACTION
  // ===================================================================
  wolf: {
    id: 'wolf',
    displayName: '狼人',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '每晚与狼队友共同选择一名玩家猎杀',
  night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    ux: {
      actionMessage: '请选择猎杀对象',
      actionConfirmMessage: '猎杀',
    },
  },

  wolfQueen: {
    id: 'wolfQueen',
    displayName: '狼美人',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '每晚参与袭击后可魅惑一名玩家，狼美人白天出局时被魅惑者随之殉情出局。被魅惑者不知情',
  night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    ux: {
      actionMessage: '请选择魅惑对象',
      actionConfirmMessage: '魅惑',
    },
  },

  wolfKing: {
    id: 'wolfKing',
    displayName: '白狼王',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '白天可以自爆并带走一名玩家，被带走的玩家无遗言。非自爆出局不能发动技能',
    // Day ability only, no night action
    night1: { hasAction: false },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    ux: {},
  },

  darkWolfKing: {
    id: 'darkWolfKing',
    displayName: '黑狼王',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '被刀杀时可以开枪带走一名玩家（狼人版猎人）',
  night1: { hasAction: true },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    ux: {
      actionMessage: '请确认你的发动状态',
      actionConfirmMessage: '确认',
    },
  },

  nightmare: {
    id: 'nightmare',
    displayName: '梦魇',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '每晚在所有人行动之前恐惧一名玩家，使其当夜无法使用技能。不能连续两晚恐惧同一名玩家。首夜进行恐惧时与其他狼人不互知身份；若首夜选择到狼人，则狼人阵营当夜不能刀人。',
  night1: { hasAction: true },
    // 狼人刀人阶段：互知+参刀
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    flags: { blocksSkill: true },
    ux: {
      actionMessage: '请选择封锁对象',
      actionConfirmMessage: '封锁',
    },
  },

  gargoyle: {
    id: 'gargoyle',
    displayName: '石像鬼',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '每晚可以查验一名玩家的具体身份。当其他所有狼人出局后，可在夜间进行袭击。石像鬼不参与狼人投票。',
  night1: { hasAction: true },
    // 永远不互知不参刀
    wolfMeeting: { canSeeWolves: false, participatesInWolfVote: false },
    ux: {
      actionMessage: '请选择查验对象',
      actionConfirmMessage: '查验',
    },
  },

  bloodMoon: {
    id: 'bloodMoon',
    displayName: '血月使徒',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '血月使徒自爆后的当晚所有好人的技能都将会被封印，若血月使徒是最后一个被放逐出局的狼人，他可以存活到下一个白天天亮之后才出局。',
    // No night-1 action
    night1: { hasAction: false },
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    ux: {},
  },

  wolfRobot: {
    id: 'wolfRobot',
    displayName: '机械狼',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '与普通狼人互不相认，第一晚最早睁眼学习任一玩家技能并获得其身份，当夜不能使用，下一夜可用。普通狼人全死后带刀，不能自爆（不参与狼人刀人）',
  night1: { hasAction: true },
    // 永远不互知不参刀
    wolfMeeting: { canSeeWolves: false, participatesInWolfVote: false },
    ux: {
      actionMessage: '请选择学习对象',
      actionConfirmMessage: '学习',
    },
  },

  spiritKnight: {
    id: 'spiritKnight',
    displayName: '恶灵骑士',
    faction: Faction.Wolf,
    team: 'wolf',
    description: '永久免疫夜间伤害（无法自刀、吃毒不死）。被预言家查验或女巫毒杀，则次日对方神职死亡（反伤）。不能自爆，只能被放逐或猎人枪杀',
    // No night action (passive ability)
    night1: { hasAction: false },
    // 互知+参刀
    wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
    flags: { immuneToNightDamage: true, reflectsDamage: true },
    ux: {},
  },

  // ===================================================================
  // THIRD-PARTY FACTION
  // ===================================================================
  slacker: {
    id: 'slacker',
    displayName: '混子',
    faction: Faction.Special,
    team: 'third',  // Before choosing idol; seer sees "好人" (not "第三方")
    description: '第一晚选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份',
  night1: { hasAction: true },
    ux: {
      actionMessage: '请选择你的榜样',
      actionConfirmMessage: '选择榜样',
    },
  },
} as const satisfies Record<string, RoleSpec>;

/** Role ID type (auto-derived from registry keys) */
export type RoleId = keyof typeof ROLE_SPECS;

/** Get spec by ID */
export function getRoleSpec<K extends RoleId>(id: K): (typeof ROLE_SPECS)[K] {
  return ROLE_SPECS[id];
}

/** Check if a string is a valid RoleId */
export function isValidRoleId(id: string): id is RoleId {
  return id in ROLE_SPECS;
}

/** Get all role IDs */
export function getAllRoleIds(): RoleId[] {
  return Object.keys(ROLE_SPECS) as RoleId[];
}

/** Get roles with night-1 action in the authoritative NIGHT_STEPS order */
export function getNight1ActionRoles(): RoleId[] {
  // Derive order from NIGHT_STEPS (single source of truth), not legacy RoleSpec.night1.order.
  // NOTE: Current contract assumes each role appears at most once in NIGHT_STEPS.
  const roleIds = new Set<RoleId>();
  for (const step of NIGHT_STEPS) {
    roleIds.add(step.roleId);
  }
  return Array.from(roleIds);
}

// Re-export types
export * from './spec.types';
