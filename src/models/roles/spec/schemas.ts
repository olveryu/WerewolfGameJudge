/**
 * Action Schemas Registry
 * 
 * Single source of truth for all action input protocols.
 */

import type { ActionSchema, InlineSubStepSchema, CompoundSchema } from './schema.types';

export const SCHEMAS = {
  // === God actions ===
  seerCheck: {
    id: 'seerCheck',
    displayName: '查验',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
    ui: {
      confirmTitle: '确认查验',
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
        key: 'save',
        displayName: '救人',
        kind: 'chooseSeat',
        // NOTE: self-save legality is determined by Host via WITCH_CONTEXT.canSave.
        // UI uses this for generic disable/hint only; Host remains the judge.
        constraints: ['notSelf'],
        canSkip: true,
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择使用解药',
          confirmText: '确定使用解药吗？',
          bottomActionText: '不使用技能',
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
          prompt: '请选择使用毒药',
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
      confirmTitle: '确认通灵',
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
      confirmTitle: '确认行动',
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
      confirmTitle: '确认交换',
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
      confirmTitle: '确认行动',
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
      confirmTitle: '确认行动',
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
      confirmTitle: '确认行动',
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
      confirmTitle: '确认查验',
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
      confirmTitle: '确认学习',
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
      confirmTitle: '确认行动',
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

/**
 * Get a sub-step schema from a compound action.
 * 
 * @param schemaId - The compound schema ID (e.g., 'witchAction')
 * @param stepIndex - Index of the sub-step (0 = save, 1 = poison for witch)
 * @returns The inline sub-step schema, or undefined if not found
 */
export function getSubStepSchema(schemaId: SchemaId, stepIndex: number): InlineSubStepSchema | undefined {
  const schema = SCHEMAS[schemaId];
  if (schema.kind !== 'compound') return undefined;
  return (schema as CompoundSchema).steps[stepIndex];
}

/**
 * Get a sub-step schema by key from a compound action.
 * 
 * @param schemaId - The compound schema ID (e.g., 'witchAction')
 * @param stepKey - Key of the sub-step (e.g., 'save', 'poison')
 * @returns The inline sub-step schema, or undefined if not found
 */
export function getSubStepSchemaByKey(schemaId: SchemaId, stepKey: string): InlineSubStepSchema | undefined {
  const schema = SCHEMAS[schemaId];
  if (schema.kind !== 'compound') return undefined;
  return (schema as CompoundSchema).steps.find(s => s.key === stepKey);
}

// Re-export types
export * from './schema.types';
