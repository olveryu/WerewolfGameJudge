/**
 * VotebanElder Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验禁票长老行动 + 计算禁票结果。
 * 禁票长老每晚可禁票一位玩家，被禁票者放逐环节不能投票。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 * NOTE: "不能连续两天禁票同一位玩家" 属于跨夜约束，Night-1-only scope 不实现。
 */

import type { ResolverFn } from './types';

export const votebanElderBanResolver: ResolverFn = (context, input) => {
  const target = input.target;

  // Schema allows skip (canSkip: true)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Target must exist
  const targetRoleId = context.players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // No constraints (can vote-ban self, per user requirement)
  // Night-1-only scope: no cross-night restriction.

  return {
    valid: true,
    updates: { votebannedSeat: target },
    result: { votebanTarget: target },
  };
};
