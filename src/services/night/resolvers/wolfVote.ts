/**
 * Wolf Meeting Vote Resolver (HOST-ONLY)
 *
 * Validates a single wolf vote in the wolf meeting phase.
 * Note: This is NOT a night action step resolver, but a meeting vote validator.
 *
 * ⚠️ WARNING: This module MUST NOT be imported by UI code.
 */

import { getWolfKillImmuneRoleIds, getRoleSpec } from '../../../models/roles';
import { isValidRoleId, type RoleId } from '../../../models/roles/spec/specs';

export interface WolfVoteInput {
  /** Target seat of the vote */
  targetSeat: number;
}

export interface WolfVoteContext {
  /** All players (seat -> roleId) - only roles with valid roleId are included */
  players: ReadonlyMap<number, RoleId>;
}

export interface WolfVoteResult {
  valid: boolean;
  rejectReason?: string;
  /** Display name of the target role (for error messages) */
  targetRoleName?: string;
}

/**
 * Validates whether a wolf vote target is valid.
 *
 * Checks:
 * 1. Target must exist
 * 2. Target must not have immuneToWolfKill flag
 */
export function wolfVoteResolver(
  context: WolfVoteContext,
  input: WolfVoteInput,
): WolfVoteResult {
  const { targetSeat } = input;
  const { players } = context;

  // Check target exists
  const targetRole = players.get(targetSeat);
  if (!targetRole) {
    return { valid: false, rejectReason: '目标不存在' };
  }

  // Check immuneToWolfKill
  const immuneRoleIds = getWolfKillImmuneRoleIds();
  if (immuneRoleIds.length > 0 && isValidRoleId(targetRole) && immuneRoleIds.includes(targetRole)) {
    const targetRoleSpec = getRoleSpec(targetRole);
    const targetRoleName = targetRoleSpec?.displayName ?? targetRole;
    return {
      valid: false,
      rejectReason: `不能投${targetRoleName}`,
      targetRoleName,
    };
  }

  return { valid: true };
}
