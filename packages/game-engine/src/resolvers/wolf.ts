/**
 * Wolf Kill Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验袭击行动合法性 + 计算袭击结果，
 * 提供袭击校验与 wolfKillOverride 检查（nightmare 封锁 / poisoner 板子规则）。
 * 不包含 IO（网络 / 音频 / Alert），不添加 notSelf/notWolf 约束（袭击是中立的，可袭击任意座位）。
 *
 * RULE: If wolfKillOverride exists (nightmare / poisoner), non-empty vote is REJECTED.
 */

import { getRoleSpec, getWolfKillImmuneRoleIds, isValidRoleId } from '../models';
import type { ResolverFn } from './types';

export const wolfKillResolver: ResolverFn = (context, input) => {
  const { players, currentNightResults, actorSeat } = context;
  const target = input.target;

  // 放弃袭击 (empty kill): schema allows this via allowEmptyVote: true
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

  // Wolf kill override: non-empty vote is REJECTED
  if (currentNightResults.wolfKillOverride) {
    return { valid: false, rejectReason: currentNightResults.wolfKillOverride.ui.rejectMessage };
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
      rejectReason: `${targetRoleName}免疫袭击，不能选为目标`,
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
