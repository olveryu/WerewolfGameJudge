/**
 * Role Registry - Spec-based Facade
 *
 * Single source of truth for all role definitions.
 * All role data comes from ROLE_SPECS.
 *
 * No class hierarchy, no BaseRole - pure declarative data.
 * Re-export spec 类型与常量，提供派生查询函数（getRoleSpec / isWolfRole 等），
 * 不依赖 service、不含副作用或 resolver 逻辑。
 */

import { getEngineLogger } from '../../utils/logger';

const roleLog = getEngineLogger().extend('Role');

// ============================================================
// Re-export from spec/
// ============================================================
export {
  // Night Plan
  buildNightPlan,
  type NightPlan,
  type NightPlanStep,
} from './spec/plan';
export {
  type ActionSchema,
  getSchema,
  type RevealKind,
  type SchemaId,
  // Schemas
  SCHEMAS,
} from './spec/schemas';
export {
  getAllRoleIds,
  getRoleDisplayAs,
  getRoleEmoji,
  getRoleSpec,
  isValidRoleId,
  // Role Spec
  ROLE_SPECS,
  type RoleId,
} from './spec/specs';
export {
  // Types
  Faction,
  getSeerCheckResultForTeam,
  Team,
} from './spec/types';

// ============================================================
// Re-imports from spec/ (for internal use)
// ============================================================
import type { RoleSpec } from './spec/spec.types';
import { getAllRoleIds, getRoleSpec, isValidRoleId, ROLE_SPECS, type RoleId } from './spec/specs';
import { Team } from './spec/types';

// ============================================================
// Display Name Helpers (UI-facing)
// ============================================================

/**
 * Get role display name (Chinese).
 * Falls back to '未知角色' for unknown roleIds, with warning log.
 *
 * @param roleId - The role ID to look up
 * @returns The Chinese display name (e.g., '普通村民', '狼人', '预言家')
 */
export function getRoleDisplayName(roleId: string): string {
  if (!isValidRoleId(roleId)) {
    roleLog.warn(`Unknown roleId: ${roleId}`);
    return '未知角色';
  }
  const spec = getRoleSpec(roleId);
  return spec?.displayName ?? '未知角色';
}

// ============================================================
// Wolf-related Helpers
// ============================================================

/**
 * Check if a role is a wolf
 */
export function isWolfRole(roleId: string): boolean {
  if (!isValidRoleId(roleId)) return false;
  const spec = getRoleSpec(roleId);
  return spec?.team === Team.Wolf;
}

/**
 * Check if a role can see other wolves
 */
export function canRoleSeeWolves(roleId: string): boolean {
  if (!isValidRoleId(roleId)) return false;
  const spec = getRoleSpec(roleId) as RoleSpec;
  return spec?.wolfMeeting?.canSeeWolves ?? false;
}

/**
 * Check if a role participates in wolf vote
 *
 * IMPORTANT:
 * - participatesInWolfVote 仅表示“是否参与 wolfKill（wolf vote）会议/投票”
 * - canSeeWolves 仅表示“在狼队可见阶段，是否能看到/高亮狼队友”
 *   （例如机械狼/石像鬼：不参会，因此即使是狼阵营也不应该进入投票流程；
 *    他们各自行动的步骤也不是 wolfVote schema，自然不会触发狼队可见 UI）
 */
export function doesRoleParticipateInWolfVote(roleId: string): boolean {
  if (!isValidRoleId(roleId)) return false;
  const spec = getRoleSpec(roleId) as RoleSpec;
  if (!spec) return false;

  // Participation is explicitly configured per role (single source of truth).
  // We intentionally do NOT infer from team/faction here.
  // - team/faction is for seer result / UI highlighting
  // - wolfMeeting.participatesInWolfVote is for whether this role submits WOLF_VOTE
  return spec.wolfMeeting?.participatesInWolfVote ?? false;
}

/**
 * Get all wolf role IDs
 */
export function getWolfRoleIds(): RoleId[] {
  return getAllRoleIds().filter((id) => ROLE_SPECS[id].team === Team.Wolf);
}

/**
 * Get all role IDs that are immune to wolf kill.
 * These roles cannot be targeted by wolf vote/kill.
 * (e.g., spiritKnight, wolfQueen)
 */
export function getWolfKillImmuneRoleIds(): RoleId[] {
  return getAllRoleIds().filter((id) => {
    const spec = ROLE_SPECS[id] as RoleSpec;
    return spec.flags?.immuneToWolfKill === true;
  });
}

// ============================================================
// Night Action Helpers
// ============================================================

/**
 * Check if a role has night action
 */
export function hasNightAction(roleId: string): boolean {
  if (!isValidRoleId(roleId)) return false;
  const spec = getRoleSpec(roleId);
  return spec?.night1.hasAction ?? false;
}

// ============================================================
// Seer Check
// ============================================================

// Re-export SeerCheckResult from types.ts (single source of truth)
export type { SeerCheckResult } from './spec/types';
