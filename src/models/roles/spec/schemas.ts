/**
 * Action Schemas Registry
 * 
 * Single source of truth for all action input protocols.
 */

import type { ActionSchema } from './schema.types';

export const SCHEMAS = {
  // === Compound sub-steps (used by compound schemas) ===
  // NOTE: These are normal schema IDs so RoomScreen can be fully schema-driven.
  witchSave: {
    id: 'witchSave',
    displayName: '救人',
    kind: 'chooseSeat',
    // NOTE: self-save legality is determined by Host via WITCH_CONTEXT.canSave.
    // UI uses this for generic disable/hint only; Host remains the judge.
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      prompt: '请选择使用解药',
      confirmText: '确定使用解药吗？',
      bottomActionText: '不使用技能',
    },
  },

  witchPoison: {
    id: 'witchPoison',
    displayName: '毒人',
    kind: 'chooseSeat',
    constraints: [],
    canSkip: true,
    ui: {
      prompt: '请选择使用毒药',
      confirmText: '确定使用毒药吗？',
      bottomActionText: '不使用技能',
    },
  },

  // === God actions ===
  seerCheck: {
    id: 'seerCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      prompt: '请选择要查验的玩家',
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
    },
    steps: [
      {
  stepSchemaId: 'witchSave',
      },
      {
  stepSchemaId: 'witchPoison',
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
      prompt: '请选择要守护的玩家',
      confirmText: '确定要守护该玩家吗？',
  bottomActionText: '不使用技能',
    },
  },

  psychicCheck: {
    id: 'psychicCheck',
    displayName: '通灵',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
  canSkip: true,
    ui: {
      prompt: '请选择要通灵的玩家',
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
    canSkip: false,
    ui: {
      prompt: '请选择要摄梦的玩家',
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
      prompt: '请选择要交换的两名玩家',
      confirmText: '确定要交换这两名玩家吗？',
  bottomActionText: '不使用技能',
    },
  },

  hunterConfirm: {
    id: 'hunterConfirm',
    displayName: '确认发动状态',
    kind: 'confirm',
    ui: {
      prompt: '猎人请确认是否可以发动技能',
      confirmText: '确定查看猎人发动状态吗？',
    },
  },

  // === Wolf actions ===
  wolfKill: {
    id: 'wolfKill',
    displayName: '狼刀',
    kind: 'wolfVote',
    constraints: [],  // Neutral judge: wolves can target ANY seat
    ui: {
      prompt: '请选择要猎杀的玩家',
      confirmText: '确定要猎杀该玩家吗？',
      emptyVoteText: '空刀',
    },
  },

  wolfQueenCharm: {
    id: 'wolfQueenCharm',
    displayName: '魅惑',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      prompt: '请选择要魅惑的玩家',
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
      prompt: '请选择要封锁的玩家',
      confirmText: '确定要封锁该玩家吗？',
  bottomActionText: '不使用技能',
    },
  },

  gargoyleCheck: {
    id: 'gargoyleCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      prompt: '请选择要查验的玩家',
      confirmText: '确定要查验该玩家吗？',
      revealKind: 'gargoyle',
  bottomActionText: '不使用技能',
    },
  },

  wolfRobotLearn: {
    id: 'wolfRobotLearn',
    displayName: '学习',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      prompt: '请选择要学习的玩家',
      confirmText: '确定要学习该玩家吗？',
      revealKind: 'wolfRobot',
  bottomActionText: '不使用技能',
    },
  },

  darkWolfKingConfirm: {
    id: 'darkWolfKingConfirm',
    displayName: '确认发动状态',
    kind: 'confirm',
    ui: {
      prompt: '黑狼王请确认是否可以发动技能',
      confirmText: '确定查看黑狼王发动状态吗？',
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
