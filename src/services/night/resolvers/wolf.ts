/**
 * Wolf Kill Resolver (HOST-ONLY)
 * 
 * Validates wolf kill action and computes result.
 */

import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import type { ResolverFn } from './types';

export const wolfKillResolver: ResolverFn = (context, input) => {
  const { players, currentNightResults } = context;
  const target = input.target;
  
  // Check if wolf kill is disabled (nightmare blocked a wolf)
  if (currentNightResults.wolfKillDisabled) {
    return { 
      valid: true, 
      result: {},  // No kill this night
    };
  }
  
  // Validate target exists
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择猎杀对象' };
  }
  
  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }
  
  // Cannot kill a wolf (resolver-level validation)
  const targetSpec = ROLE_SPECS[targetRoleId];
  if (targetSpec.team === 'wolf') {
    return { valid: false, rejectReason: '不能选择狼人队友' };
  }
  
  return {
    valid: true,
    updates: { wolfKillTarget: target },
    result: { wolfKillTarget: target },
  };
};
