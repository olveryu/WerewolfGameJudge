/** Demo dealing seam (TODO(gameplay) content lives here). */

import { DEMO_TODO_IDENTITY, type DemoState } from '../state/types';

/**
 * The demo playing stage is an idle stage: it opens when the host
 * begins the game and settles when this deadline expires through the
 * scheduled `demo.settle.due` effect (the #162 delivery form). The
 * duration only exists so the full chain has a real stage deadline to
 * arm, deliver and settle against.
 */
export const DEMO_STAGE_DURATION_MS = 60_000;

/**
 * TODO(gameplay): 发牌接缝。契约（不许改）：
 * - 恰好为每个已占座位返回一个身份（不多不少），键为座位号；
 * - 身份构成（有哪些身份、各几个）由本游戏的构成表决定，人数即构成；
 * - 分配必须随机（洗牌走 platform/random 的 secureRng/shuffleArray，
 *   禁 Math.random），且不得依赖座位之外的隐藏状态。
 * 骨架实现给每个座位发占位身份，使查看检查点与开始门可以端到端跑通；
 * 换上真实构成后，把 state/types.ts 的身份类型从 string 收紧为身份枚举，
 * 并同步 parseState 的身份解析与 visibility 的裁剪。
 */
export function dealDemoIdentities(state: DemoState): Readonly<Record<number, string>> {
  const identities: Record<number, string> = {};
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (state.roster[seat] != null) identities[seat] = DEMO_TODO_IDENTITY;
  }
  return identities;
}
