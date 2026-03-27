/**
 * V2 Role Specs Registry — 全部 36 角色声明式定义
 *
 * Single source of truth: 角色固有属性 + 行为（abilities / effects）+ 夜间步骤 + UI 元数据
 * 合并了 V1 的 ROLE_SPECS + SCHEMAS + NIGHT_STEPS 三表。
 *
 * 36 roles total:
 * - Villager faction: villager, mirrorSeer, drunkSeer (3)
 * - God faction: seer, witch, hunter, guard, idiot, knight, magician, witcher, psychic,
 *   dreamcatcher, graveyardKeeper, pureWhite, dancer, silenceElder, votebanElder (15)
 * - Wolf faction: wolf, wolfQueen, wolfKing, darkWolfKing, nightmare, gargoyle,
 *   awakenedGargoyle, bloodMoon, wolfRobot, wolfWitch, spiritKnight, masquerade, warden (13)
 * - Third-party: slacker, wildChild, piper, shadow, avenger (5)
 *
 * 纯数据，JSON-serializable。不含业务逻辑、副作用、平台依赖。
 */

import { TargetConstraint } from './ability.types';
import type { RoleAbilityTag, RoleDescription, RoleSpec } from './roleSpec.types';
import { Faction, Team } from './types';

export const ROLE_SPECS = {
  // ===================================================================
  // VILLAGER FACTION (3)
  // ===================================================================

  villager: {
    id: 'villager',
    displayName: '普通村民',
    shortName: '民',
    emoji: '👤',
    faction: Faction.Villager,
    team: Team.Good,
    description: '没有特殊技能，依靠推理和投票帮助好人阵营获胜',
    structuredDescription: {
      passive: '没有特殊技能，依靠推理和投票帮助好人阵营获胜',
    },
    tags: ['none'] satisfies RoleAbilityTag[],
    abilities: [],
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
    structuredDescription: {
      skill: '每晚可查验一名玩家的阵营，但结果与真实阵营相反',
      passive: '自身不知真实身份，以预言家身份示人',
    },
    tags: ['check'],
    groups: ['seerFamily'],
    displayAs: 'seer',
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'faction', transformer: 'invert' }],
        activeOnNight1: true,
      },
      {
        type: 'passive',
        effect: 'disguiseAsSeer',
      },
    ],
    nightSteps: [
      {
        stepId: 'mirrorSeerCheck',
        displayName: '查验',
        audioKey: 'mirrorSeer',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '查验结果',
          revealResultFormat: 'factionCheck',
          bottomActionText: '不用技能',
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可查验一名玩家的阵营，但结果随机（50%正确/50%错误）',
      passive: '自身不知真实身份，以预言家身份示人',
    },
    tags: ['check'],
    groups: ['seerFamily'],
    displayAs: 'seer',
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'faction', transformer: 'random' }],
        activeOnNight1: true,
      },
      {
        type: 'passive',
        effect: 'disguiseAsSeer',
      },
    ],
    nightSteps: [
      {
        stepId: 'drunkSeerCheck',
        displayName: '查验',
        audioKey: 'drunkSeer',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '查验结果',
          revealResultFormat: 'factionCheck',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  // ===================================================================
  // GOD FACTION (15)
  // ===================================================================

  seer: {
    id: 'seer',
    displayName: '预言家',
    shortName: '预',
    emoji: '🔮',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
    structuredDescription: {
      skill: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
    },
    tags: ['check'],
    groups: ['seerFamily'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'faction' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'checkSource',
    nightSteps: [
      {
        stepId: 'seerCheck',
        displayName: '查验',
        audioKey: 'seer',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '查验结果',
          revealResultFormat: 'factionCheck',
          bottomActionText: '不用技能',
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可救活被狼人袭击的玩家或毒杀一名玩家',
      passive: '拥有一瓶解药和一瓶毒药',
      restriction: '每瓶药限用一次；不能自救',
    },
    tags: ['protect', 'kill'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'compound',
        canSkip: true,
        effects: [],
        activeOnNight1: true,
        customResolver: 'witchAction',
      },
    ],
    resources: [
      { kind: 'antidote', uses: 1, refreshPerNight: false },
      { kind: 'poison', uses: 1, refreshPerNight: false },
    ],
    deathCalcRole: 'poisonSource',
    nightSteps: [
      {
        stepId: 'witchAction',
        displayName: '女巫行动',
        audioKey: 'witch',
        actionKind: 'compound',
        ui: {
          prompt: '女巫请行动',
          emptyKillTitle: '昨夜无人倒台',
        },
        compoundSteps: [
          {
            key: 'save',
            displayName: '救人',
            kind: 'confirmTarget',
            constraints: [TargetConstraint.NotSelf],
            canSkip: true,
            ui: {
              confirmTitle: '确认行动',
              prompt: '是否使用解药？',
              promptTemplate: '{seat}号被狼人袭击，是否使用解药？',
              cannotSavePrompt: '你被狼人袭击，无法自救，可使用毒药或不用技能。',
              confirmText: '确定使用解药吗？',
              bottomActionText: '不用技能',
            },
          },
          {
            key: 'poison',
            displayName: '毒人',
            kind: 'chooseSeat',
            constraints: [],
            canSkip: true,
            ui: {
              confirmTitle: '确认行动',
              prompt: '如要使用毒药，请点击座位。',
              confirmText: '确定使用毒药吗？',
              bottomActionText: '不用技能',
            },
          },
        ],
      },
    ],
  },

  hunter: {
    id: 'hunter',
    displayName: '猎人',
    shortName: '猎',
    emoji: '🏹',
    faction: Faction.God,
    team: Team.Good,
    description: '出局时可开枪带走一名玩家；被女巫毒杀则不能开枪',
    structuredDescription: {
      trigger: '出局时可开枪带走一名玩家',
      restriction: '被女巫毒杀则不能开枪',
    },
    tags: ['kill'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'confirm',
        canSkip: true,
        effects: [{ kind: 'confirm', confirmType: 'shoot' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'shoot',
      },
    ],
    resources: [{ kind: 'bullet', uses: 1, refreshPerNight: false }],
    nightSteps: [
      {
        stepId: 'hunterConfirm',
        displayName: '技能发动确认',
        audioKey: 'hunter',
        actionKind: 'confirm',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请点击下方按钮查看技能发动状态',
          confirmText: '确定查看猎人发动状态吗？',
          bottomActionText: '发动状态',
          confirmStatusUi: {
            kind: 'shoot',
            statusDialogTitle: '技能状态',
            canText: '猎人可以发动技能',
            cannotText: '猎人不能发动技能',
          },
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可守护一名玩家使其免受狼人袭击',
      restriction: '不能连续两晚守护同一人；同时被守护和解药救活则仍然出局；无法防御女巫毒药',
    },
    tags: ['protect'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'writeSlot', slot: 'guardedSeat' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'guardProtector',
    nightSteps: [
      {
        stepId: 'guardProtect',
        displayName: '守护',
        audioKey: 'guard',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要守护的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要守护该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  idiot: {
    id: 'idiot',
    displayName: '白痴',
    shortName: '白',
    emoji: '🤡',
    faction: Faction.God,
    team: Team.Good,
    description: '被投票放逐时可翻牌免死，此后失去投票权和技能使用权',
    structuredDescription: {
      trigger: '被投票放逐时可翻牌免死',
      restriction: '此后失去投票权和技能使用权',
    },
    tags: ['survive'] satisfies RoleAbilityTag[],
    abilities: [
      {
        type: 'triggered',
        trigger: 'onDayExile',
        effect: 'flipCard',
      },
    ],
  },

  knight: {
    id: 'knight',
    displayName: '骑士',
    shortName: '骑',
    emoji: '🗡️',
    faction: Faction.God,
    team: Team.Good,
    description: '白天可翻牌与一名玩家决斗：对方是狼人则对方出局，对方是好人则自身出局',
    structuredDescription: {
      skill: '白天可翻牌与一名玩家决斗：对方是狼人则对方出局，对方是好人则自身出局',
    },
    tags: ['kill'],
    abilities: [
      {
        type: 'active',
        timing: 'day',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: false,
        effects: [{ kind: 'check', resultType: 'faction' }],
        activeOnNight1: false,
      },
    ],
  },

  magician: {
    id: 'magician',
    displayName: '魔术师',
    shortName: '术',
    emoji: '🎩',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚最先行动，交换两名玩家的号码牌，仅当晚有效',
    structuredDescription: {
      skill: '每晚最先行动，交换两名玩家的号码牌，仅当晚有效',
    },
    tags: ['control'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'swap',
        target: {
          count: { min: 2, max: 2 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'swap' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'magicianSwap',
        displayName: '交换',
        audioKey: 'magician',
        actionKind: 'swap',
        ui: {
          confirmTitle: '确认交换',
          prompt: '请选择要交换的两名玩家，如不使用请点击「不用技能」',
          confirmText: '确定要交换这两名玩家吗？',
          bottomActionText: '不用技能',
          firstTargetTitle: '已选择第一位玩家',
          firstTargetPromptTemplate: '{seat}号，请选择第二位玩家',
        },
      },
    ],
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
    structuredDescription: {
      skill: '从第二夜起，每晚可选择一名玩家狩猎：对方是狼人则对方次日出局，是好人则自身次日出局',
      passive: '免疫女巫毒药',
    },
    tags: ['kill', 'immune'],
    abilities: [
      {
        type: 'passive',
        effect: 'immuneToPoison',
      },
    ],
    immunities: [{ kind: 'poison' }],
  },

  psychic: {
    id: 'psychic',
    displayName: '通灵师',
    shortName: '通',
    emoji: '👁️',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的身份，获知其具体角色名称',
    structuredDescription: {
      skill: '每晚可查验一名玩家的身份，获知其具体角色名称',
    },
    tags: ['check'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'checkSource',
    nightSteps: [
      {
        stepId: 'psychicCheck',
        displayName: '通灵',
        audioKey: 'psychic',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认通灵',
          prompt: '请选择要通灵的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要通灵该玩家吗？',
          revealTitlePrefix: '通灵结果',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可选择一名玩家成为梦游者，梦游者不知情且免疫夜间伤害',
      trigger: '自身夜间出局则梦游者一并出局；连续两晚被摄梦也会出局',
    },
    tags: ['protect', 'link'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'writeSlot', slot: 'dreamingSeat' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onSelfDeath',
        effect: 'linkDreamDeath',
      },
    ],
    deathCalcRole: 'dreamcatcherLink',
    nightSteps: [
      {
        stepId: 'dreamcatcherDream',
        displayName: '摄梦',
        audioKey: 'dreamcatcher',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要摄梦的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要摄梦该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  graveyardKeeper: {
    id: 'graveyardKeeper',
    displayName: '守墓人',
    shortName: '墓',
    emoji: '⚰️',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可得知上一个白天被放逐玩家的阵营（好人/狼人）',
    structuredDescription: {
      skill: '每晚可得知上一个白天被放逐玩家的阵营（好人/狼人）',
    },
    tags: ['check'],
    abilities: [],
  },

  pureWhite: {
    id: 'pureWhite',
    displayName: '纯白之女',
    shortName: '纯',
    emoji: '🤍',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的身份，获知其具体角色名称；从第二夜起，查验到狼人则该狼人出局',
    structuredDescription: {
      skill: '每晚可查验一名玩家的身份，获知其具体角色名称',
      trigger: '从第二夜起，查验到狼人则该狼人出局',
    },
    tags: ['check', 'kill'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'checkSource',
    nightSteps: [
      {
        stepId: 'pureWhiteCheck',
        displayName: '查验',
        audioKey: 'pureWhite',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '纯白查验',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
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
    structuredDescription: {
      skill:
        '从第二夜起，每晚必须选择三名玩家共舞（可含自身），若三人分属不同阵营则人数少的一方出局',
      passive: '仅当自身参舞时，舞池中三人当夜免疫狼人袭击；免疫女巫毒药',
    },
    tags: ['kill', 'protect', 'immune'],
    abilities: [
      {
        type: 'passive',
        effect: 'immuneToPoison',
      },
    ],
    immunities: [{ kind: 'poison' }],
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
    structuredDescription: {
      skill: '每晚可禁言一名玩家，使其次日发言阶段只能用肢体动作表达',
      restriction: '不能连续两晚禁言同一人；禁言信息与死讯同时公布',
    },
    tags: ['control'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'writeSlot', slot: 'silencedSeat' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'silenceElderSilence',
        displayName: '禁言',
        audioKey: 'silenceElder',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认禁言',
          prompt: '请选择要禁言的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要禁言该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可禁票一名玩家，使其次日放逐环节不能投票',
      restriction: '不能连续两晚禁票同一人；禁票信息与死讯同时公布',
    },
    tags: ['control'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'writeSlot', slot: 'votebannedSeat' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'votebanElderBan',
        displayName: '禁票',
        audioKey: 'votebanElder',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认禁票',
          prompt: '请选择要禁票的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要禁票该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  // ===================================================================
  // WOLF FACTION (13)
  // ===================================================================

  wolf: {
    id: 'wolf',
    displayName: '狼人',
    shortName: '狼',
    emoji: '🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '每晚与狼队友共同选择一名玩家进行袭击',
    structuredDescription: {
      skill: '每晚与狼队友共同选择一名玩家进行袭击',
    },
    tags: ['kill'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'wolfVote',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [],
        activeOnNight1: true,
        customResolver: 'wolfKill',
      },
    ],
    nightSteps: [
      {
        stepId: 'wolfKill',
        displayName: '袭击',
        audioKey: 'wolf',
        actionKind: 'wolfVote',
        ui: {
          prompt: '请选择袭击目标',
          confirmTitle: '狼人投票',
          confirmText: '确定袭击该玩家？',
          emptyVoteText: '放弃袭击',
          voteConfirmTemplate: '{wolf} 确定袭击{seat}号？',
          emptyVoteConfirmTemplate: '{wolf} 确定放弃袭击？',
        },
        meeting: {
          canSeeEachOther: true,
          resolution: 'majority',
          allowEmptyVote: true,
        },
      },
    ],
  },

  wolfQueen: {
    id: 'wolfQueen',
    displayName: '狼美人',
    shortName: '美',
    emoji: '👸🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '每晚可魅惑一名玩家；白天出局时被魅惑者随之殉情出局，被魅惑者不知情；不能自爆，不能自刀',
    structuredDescription: {
      skill: '每晚可魅惑一名玩家',
      restriction: '不能自爆；不能自刀',
      trigger: '白天出局时被魅惑者随之殉情出局，被魅惑者不知情',
    },
    tags: ['control', 'link'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'charm' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'linkDeath',
      },
    ],
    immunities: [{ kind: 'wolfAttack' }],
    deathCalcRole: 'wolfQueenLink',
    nightSteps: [
      {
        stepId: 'wolfQueenCharm',
        displayName: '魅惑',
        audioKey: 'wolfQueen',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要魅惑的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要魅惑该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  wolfKing: {
    id: 'wolfKing',
    displayName: '白狼王',
    shortName: '王',
    emoji: '👑🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '白天可自爆并带走一名玩家；非自爆出局时不能发动技能',
    structuredDescription: {
      skill: '白天可自爆并带走一名玩家',
      restriction: '非自爆出局时不能发动技能',
    },
    tags: ['kill'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'selfDestruct',
      },
    ],
  },

  darkWolfKing: {
    id: 'darkWolfKing',
    displayName: '黑狼王',
    shortName: '黑',
    emoji: '🖤🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '出局时可开枪带走一名玩家；被女巫毒杀则不能开枪',
    structuredDescription: {
      trigger: '出局时可开枪带走一名玩家',
      restriction: '被女巫毒杀则不能开枪',
    },
    tags: ['kill'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'confirm',
        canSkip: true,
        effects: [{ kind: 'confirm', confirmType: 'shoot' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'shoot',
      },
    ],
    resources: [{ kind: 'bullet', uses: 1, refreshPerNight: false }],
    nightSteps: [
      {
        stepId: 'darkWolfKingConfirm',
        displayName: '技能发动确认',
        audioKey: 'darkWolfKing',
        actionKind: 'confirm',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请点击下方按钮查看技能发动状态',
          confirmText: '确定查看黑狼王发动状态吗？',
          bottomActionText: '发动状态',
          confirmStatusUi: {
            kind: 'shoot',
            statusDialogTitle: '技能状态',
            canText: '黑狼王可以发动技能',
            cannotText: '黑狼王不能发动技能',
          },
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚在多数角色行动之前恐惧一名玩家，使其当夜无法使用技能',
      restriction: '不能连续两晚恐惧同一人；首夜行动时尚未与狼队互认',
      special: '若恐惧到狼人，狼人阵营当夜无法袭击',
    },
    tags: ['control'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true, actsSolo: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'block', disablesWolfKillOnWolfTarget: true }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'nightmareBlock',
        displayName: '恐惧',
        audioKey: 'nightmare',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要恐惧的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要恐惧该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可查验一名玩家的身份，获知其具体角色名称',
      passive: '与其他狼人互不相认',
      special: '其他狼人全部出局后可主导袭击',
    },
    tags: ['check'],
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'gargoyleCheck',
        displayName: '查验',
        audioKey: 'gargoyle',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '石像鬼探查',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  awakenedGargoyle: {
    id: 'awakenedGargoyle',
    displayName: '觉醒石像鬼',
    shortName: '石',
    emoji: '🗿🔥',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '首夜必须选择一名与狼人阵营相邻的玩家转化至狼人阵营；被转化者天亮前知晓转变，不入狼队，保留自身技能；其他狼人全部出局后失去原技能并主导袭击；被转化者不可自爆',
    structuredDescription: {
      skill: '首夜必须选择一名与狼人阵营相邻的玩家转化至狼人阵营',
      special:
        '被转化者天亮前知晓转变，不入狼队，保留自身技能；其他狼人全部出局后失去原技能并主导袭击',
      restriction: '被转化者不可自爆',
    },
    tags: ['transform'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [
            TargetConstraint.NotSelf,
            TargetConstraint.NotWolfFaction,
            TargetConstraint.AdjacentToWolfFaction,
          ],
        },
        canSkip: false,
        effects: [{ kind: 'convert' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'awakenedGargoyleConvert',
        displayName: '幻惑人心',
        audioKey: 'awakenedGargoyle',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认转化',
          prompt: '请选择狼人阵营相邻的一名神民角色进行转化',
          confirmText: '确定要转化该玩家吗？',
        },
      },
      {
        stepId: 'awakenedGargoyleConvertReveal',
        displayName: '转化确认',
        audioKey: 'awakenedGargoyleConvertReveal',
        audioEndKey: 'awakenedGargoyleConvertReveal',
        actionKind: 'groupConfirm',
        ui: {
          prompt: '所有玩家请睁眼，请看手机确认转化信息',
          bottomActionText: '转化状态',
          hypnotizedText: '你已被觉醒石像鬼转化为狼人阵营',
          notHypnotizedText: '你未被转化',
          confirmButtonText: '知道了',
        },
      },
    ],
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
    structuredDescription: {
      trigger: '自爆后的当晚所有好人阵营的技能被封印',
      passive: '若为最后一个被放逐的狼人，可存活至下一个白天天亮后才出局',
    },
    tags: ['control'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [],
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
    structuredDescription: {
      skill: '首夜可学习一名玩家的技能并获知其身份，当夜不能使用，次夜可用',
      passive: '与其他狼人互不相认',
      restriction: '不能自爆',
      special: '其他狼人全部出局后可主导袭击',
    },
    tags: ['check', 'transform'],
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'learn', gateTriggersOnRoles: ['hunter'] }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'wolfRobotLearn',
        displayName: '学习',
        audioKey: 'wolfRobot',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认学习',
          prompt: '请选择要学习的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要学习该玩家吗？',
          revealTitlePrefix: '学习结果',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
          hunterGatePrompt: '你学习到了猎人，请确认是否可发动技能',
          hunterGateButtonText: '查看技能状态',
          hunterGateDialogTitle: '猎人技能状态',
          hunterGateCanShootText: '当前可发动技能',
          hunterGateCannotShootText: '当前不可发动技能',
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可查验一名非狼人阵营玩家的身份，获知其具体角色名称',
      trigger: '从第二夜起，查验到纯白之女则其出局',
    },
    tags: ['check', 'kill'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotWolfFaction],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'wolfWitchCheck',
        displayName: '查验',
        audioKey: 'wolfWitch',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的非狼人阵营玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '狼巫查验',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  spiritKnight: {
    id: 'spiritKnight',
    displayName: '恶灵骑士',
    shortName: '灵',
    emoji: '⚔️',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '永久免疫夜间伤害；被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局；不能自爆',
    structuredDescription: {
      passive: '永久免疫夜间伤害',
      trigger: '被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局',
      restriction: '不能自爆',
    },
    tags: ['immune', 'link'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      { type: 'passive', effect: 'immuneToWolfKill' },
      { type: 'passive', effect: 'immuneToPoison' },
      { type: 'passive', effect: 'reflectsDamage' },
      {
        type: 'triggered',
        trigger: 'onCheckedByNonWolf',
        effect: 'reflectDamage',
      },
      {
        type: 'triggered',
        trigger: 'onPoisoned',
        effect: 'reflectDamage',
      },
    ],
    immunities: [{ kind: 'wolfAttack' }, { kind: 'poison' }, { kind: 'nightDamage' }],
    deathCalcRole: 'reflectTarget',
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
    structuredDescription: {
      skill: '从第二夜起可查看一名玩家是否在舞池中，并可赐予一名玩家面具使其共舞结算时阵营反转',
      passive: '与其他狼人互不相认；免疫女巫毒药',
      special: '其他狼人全部出局后可主导袭击',
    },
    tags: ['check', 'control', 'immune'],
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
    abilities: [
      {
        type: 'passive',
        effect: 'immuneToPoison',
      },
    ],
    immunities: [{ kind: 'poison' }],
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
    structuredDescription: {
      skill:
        '从第二夜起，每晚选择2名玩家进行交易，随后与狼人共同袭击；双方得知对象但不知身份，各自选「交易」或「背叛」：同交易免夜间伤害，同背叛互为当夜技能目标，一交一叛时选「交易」的出局；选自身交易时，对方与自身同选则自身出局，不同则对方出局',
      restriction: '每人限交易1次',
    },
    tags: ['kill', 'control'],
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [],
  },

  // ===================================================================
  // THIRD-PARTY FACTION (5)
  // ===================================================================

  slacker: {
    id: 'slacker',
    displayName: '混子',
    shortName: '混',
    emoji: '😴',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份；与榜样阵营共同胜利',
    structuredDescription: {
      skill: '首夜选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份',
      winCondition: '与榜样阵营共同胜利',
    },
    tags: ['follow'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: false,
        effects: [{ kind: 'chooseIdol' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'slackerChooseIdol',
        displayName: '选择榜样',
        audioKey: 'slacker',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择你的榜样',
          confirmText: '确定选择该玩家为榜样吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  wildChild: {
    id: 'wildChild',
    displayName: '野孩子',
    shortName: '野',
    emoji: '👶',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜选择一名玩家作为榜样；榜样被投票出局时自身变为狼人，若先于榜样出局则始终为好人阵营；未变身时随好人阵营胜利，变为狼人后随狼人阵营胜利',
    structuredDescription: {
      skill: '首夜选择一名玩家作为榜样',
      trigger: '榜样被投票出局时自身变为狼人；若先于榜样出局则始终为好人阵营',
      winCondition: '未变身时随好人阵营胜利；变为狼人后随狼人阵营胜利',
    },
    tags: ['transform', 'link'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: false,
        effects: [{ kind: 'chooseIdol' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'wildChildChooseIdol',
        displayName: '选择榜样',
        audioKey: 'wildChild',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择你的榜样',
          confirmText: '确定选择该玩家为榜样吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
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
    structuredDescription: {
      skill: '每晚可选择 1~2 名玩家进行催眠，被催眠的玩家会醒来互相确认',
      winCondition: '当所有其他存活玩家均被催眠时获胜',
    },
    tags: ['control'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'multiChooseSeat',
        target: {
          count: { min: 1, max: 2 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'hypnotize' }],
        activeOnNight1: true,
      },
      {
        type: 'active',
        timing: 'night',
        actionKind: 'groupConfirm',
        canSkip: false,
        effects: [{ kind: 'groupReveal' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'piperHypnotize',
        displayName: '催眠',
        audioKey: 'piper',
        actionKind: 'multiChooseSeat',
        ui: {
          confirmTitle: '确认催眠',
          prompt: '请选择1-2名要催眠的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要催眠选中的玩家吗？',
          bottomActionText: '不用技能',
          confirmButtonText: '确认催眠({count}人)',
        },
      },
      {
        stepId: 'piperHypnotizedReveal',
        displayName: '催眠确认',
        audioKey: 'piperHypnotizedReveal',
        audioEndKey: 'piperHypnotizedReveal',
        actionKind: 'groupConfirm',
        ui: {
          prompt: '所有玩家请睁眼，请看手机确认催眠信息',
          bottomActionText: '催眠状态',
          hypnotizedText: '你已被吹笛者催眠，当前被催眠的座位：{seats}',
          notHypnotizedText: '你未被催眠',
          confirmButtonText: '知道了',
        },
      },
    ],
  },

  shadow: {
    id: 'shadow',
    displayName: '影子',
    shortName: '影',
    emoji: '🌑',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜模仿一名玩家，目标出局后继承其身份和技能状态；非绑定时随继承的阵营胜利；模仿到复仇者时二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果；绑定时胜利条件为屠城',
    structuredDescription: {
      skill: '首夜模仿一名玩家，目标出局后继承其身份和技能状态',
      special:
        '模仿到复仇者时二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果',
      winCondition: '非绑定时随继承的阵营胜利；绑定时胜利条件为屠城',
    },
    tags: ['transform', 'link'],
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: false,
        effects: [{ kind: 'mimic', pairedRole: 'avenger' }],
        activeOnNight1: true,
        customResolver: 'shadowChooseMimic',
      },
    ],
    deathCalcRole: 'bondedLink',
    nightSteps: [
      {
        stepId: 'shadowChooseMimic',
        displayName: '选择模仿',
        audioKey: 'shadow',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认模仿',
          prompt: '请选择你要模仿的玩家',
          confirmText: '确定模仿该玩家吗？',
        },
      },
    ],
  },

  avenger: {
    id: 'avenger',
    displayName: '复仇者',
    shortName: '仇',
    emoji: '⚔️',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜获知自身阵营，永远与影子模仿目标阵营对立；非绑定时随自身阵营胜利；若影子模仿复仇者则二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果；绑定时胜利条件为屠城；非绑定时：出局可刺杀一名玩家，命中敌方有效、己方无效；命中未变身影子则单独胜利；帮好人时算神职，帮狼时与其他狼人互不相认，其他狼人全部出局后可主导袭击；预言家查验为好人',
    structuredDescription: {
      skill: '首夜获知自身阵营',
      passive: '永远与影子模仿目标阵营对立；预言家查验为好人',
      trigger: '出局可刺杀一名玩家，命中敌方有效、己方无效；命中未变身影子则单独胜利',
      special:
        '若影子模仿复仇者则二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果；帮好人时算神职，帮狼时与其他狼人互不相认，其他狼人全部出局后可主导袭击',
      winCondition: '非绑定时随自身阵营胜利；绑定时胜利条件为屠城',
    },
    tags: ['kill', 'link'],
    deathCalcRole: 'bondedLink',
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'confirm',
        canSkip: true,
        effects: [{ kind: 'confirm', confirmType: 'faction' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'stab',
      },
    ],
    nightSteps: [
      {
        stepId: 'avengerConfirm',
        displayName: '阵营确认',
        audioKey: 'avenger',
        actionKind: 'confirm',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请点击下方按钮查看你的阵营信息',
          confirmText: '确定查看阵营信息吗？',
          bottomActionText: '查看阵营',
          confirmStatusUi: {
            kind: 'faction',
            statusDialogTitle: '阵营信息',
            goodText: '你属于好人阵营',
            wolfText: '你属于狼人阵营',
            bondedText: '你与影子绑定，同属第三方阵营',
          },
        },
      },
    ],
  },
} as const satisfies Record<string, RoleSpec>;

/** Role ID type (auto-derived from registry keys) */
export type RoleId = keyof typeof ROLE_SPECS;

// =============================================================================
// Helper Functions
// =============================================================================

/** Get spec by ID (preserves narrow literal type for discriminated access) */
export function getRoleSpec<K extends RoleId>(id: K): (typeof ROLE_SPECS)[K] {
  return ROLE_SPECS[id];
}

/**
 * Get the displayAs target for a role.
 * Returns the RoleId the role masquerades as (for player-facing display),
 * or undefined if the role shows its own identity.
 */
export function getRoleDisplayAs(roleId: RoleId): RoleId | undefined {
  const spec: RoleSpec = ROLE_SPECS[roleId];
  return spec.displayAs as RoleId | undefined;
}

/** Get the emoji icon for a role (text character). */
export function getRoleEmoji(roleId: RoleId): string {
  return ROLE_SPECS[roleId].emoji;
}

/** Check if a string is a valid RoleId */
export function isValidRoleId(id: string): id is RoleId {
  return id in ROLE_SPECS;
}

/**
 * Get structured description for card UI rendering.
 * Returns undefined if the role has no structured description (falls back to flat text).
 */
export function getRoleStructuredDescription(roleId: RoleId): RoleDescription | undefined {
  return ROLE_SPECS[roleId].structuredDescription;
}

/** Get all role IDs */
export function getAllRoleIds(): RoleId[] {
  return Object.keys(ROLE_SPECS) as RoleId[];
}
