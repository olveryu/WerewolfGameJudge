/**
 * Wolf Kill Resolver (HOST-ONLY)
 *
 * Validates wolf kill action and computes result.
 *
 * RULE: If wolfKillDisabled (nightmare blocked a wolf), non-empty vote is REJECTED.
 */

import type { ResolverFn } from './types';
import { getRoleSpec, getWolfKillImmuneRoleIds } from '../../../models/roles';
import { isValidRoleId } from '../../../models/roles/spec/specs';
import { BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec';

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
