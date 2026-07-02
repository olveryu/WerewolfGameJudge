/**
 * Role Registry - Spec-based Facade
 *
 * Single source of truth for all role definitions.
 * All role data comes from ROLE_SPECS.
 *
 * No class hierarchy, no BaseRole - pure declarative data.
 * Re-exports spec types and constants, provides derived query functions (getRoleSpec / isWolfRole etc).
 * No service dependencies, no side effects, no resolver logic.
 */

import { getEngineLogger } from '../../../utils/logger';

const roleLog = getEngineLogger().extend('Role');

// ============================================================
// Re-export from spec/
// ============================================================
export {
  // Camp statistics
  CAMP_ORDER,
  type CampBucket,
  getRoleCamp,
} from './camp';
export {
  // Night Plan
  buildNightPlan,
  type NightPlan,
  type NightPlanStep,
} from './spec';
export {
  type ActionSchema,
  getSchema,
  type RevealKind,
  type SchemaId,
  // Schemas
  SCHEMAS,
} from './spec';
export {
  getAllRoleIds,
  getRoleDisplayAs,
  getRoleEmoji,
  getRoleSpec,
  getRoleStructuredDescription,
  isValidRoleId,
  // Role Spec
  ROLE_SPECS,
  type RoleAbilityTag,
  type RoleGroupTag,
  type RoleId,
} from './spec';
export {
  // Types
  Faction,
  Team,
} from './spec/types';

// ============================================================
// Re-imports from spec/ (for internal use)
// ============================================================
import { getAllRoleIds, getRoleSpec, isValidRoleId, ROLE_SPECS, type RoleId } from './spec';
import type { RoleSpec } from './spec/roleSpec.types';
import { Team } from './spec/types';

// ============================================================
// Display Name Helpers (UI-facing)
// ============================================================

/**
 * Get role display name (Chinese).
 * Falls back to '未知角色' for unknown roleIds, with warning log.
 *
 * @param roleId - The role ID to look up
 * @returns The Chinese display name (e.g., '平民', '狼人', '预言家')
 */
export function getRoleDisplayName(roleId: string): string {
  if (!isValidRoleId(roleId)) {
    roleLog.warn('Unknown roleId', { roleId });
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
  const spec: RoleSpec = getRoleSpec(roleId);
  return spec.recognition?.canSeeWolves ?? false;
}

/**
 * Check if a role participates in wolf vote
 *
 * IMPORTANT:
 * - participatesInWolfVote only indicates "whether the role participates in wolfKill (wolf vote) meeting/vote"
 * - canSeeWolves only indicates "whether the role can see/highlight wolf teammates during the wolf-visible phase"
 *   (e.g. Wolf Robot / Awakened Gargoyle: do NOT participate, so even though they are wolf-faction
 *    they should not enter the vote flow; their individual action steps are not wolfVote schema either,
 *    so they will not trigger the wolf-visible UI)
 */
export function doesRoleParticipateInWolfVote(roleId: string): boolean {
  if (!isValidRoleId(roleId)) return false;
  const spec: RoleSpec = getRoleSpec(roleId);

  // Participation is explicitly configured per role (single source of truth).
  // We intentionally do NOT infer from team/faction here.
  // - team/faction is for seer result / UI highlighting
  // - recognition.participatesInWolfVote is for whether this role submits WOLF_VOTE
  return spec.recognition?.participatesInWolfVote ?? false;
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
    const spec: RoleSpec = ROLE_SPECS[id];
    return spec.immunities?.some((i) => i.kind === 'wolfAttack') === true;
  });
}

// ============================================================
// Seer Check
// ============================================================
