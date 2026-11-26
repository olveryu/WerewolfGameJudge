/** 身份轮次：共享牌堆按类型计数，逐张按剩余数量加权抽取、不放回。 */

import { createSeededRng, randomIntInclusive } from '../../../platform/random/random';
import type { ToolboxIdentityConfig, ToolboxIdentityRound } from '../state/types';

export function createToolboxIdentityRound(
  config: ToolboxIdentityConfig,
  participantUserIds: readonly string[],
): ToolboxIdentityRound {
  return {
    config,
    remaining: config.identities.map((identity) => identity.count),
    hands: participantUserIds.map((userId) => ({ userId, identityIndexes: [] })),
  };
}

/**
 * 从共享牌堆抽一张，返回身份下标。牌堆为空说明开始/重开时的牌数校验或
 * 配额守恒被破坏，属于不变量错误，直接失败。
 */
export function drawToolboxIdentityIndex(round: ToolboxIdentityRound, randomSeed: string): number {
  const total = round.remaining.reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    throw new Error('[FAIL-FAST] toolbox identity round has an empty deck');
  }
  let position = randomIntInclusive(
    0,
    total - 1,
    createSeededRng(`${randomSeed}:toolbox:identity`),
  );
  for (const [index, count] of round.remaining.entries()) {
    if (position < count) return index;
    position -= count;
  }
  throw new Error(`[FAIL-FAST] toolbox identity draw position exceeded the deck`);
}
