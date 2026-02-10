/**
 * Wolf Kill Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验狼刀行动合法性 + 计算刀人结果
 *
 * ✅ 允许：校验狼刀 + 检查 wolfKillDisabled（nightmare 阻断）
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 * ❌ 禁止：添加 notSelf/notWolf 约束（狼刀是中立的，可刀任意座位）
 *
 * RULE: If wolfKillDisabled (nightmare blocked a wolf), non-empty vote is REJECTED.
 */

import { getRoleSpec, getWolfKillImmuneRoleIds } from '@/models/roles';
import { isValidRoleId } from '@/models/roles';
import { BLOCKED_UI_DEFAULTS } from '@/models/roles/spec';

import type { ResolverFn } from './types';

export const wolfKillResolver: ResolverFn = (context, input) => {
  const { players, currentNightResults, actorSeat } = context;
  const target = input.target;

  // 空刀 (empty knife): schema allows this via allowEmptyVote: true
  // This is always valid, even when wolfKillDisabled
  if (target === undefined || target === null) {
    return {
      valid: true,
      updates: {
        wolfVotesBySeat: {
          ...currentNightResults.wolfVotesBySeat,
          [String(actorSeat)]: -1,
        },
      },
      result: {}, // No kill target
    };
  }

  // 撤回（withdraw）：wire sentinel -2，删除该狼的投票记录
  if (target === -2) {
    const { [String(actorSeat)]: _removed, ...rest } = currentNightResults.wolfVotesBySeat ?? {};
    return {
      valid: true,
      updates: { wolfVotesBySeat: rest },
      result: {},
    };
  }

  // Check if wolf kill is disabled (nightmare blocked a wolf)
  // Non-empty vote is REJECTED when disabled
  if (currentNightResults.wolfKillDisabled) {
    return { valid: false, rejectReason: BLOCKED_UI_DEFAULTS.message };
  }

  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Game rule: immune-to-wolf-kill roles are NOT selectable during wolf meeting.
  // This is a vote-time forbidden target ("禁选"), not a death-resolution effect.
  // If forbidden, we must reject and NOT record the vote.
  const immuneRoleIds = getWolfKillImmuneRoleIds();
  if (
    immuneRoleIds.length > 0 &&
    isValidRoleId(targetRoleId) &&
    immuneRoleIds.includes(targetRoleId)
  ) {
    const targetRoleSpec = getRoleSpec(targetRoleId);
    const targetRoleName = targetRoleSpec?.displayName ?? targetRoleId;
    return {
      valid: false,
      rejectReason: `不能投${targetRoleName}`,
    };
  }

  // Neutral judge: wolves can target ANY seat (including self / wolf teammates),
  // except forbidden targets in the wolf meeting (e.g. immune roles).

  return {
    valid: true,
    updates: {
      wolfVotesBySeat: {
        ...currentNightResults.wolfVotesBySeat,
        [String(actorSeat)]: target,
      },
    },
    result: {},
  };
};
