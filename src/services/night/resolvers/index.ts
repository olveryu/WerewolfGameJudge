/**
 * Resolvers Registry (HOST-ONLY)
 *
 * 职责：注册 SchemaId → ResolverFn 的映射表，供 actionHandler 调用
 *
 * ✅ 允许：注册 resolver 映射
 * ❌ 禁止：被 UI 代码 import（import boundary test 强制）
 *
 * ⚠️ WARNING: This module MUST NOT be imported by UI code.
 * Use the import boundary test in __tests__/import-boundary.test.ts to enforce this.
 */

import { darkWolfKingConfirmResolver } from './darkWolfKing';
import { dreamcatcherDreamResolver } from './dreamcatcher';
import { gargoyleCheckResolver } from './gargoyle';
import { guardProtectResolver } from './guard';
import { hunterConfirmResolver } from './hunter';
import { magicianSwapResolver } from './magician';
import { nightmareBlockResolver } from './nightmare';
import { psychicCheckResolver } from './psychic';
import { seerCheckResolver } from './seer';
import { slackerChooseIdolResolver } from './slacker';
import type { ResolverRegistry } from './types';
import { witchActionResolver } from './witch';
import { wolfKillResolver } from './wolf';
import { wolfQueenCharmResolver } from './wolfQueen';
import { wolfRobotLearnResolver } from './wolfRobot';

export const RESOLVERS: ResolverRegistry = {
  seerCheck: seerCheckResolver,
  witchAction: witchActionResolver,
  wolfKill: wolfKillResolver,
  guardProtect: guardProtectResolver,
  nightmareBlock: nightmareBlockResolver,
  psychicCheck: psychicCheckResolver,
  dreamcatcherDream: dreamcatcherDreamResolver,
  magicianSwap: magicianSwapResolver,
  gargoyleCheck: gargoyleCheckResolver,
  wolfRobotLearn: wolfRobotLearnResolver,
  wolfQueenCharm: wolfQueenCharmResolver,
  slackerChooseIdol: slackerChooseIdolResolver,
  hunterConfirm: hunterConfirmResolver,
  darkWolfKingConfirm: darkWolfKingConfirmResolver,
};

// Re-export types for convenience (HOST-ONLY consumers)
export * from './types';
