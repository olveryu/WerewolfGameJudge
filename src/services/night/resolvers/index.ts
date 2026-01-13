/**
 * Resolvers Registry (HOST-ONLY)
 * 
 * ⚠️ WARNING: This module MUST NOT be imported by UI code.
 * Use the import boundary test in __tests__/import-boundary.test.ts to enforce this.
 */

import type { ResolverRegistry } from './types';
import { seerCheckResolver } from './seer';
import { witchActionResolver } from './witch';
import { wolfKillResolver } from './wolf';
import { guardProtectResolver } from './guard';
import { nightmareBlockResolver } from './nightmare';
import { psychicCheckResolver } from './psychic';
import { dreamcatcherDreamResolver } from './dreamcatcher';
import { magicianSwapResolver } from './magician';
import { gargoyleCheckResolver } from './gargoyle';
import { wolfRobotLearnResolver } from './wolfRobot';
import { wolfQueenCharmResolver } from './wolfQueen';
import { slackerChooseIdolResolver } from './slacker';
import { hunterConfirmResolver } from './hunter';
import { darkWolfKingConfirmResolver } from './darkWolfKing';

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
