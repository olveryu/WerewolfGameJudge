/**
 * Nightmare Resolver (HOST-ONLY)
 *
 * Validates nightmare block action and computes result.
 *
 * RULE: If nightmare blocks ANY wolf (team='wolf'), wolves cannot kill that night.
 *       This includes all wolf-faction roles: wolf, nightmare, wolfQueen, darkWolfKing,
 *       gargoyle, wolfRobot, spiritKnight, etc.
 */

import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import type { ResolverFn } from './types';

export const nightmareBlockResolver: ResolverFn = (context, input) => {
  const { players } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // NOTE: Self-target is allowed in this app (neutral judge rule).
  // If nightmare blocks ANY wolf, wolves cannot kill this night.

  // Night-1-only scope: no cross-night restriction.

  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Check if target is ANY wolf (team='wolf')
  // ALL wolf-faction roles trigger wolfKillDisabled (including gargoyle, wolfRobot)
  const targetSpec = ROLE_SPECS[targetRoleId];
  const blockedWolf = targetSpec.team === 'wolf';

  return {
    valid: true,
    updates: {
      blockedSeat: target,
      wolfKillDisabled: blockedWolf ? true : undefined,
    },
    result: { blockedTarget: target },
  };
};
