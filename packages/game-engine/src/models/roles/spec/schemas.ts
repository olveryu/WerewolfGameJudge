/**
 * Action Schemas Registry - 行动输入协议表
 *
 * Single source of truth for all action input protocols.
 * 定义每个行动的 constraints / ui / meeting / canSkip 等。
 *
 * ✅ 允许：声明式 schema 定义
 * ❌ 禁止：import service / 副作用 / resolver 逻辑
 */

import type { ActionSchema } from './schema.types';

export const SCHEMAS = {
  // === God actions ===
  seerCheck: {
    id: 'seerCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [], // Can check self (neutral judge)
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'seer',
      bottomActionText: '不使用技能',
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
        constraints: ['notSelf'], // Cannot save self (enforced by Host via canSave)
        canSkip: true,
        ui: {
          confirmTitle: '确认行动',
          prompt: '是否使用解药？',
          promptTemplate: '{seat}号被狼人杀了，是否使用解药？',
          cannotSavePrompt: '你被狼人杀了，无法对自己使用解药，可以对别人用毒药或者不用技能。',
          confirmText: '确定使用解药吗？',
          bottomActionText: '不使用技能',
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
          bottomActionText: '不使用技能',
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
      prompt: '请选择要守护的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要守护该玩家吗？',
      bottomActionText: '不使用技能',
    },
  },

  psychicCheck: {
    id: 'psychicCheck',
    displayName: '通灵',
    kind: 'chooseSeat',
    constraints: [], // Can check self (neutral judge)
    canSkip: true,
    ui: {
      confirmTitle: '确认通灵',
      prompt: '请选择要通灵的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要通灵该玩家吗？',
      revealKind: 'psychic',
      bottomActionText: '不使用技能',
    },
  },

  dreamcatcherDream: {
    id: 'dreamcatcherDream',
    displayName: '摄梦',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择要摄梦的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要摄梦该玩家吗？',
      bottomActionText: '不使用技能',
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
      prompt: '请选择要交换的两名玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要交换这两名玩家吗？',
      bottomActionText: '不使用技能',
      firstTargetTitle: '已选择第一位玩家',
      firstTargetPromptTemplate: '{seat}号，请选择第二位玩家',
    },
  },

  hunterConfirm: {
    id: 'hunterConfirm',
    displayName: '确认发动状态',
    kind: 'confirm',
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请点击下方按钮查看技能发动状态',
      confirmText: '确定查看猎人发动状态吗？',
      bottomActionText: '查看发动状态',
      // Status dialog (shown after user taps "查看发动状态")
      statusDialogTitle: '技能状态',
      canShootText: '猎人可以发动技能',
      cannotShootText: '猎人不能发动技能',
    },
  },

  // === Wolf actions ===
  wolfKill: {
    id: 'wolfKill',
    displayName: '狼刀',
    kind: 'wolfVote',
    constraints: [], // Neutral judge: wolves can target ANY seat
    meeting: {
      canSeeEachOther: true,
      resolution: 'firstVote',
      allowEmptyVote: true,
    },
    ui: {
      prompt: '请选择要猎杀的玩家',
      confirmTitle: '狼人投票',
      confirmText: '确定要猎杀该玩家吗？',
      emptyVoteText: '空刀',
      voteConfirmTemplate: '{wolf} 确定要猎杀{seat}号玩家吗？',
      emptyVoteConfirmTemplate: '{wolf} 确定投票空刀吗？',
    },
  },

  wolfQueenCharm: {
    id: 'wolfQueenCharm',
    displayName: '魅惑',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择要魅惑的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要魅惑该玩家吗？',
      bottomActionText: '不使用技能',
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
      prompt: '请选择要封锁的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要封锁该玩家吗？',
      bottomActionText: '不使用技能',
    },
  },

  gargoyleCheck: {
    id: 'gargoyleCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: [], // Can check self (neutral judge)
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'gargoyle',
      bottomActionText: '不使用技能',
    },
  },

  wolfRobotLearn: {
    id: 'wolfRobotLearn',
    displayName: '学习',
    kind: 'chooseSeat',
    constraints: ['notSelf'], // Cannot learn self
    canSkip: true,
    ui: {
      confirmTitle: '确认学习',
      prompt: '请选择要学习的玩家，如不使用请点击「不使用技能」',
      confirmText: '确定要学习该玩家吗？',
      revealKind: 'wolfRobot',
      bottomActionText: '不使用技能',
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
    displayName: '确认发动状态',
    kind: 'confirm',
    canSkip: true,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请点击下方按钮查看技能发动状态',
      confirmText: '确定查看黑狼王发动状态吗？',
      bottomActionText: '查看发动状态',
      // Status dialog (shown after user taps "查看发动状态")
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
    constraints: ['notSelf'],
    canSkip: false,
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择你的榜样',
      confirmText: '确定选择该玩家为榜样吗？',
      bottomActionText: '不使用技能',
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
