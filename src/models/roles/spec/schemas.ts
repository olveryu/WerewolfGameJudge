/**
 * Action Schemas Registry
 * 
 * Single source of truth for all action input protocols.
 */

import type { ActionSchema } from './schema.types';

export const SCHEMAS = {
  // === God actions ===
  seerCheck: {
    id: 'seerCheck',
    displayName: '查验',
    kind: 'chooseSeat',
  constraints: [],
    canSkip: false,
  },

  witchAction: {
    id: 'witchAction',
    displayName: '女巫行动',
    kind: 'compound',
    steps: [
      {
        stepId: 'save',
        displayName: '救人',
        kind: 'chooseSeat',
  constraints: ['notSelf'],
        canSkip: true,
      },
      {
        stepId: 'poison',
        displayName: '毒人',
        kind: 'chooseSeat',
        constraints: [],
        canSkip: true,
      },
    ],
  },

  guardProtect: {
    id: 'guardProtect',
    displayName: '守护',
    kind: 'chooseSeat',
    constraints: [],
    canSkip: true,
  },

  psychicCheck: {
    id: 'psychicCheck',
    displayName: '通灵',
    kind: 'chooseSeat',
  constraints: [],
    canSkip: false,
  },

  dreamcatcherDream: {
    id: 'dreamcatcherDream',
    displayName: '摄梦',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: false,
  },

  magicianSwap: {
    id: 'magicianSwap',
    displayName: '交换',
    kind: 'swap',
    constraints: [],
    canSkip: true,
  },

  hunterConfirm: {
    id: 'hunterConfirm',
    displayName: '确认发动状态',
    kind: 'confirm',
  },

  // === Wolf actions ===
  wolfKill: {
    id: 'wolfKill',
    displayName: '狼刀',
    kind: 'wolfVote',
    constraints: [],  // 'notWolf' 由 resolver 校验
  },

  wolfQueenCharm: {
    id: 'wolfQueenCharm',
    displayName: '魅惑',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: true,
  },

  nightmareBlock: {
    id: 'nightmareBlock',
    displayName: '恐惧',
    kind: 'chooseSeat',
  constraints: [],
    canSkip: false,
  },

  gargoyleCheck: {
    id: 'gargoyleCheck',
    displayName: '查验',
    kind: 'chooseSeat',
  constraints: [],
    canSkip: false,
  },

  wolfRobotLearn: {
    id: 'wolfRobotLearn',
    displayName: '学习',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: false,
  },

  darkWolfKingConfirm: {
    id: 'darkWolfKingConfirm',
    displayName: '确认发动状态',
    kind: 'confirm',
  },

  // === Third-party actions ===
  slackerChooseIdol: {
    id: 'slackerChooseIdol',
    displayName: '选择榜样',
    kind: 'chooseSeat',
    constraints: ['notSelf'],
    canSkip: false,
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
