/**
 * Role Registry - Spec-based Facade
 *
 * Single source of truth for all role definitions.
 * All role data comes from ROLE_SPECS.
 *
 * No class hierarchy, no BaseRole - pure declarative data.
 *
 * ✅ 允许：re-export spec 类型/常量、派生查询函数（getRoleSpec / isWolfRole 等）
 * ❌ 禁止：import service / 副作用 / resolver 逻辑
 */

import { log } from '../../utils/logger';

const roleLog = log.extend('Role');

// ============================================================
// Re-export from spec/
// ============================================================
export {
  // Types
  Faction,
  type Team,
  getSeerCheckResultForTeam,
} from './spec/types';

export {
  // Role Spec
  ROLE_SPECS,
  getRoleSpec,
  isValidRoleId,
  getAllRoleIds,
  type RoleId,
} from './spec/specs';

export { getNight1ActionRoles } from './spec/nightSteps';

export {
  // Schemas
  SCHEMAS,
  getSchema,
  type ActionSchema,
  type SchemaId,
} from './spec/schemas';

export {
  // Night Plan
  buildNightPlan,
  type NightPlan,
  type NightPlanStep,
} from './spec/plan';

// ============================================================
// Re-imports from spec/ (for internal use)
// ============================================================
import { ROLE_SPECS, getRoleSpec, isValidRoleId, getAllRoleIds, type RoleId } from './spec/specs';
import type { Team, SeerCheckResult } from './spec/types';

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

/**
 * Get role English name
 */
export function getRoleEnglishName(roleId: string): string {
  if (!isValidRoleId(roleId)) return roleId;
  const spec = getRoleSpec(roleId) as { englishName?: string };
  if (spec?.englishName) return spec.englishName;
  return roleId.charAt(0).toUpperCase() + roleId.slice(1);
}

// ============================================================
// Team & Faction Helpers
// ============================================================

/**
 * Team display names in Chinese
 */
export const TEAM_DISPLAY_NAMES: Record<Team, string> = {
  wolf: '狼人',
  good: '好人',
  third: '第三方',
} as const;

/**
 * Get team display name in Chinese
 */
export function getTeamDisplayName(team: Team): string {
  return TEAM_DISPLAY_NAMES[team];
}

/**
 * Get team for a role
 */
export function getRoleTeam(roleId: string): Team {
  if (!isValidRoleId(roleId)) return 'good';
  const spec = getRoleSpec(roleId);
  return spec?.team ?? 'good';
}

/**
 * Get team display name for a role
 */
export function getRoleTeamDisplayName(roleId: string): string {
  return TEAM_DISPLAY_NAMES[getRoleTeam(roleId)];
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
  return spec?.team === 'wolf';
}

/**
 * Check if a role can see other wolves
 */
export function canRoleSeeWolves(roleId: string): boolean {
  if (!isValidRoleId(roleId)) return false;
  const spec = getRoleSpec(roleId) as { wolfMeeting?: { canSeeWolves?: boolean } };
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
  const spec = getRoleSpec(roleId) as { wolfMeeting?: { participatesInWolfVote?: boolean } };
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
  return getAllRoleIds().filter((id) => ROLE_SPECS[id].team === 'wolf');
}

/**
 * Get all role IDs that are immune to wolf kill.
 * These roles cannot be targeted by wolf vote/kill.
 * (e.g., spiritKnight, wolfQueen)
 */
export function getWolfKillImmuneRoleIds(): RoleId[] {
  return getAllRoleIds().filter((id) => {
    const spec = ROLE_SPECS[id] as { flags?: { immuneToWolfKill?: boolean } };
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

/**
 * Get seer check result for a role.
 * IMPORTANT: Seer can only see binary '好人' or '狼人'.
 * - All wolf-faction roles → '狼人'
 * - All other roles (god, villager, third-party) → '好人'
 */
export function getSeerCheckResult(roleId: string): SeerCheckResult {
  return isWolfRole(roleId) ? '狼人' : '好人';
}
