/**
 * Nightmare Resolver (HOST-ONLY)
 *
 * Validates nightmare block action and computes result.
 *
 * RULE: If nightmare blocks a wolf, wolves cannot kill that night.
 */

import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import type { ResolverFn } from './types';

export const nightmareBlockResolver: ResolverFn = (context, input) => {
  const { players } = context;
  const target = input.target;

  // Validate target exists
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择恐惧对象' };
  }

  // Cannot block self
  // NOTE: Self-target is allowed in this app (neutral judge rule).
  // If nightmare blocks a wolf (including themselves), wolves cannot kill this night.

  // Night-1-only scope: no cross-night restriction.

  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Check if target is a wolf (special rule: wolves can't kill if nightmare blocks a wolf)
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
