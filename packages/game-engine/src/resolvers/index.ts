/**
 * Resolvers Registry (SERVER-ONLY)
 *
 * 职责：注册 SchemaId → ResolverFn 的映射表，供 actionHandler 调用，
 * 导出 resolver 映射注册。不被 UI 代码 import（import boundary test 强制）。
 *
 * ⚠️ WARNING: This module MUST NOT be imported by UI code.
 * Use the import boundary test in __tests__/import-boundary.test.ts to enforce this.
 */

import {
  awakenedGargoyleConvertResolver,
  awakenedGargoyleConvertRevealResolver,
} from './awakenedGargoyle';
import { createGenericResolver } from './genericResolver';
import { magicianSwapResolver } from './magician';
import { piperHypnotizedRevealResolver, piperHypnotizeResolver } from './piper';
import { shadowChooseMimicResolver } from './shadow';
import type { ResolverRegistry } from './types';
import { witchActionResolver } from './witch';
import { wolfKillResolver } from './wolf';

export const RESOLVERS: ResolverRegistry = {
  // --- Generic resolvers (data-driven from ROLE_SPECS_V2) ---
  // P2: writeSlot / charm / chooseIdol
  guardProtect: createGenericResolver('guard'),
  dreamcatcherDream: createGenericResolver('dreamcatcher'),
  silenceElderSilence: createGenericResolver('silenceElder'),
  votebanElderBan: createGenericResolver('votebanElder'),
  wolfQueenCharm: createGenericResolver('wolfQueen'),
  slackerChooseIdol: createGenericResolver('slacker'),
  wildChildChooseIdol: createGenericResolver('wildChild'),
  // P3: check (faction + identity)
  seerCheck: createGenericResolver('seer'),
  mirrorSeerCheck: createGenericResolver('mirrorSeer'),
  drunkSeerCheck: createGenericResolver('drunkSeer'),
  psychicCheck: createGenericResolver('psychic'),
  gargoyleCheck: createGenericResolver('gargoyle'),
  pureWhiteCheck: createGenericResolver('pureWhite'),
  wolfWitchCheck: createGenericResolver('wolfWitch'),
  // P4: block / learn / confirm
  nightmareBlock: createGenericResolver('nightmare'),
  wolfRobotLearn: createGenericResolver('wolfRobot'),
  hunterConfirm: createGenericResolver('hunter'),
  darkWolfKingConfirm: createGenericResolver('darkWolfKing'),
  avengerConfirm: createGenericResolver('avenger'),

  // --- Custom resolvers (complex logic not expressible declaratively) ---
  witchAction: witchActionResolver,
  wolfKill: wolfKillResolver,
  magicianSwap: magicianSwapResolver,
  shadowChooseMimic: shadowChooseMimicResolver,
  awakenedGargoyleConvert: awakenedGargoyleConvertResolver,
  awakenedGargoyleConvertReveal: awakenedGargoyleConvertRevealResolver,
  piperHypnotize: piperHypnotizeResolver,
  piperHypnotizedReveal: piperHypnotizedRevealResolver,
};

// Re-export types for convenience (SERVER-ONLY consumers)
export * from './types';
