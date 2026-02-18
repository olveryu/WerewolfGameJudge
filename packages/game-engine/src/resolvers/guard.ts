/**
 * Guard Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验守卫守护行动 + 计算守护结果，
 * 提供守护目标校验与结果计算（含跳过守护）。不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { ResolverFn } from './types';

export const guardProtectResolver: ResolverFn = (context, input) => {
  const target = input.target;

  // Guard can skip (choose not to protect anyone)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Night-1-only scope: no cross-night restriction.

  return {
    valid: true,
    updates: { guardedSeat: target },
    result: { guardedTarget: target },
  };
};
