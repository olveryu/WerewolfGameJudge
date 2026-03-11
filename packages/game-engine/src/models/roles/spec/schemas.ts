/**
 * Action Schemas Registry - 行动输入协议表
 *
 * Single source of truth for all action input protocols.
 * 定义每个行动的 constraints / ui / meeting / canSkip 等声明式 schema，
 * 不依赖 service、不含副作用或 resolver 逻辑。
 */

import { type ActionSchema, TargetConstraint } from './schema.types';

export const SCHEMAS = {
  // === God actions ===
  seerCheck: {
    id: 'seerCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'seer',
      revealTitlePrefix: '查验结果',
      revealResultFormat: 'factionCheck',
      bottomActionText: '不用技能',
    },
  },

  mirrorSeerCheck: {
    id: 'mirrorSeerCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'mirrorSeer',
      revealTitlePrefix: '查验结果',
      revealResultFormat: 'factionCheck',
      bottomActionText: '不用技能',
    },
  },

  drunkSeerCheck: {
    id: 'drunkSeerCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'drunkSeer',
      revealTitlePrefix: '查验结果',
      revealResultFormat: 'factionCheck',
      bottomActionText: '不用技能',
    },
  },

  witchAction: {
    id: 'witchAction',
    displayName: '女巫行动',
    kind: 'compound',
    ui: {
      prompt: '女巫请行动',
      emptyKillTitle: '昨夜无人倒台',
    },
    steps: [
      {
        key: 'save',
        displayName: '救人',
        kind: 'confirmTarget', // Target is fixed (WITCH_CONTEXT.killedSeat), user only confirms
        constraints: [TargetConstraint.NotSelf], // Cannot save self (enforced by server via canSave)
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
        kind: 'chooseSeat', // User selects any target seat
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

  guardProtect: {
    id: 'guardProtect',
    displayName: '守护',
    kind: 'chooseSeat',
    constraints: [],
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择要守护的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要守护该玩家吗？',
      bottomActionText: '不用技能',
    },
  },

  psychicCheck: {
    id: 'psychicCheck',
    displayName: '通灵',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认通灵',
      prompt: '请选择要通灵的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要通灵该玩家吗？',
      revealKind: 'psychic',
      revealTitlePrefix: '通灵结果',
      revealResultFormat: 'roleName',
      bottomActionText: '不用技能',
    },
  },

  pureWhiteCheck: {
    id: 'pureWhiteCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'pureWhite',
      revealTitlePrefix: '纯白查验',
      revealResultFormat: 'roleName',
      bottomActionText: '不用技能',
    },
  },

  dreamcatcherDream: {
    id: 'dreamcatcherDream',
    displayName: '摄梦',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择要摄梦的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要摄梦该玩家吗？',
      bottomActionText: '不用技能',
    },
  },

  magicianSwap: {
    id: 'magicianSwap',
    displayName: '交换',
    kind: 'swap',
    constraints: [],
    canSkip: true,
    ui: {
      confirmTitle: '确认交换',
      prompt: '请选择要交换的两名玩家，如不使用请点击「不用技能」',
      confirmText: '确定要交换这两名玩家吗？',
      bottomActionText: '不用技能',
      firstTargetTitle: '已选择第一位玩家',
      firstTargetPromptTemplate: '{seat}号，请选择第二位玩家',
    },
  },

  hunterConfirm: {
    id: 'hunterConfirm',
    displayName: '技能发动确认',
    kind: 'confirm',
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请点击下方按钮查看技能发动状态',
      confirmText: '确定查看猎人发动状态吗？',
      bottomActionText: '发动状态',
      // Status dialog (shown after user taps "发动状态")
      statusDialogTitle: '技能状态',
      canShootText: '猎人可以发动技能',
      cannotShootText: '猎人不能发动技能',
    },
  },

  silenceElderSilence: {
    id: 'silenceElderSilence',
    displayName: '禁言',
    kind: 'chooseSeat',
    constraints: [],
    canSkip: true,
    ui: {
      confirmTitle: '确认禁言',
      prompt: '请选择要禁言的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要禁言该玩家吗？',
      bottomActionText: '不用技能',
    },
  },

  votebanElderBan: {
    id: 'votebanElderBan',
    displayName: '禁票',
    kind: 'chooseSeat',
    constraints: [],
    canSkip: true,
    ui: {
      confirmTitle: '确认禁票',
      prompt: '请选择要禁票的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要禁票该玩家吗？',
      bottomActionText: '不用技能',
    },
  },

  // === Wolf actions ===
  wolfKill: {
    id: 'wolfKill',
    displayName: '袭击',
    kind: 'wolfVote',
    constraints: [], // Neutral judge: wolves can target ANY seat
    meeting: {
      canSeeEachOther: true,
      resolution: 'majority',
      allowEmptyVote: true,
    },
    ui: {
      prompt: '请选择袭击目标',
      confirmTitle: '狼人投票',
      confirmText: '确定袭击该玩家？',
      emptyVoteText: '放弃袭击',
      voteConfirmTemplate: '{wolf} 确定袭击{seat}号？',
      emptyVoteConfirmTemplate: '{wolf} 确定放弃袭击？',
    },
  },

  wolfQueenCharm: {
    id: 'wolfQueenCharm',
    displayName: '魅惑',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择要魅惑的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要魅惑该玩家吗？',
      bottomActionText: '不用技能',
    },
  },

  nightmareBlock: {
    id: 'nightmareBlock',
    displayName: '恐惧',
    kind: 'chooseSeat',
    constraints: [],
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择要恐惧的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要恐惧该玩家吗？',
      bottomActionText: '不用技能',
    },
  },

  gargoyleCheck: {
    id: 'gargoyleCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'gargoyle',
      revealTitlePrefix: '石像鬼探查',
      revealResultFormat: 'roleName',
      bottomActionText: '不用技能',
    },
  },

  awakenedGargoyleConvert: {
    id: 'awakenedGargoyleConvert',
    displayName: '幻惑人心',
    kind: 'chooseSeat',
    constraints: [
      TargetConstraint.NotSelf,
      TargetConstraint.NotWolfFaction,
      TargetConstraint.AdjacentToWolfFaction,
    ],
    canSkip: false, // 强制发动，不可跳过
    ui: {
      confirmTitle: '确认转化',
      prompt: '请选择狼人阵营相邻的一名神民角色进行转化',
      confirmText: '确定要转化该玩家吗？',
    },
  },

  awakenedGargoyleConvertReveal: {
    id: 'awakenedGargoyleConvertReveal',
    displayName: '转化确认',
    kind: 'groupConfirm',
    requireAllAcks: true,
    ui: {
      prompt: '所有玩家请睁眼，请看手机确认转化信息',
      bottomActionText: '转化状态',
      hypnotizedText: '你已被觉醒石像鬼转化为狼人阵营',
      notHypnotizedText: '你未被转化',
      confirmButtonText: '知道了',
    },
  },

  wolfWitchCheck: {
    id: 'wolfWitchCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotWolfFaction], // Cannot check wolf-faction players
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的非狼人阵营玩家，如不使用请点击「不用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'wolfWitch',
      revealTitlePrefix: '狼巫查验',
      revealResultFormat: 'roleName',
      bottomActionText: '不用技能',
    },
  },

  wolfRobotLearn: {
    id: 'wolfRobotLearn',
    displayName: '学习',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf], // Cannot learn self
    canSkip: true,
    ui: {
      confirmTitle: '确认学习',
      prompt: '请选择要学习的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要学习该玩家吗？',
      revealKind: 'wolfRobot',
      revealTitlePrefix: '学习结果',
      revealResultFormat: 'roleName',
      bottomActionText: '不用技能',
      // Hunter gate UI: shown after learning hunter, before night advances
      hunterGatePrompt: '你学习到了猎人，请确认是否可发动技能',
      hunterGateButtonText: '查看技能状态',
      // Keep dialog title aligned with other “confirm trigger” style dialogs and test harness classification.
      hunterGateDialogTitle: '猎人技能状态',
      hunterGateCanShootText: '当前可发动技能',
      hunterGateCannotShootText: '当前不可发动技能',
    },
  },

  darkWolfKingConfirm: {
    id: 'darkWolfKingConfirm',
    displayName: '技能发动确认',
    kind: 'confirm',
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请点击下方按钮查看技能发动状态',
      confirmText: '确定查看黑狼王发动状态吗？',
      bottomActionText: '发动状态',
      // Status dialog (shown after user taps "发动状态")
      statusDialogTitle: '技能状态',
      canShootText: '黑狼王可以发动技能',
      cannotShootText: '黑狼王不能发动技能',
    },
  },

  // === Third-party actions ===
  slackerChooseIdol: {
    id: 'slackerChooseIdol',
    displayName: '选择榜样',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: false,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择你的榜样',
      confirmText: '确定选择该玩家为榜样吗？',
      bottomActionText: '不用技能',
    },
  },
  wildChildChooseIdol: {
    id: 'wildChildChooseIdol',
    displayName: '选择榜样',
    kind: 'chooseSeat',
    constraints: [TargetConstraint.NotSelf],
    canSkip: false,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择你的榜样',
      confirmText: '确定选择该玩家为榜样吗？',
      bottomActionText: '不用技能',
    },
  },
  piperHypnotize: {
    id: 'piperHypnotize',
    displayName: '催眠',
    kind: 'multiChooseSeat',
    constraints: [TargetConstraint.NotSelf],
    minTargets: 1,
    maxTargets: 2,
    canSkip: true,
    ui: {
      confirmTitle: '确认催眠',
      prompt: '请选择1-2名要催眠的玩家，如不使用请点击「不用技能」',
      confirmText: '确定要催眠选中的玩家吗？',
      bottomActionText: '不用技能',
      confirmButtonText: '确认催眠({count}人)',
    },
  },
  piperHypnotizedReveal: {
    id: 'piperHypnotizedReveal',
    displayName: '催眠确认',
    kind: 'groupConfirm',
    requireAllAcks: true,
    ui: {
      prompt: '所有玩家请睁眼，请看手机确认催眠信息',
      bottomActionText: '催眠状态',
      hypnotizedText: '你已被吹笛者催眠，当前被催眠的座位：{seats}',
      notHypnotizedText: '你未被催眠',
      confirmButtonText: '知道了',
    },
  },
} as const satisfies Record<string, ActionSchema>;

/** Schema ID type (auto-derived from registry keys) */
export type SchemaId = keyof typeof SCHEMAS;

/** Get schema by ID */
export function getSchema<K extends SchemaId>(id: K): (typeof SCHEMAS)[K] {
  return SCHEMAS[id];
}

/** Check if a string is a valid SchemaId */
export function isValidSchemaId(id: string): id is SchemaId {
  return id in SCHEMAS;
}

/** Get all schema IDs */
export function getAllSchemaIds(): SchemaId[] {
  return Object.keys(SCHEMAS) as SchemaId[];
}

// Re-export types
export * from './schema.types';
