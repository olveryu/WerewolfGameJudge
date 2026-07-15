/**
 * Wolf Kill Resolver (SERVER-ONLY, pure function)
 *
 * Validates attack action legality and computes attack result.
 * Provides attack validation and wolfKillOverride checks (nightmare block / poisoner board rules).
 * No IO (network / audio / Alert). Does not enforce notSelf/notWolf constraints (attack is neutral; any seat may be targeted).
 *
 * RULE: If wolfKillOverride exists (nightmare / poisoner), non-empty vote is REJECTED.
 */

import { getRoleSpec, getWolfKillImmuneRoleIds, isValidRoleId } from '../models';
import type { ResolverFn } from './types';

export const wolfKillResolver: ResolverFn = (context, input) => {
  const { players, currentNightResults, actorSeat } = context;
  const target = input.target;

  // Skip attack (empty kill): schema allows this via allowEmptyVote: true
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

  // Withdraw: wire sentinel -2, removes this wolf's vote record
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
  // This is a vote-time forbidden target (blocked seat), not a death-resolution effect.
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
