/**
 * Wolf Kill Resolver (HOST-ONLY)
 *
 * Validates wolf kill action and computes result.
 */

import type { ResolverFn } from './types';
import { getRoleSpec, getWolfKillImmuneRoleIds } from '../../../models/roles';
import { isValidRoleId } from '../../../models/roles/spec/specs';

export const wolfKillResolver: ResolverFn = (context, input) => {
  const { players, currentNightResults, actorSeat } = context;
  const target = input.target;

  // Check if wolf kill is disabled (nightmare blocked a wolf)
  if (currentNightResults.wolfKillDisabled) {
    return {
      valid: true,
      result: {}, // No kill this night
    };
  }

  // 空刀 (empty knife): schema allows this via allowEmptyVote: true
  if (target === undefined || target === null) {
    return {
      valid: true,
      updates: {
        wolfVotesBySeat: {
          ...(currentNightResults.wolfVotesBySeat ?? {}),
          [String(actorSeat)]: -1,
        },
      },
      result: {}, // No kill target
    };
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
  if (immuneRoleIds.length > 0 && isValidRoleId(targetRoleId) && immuneRoleIds.includes(targetRoleId)) {
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
        ...(currentNightResults.wolfVotesBySeat ?? {}),
        [String(actorSeat)]: target,
      },
    },
  result: {},
  };
};
