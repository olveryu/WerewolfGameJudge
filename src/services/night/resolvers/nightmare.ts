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
  const { actorSeat, players, previousActions } = context;
  const target = input.target;
  
  // Validate target exists
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择恐惧对象' };
  }
  
  // Cannot block self
  if (target === actorSeat) {
    return { valid: false, rejectReason: '不能恐惧自己' };
  }
  
  // Cannot block same player two nights in a row
  const lastBlockedTarget = previousActions?.get('nightmare');
  if (lastBlockedTarget === target) {
    return { valid: false, rejectReason: '不能连续两晚恐惧同一玩家' };
  }
  
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
