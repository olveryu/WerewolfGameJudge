/**
 * Hunter Confirm Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验猎人确认行动（仅确认身份，无目标选择）
 *
 * ✅ 允许：确认行动校验
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { ResolverFn } from '@werewolf/game-engine/resolvers/types';

export const hunterConfirmResolver: ResolverFn = () => {
  // Hunter confirm is always valid
  // Block guard (blocked → reject confirmed=true; not blocked → reject skip) is at handler layer
  return {
    valid: true,
    result: {},
  };
};
