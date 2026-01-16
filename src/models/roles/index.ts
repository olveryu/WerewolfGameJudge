/**
 * Role Registry - Spec-based Facade
 * 
 * Single source of truth for all role definitions.
 * All role data comes from ROLE_SPECS.
 * 
 * No class hierarchy, no BaseRole - pure declarative data.
 */

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
  getNight1ActionRoles,
  type RoleId,
} from './spec/specs';

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
// RoleName (backward compatibility alias for RoleId)
// ============================================================
import { ROLE_SPECS, getRoleSpec, isValidRoleId, getAllRoleIds } from './spec/specs';
import { Faction, type Team } from './spec/types';

/**
 * Role name type - alias for RoleId for backward compatibility
 */
export type RoleName = keyof typeof ROLE_SPECS;

/**
 * Check if a string is a valid RoleName
 */
export function isValidRoleName(roleId: string): roleId is RoleName {
  return isValidRoleId(roleId);
}

// ============================================================
// Display Info (UI-facing helpers)
// ============================================================

/**
 * Display information for UI rendering.
 * Derived from RoleSpec - no game logic.
 * 
 * NOTE: Action-related copy (prompt/confirm) is now schema-driven (SCHEMAS[*].ui.*).
 * RoomScreen no longer consumes RoleDisplayInfo for action copy.
 */
export interface RoleDisplayInfo {
  displayName: string;
  description: string;
  faction: Faction;
}

/**
 * Get role display info from RoleSpec.
 */
export function getRoleDisplayInfo(roleId: string): RoleDisplayInfo | undefined {
  if (!isValidRoleId(roleId)) return undefined;
  
  const spec = getRoleSpec(roleId);
  
  return {
    displayName: spec.displayName,
    description: spec.description,
    faction: spec.faction,
  };
}

/**
 * Get role display name
 */
export function getRoleDisplayName(roleId: string): string {
  if (!isValidRoleId(roleId)) return roleId;
  const spec = getRoleSpec(roleId);
  return spec?.displayName ?? roleId;
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
 */
export function doesRoleParticipateInWolfVote(roleId: string): boolean {
  if (!isValidRoleId(roleId)) return false;
  const spec = getRoleSpec(roleId);
  if (!spec) return false;
  if (spec.team !== 'wolf') return false;
  if (!spec.wolfMeeting?.canSeeWolves) return false;
  return spec.wolfMeeting?.participatesInWolfVote ?? false;
}

/**
 * Get all wolf role IDs
 */
export function getWolfRoleIds(): RoleName[] {
  return getAllRoleIds().filter(id => ROLE_SPECS[id].team === 'wolf');
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

/**
 * Get night action order via NightPlan
 */
export function getActionOrderViaNightPlan(roles: RoleName[]): RoleName[] {
  const { buildNightPlan } = require('./spec/plan');
  const plan = buildNightPlan(roles);
  return plan.steps.map((step: { roleId: string }) => step.roleId as RoleName);
}

// ============================================================
// Seer Check
// ============================================================

/**
 * Seer check result type - strictly binary
 */
export type SeerCheckResult = '好人' | '狼人';

/**
 * Get seer check result for a role.
 * IMPORTANT: Seer can only see binary '好人' or '狼人'.
 * - All wolf-faction roles → '狼人'
 * - All other roles (god, villager, third-party) → '好人'
 */
export function getSeerCheckResult(roleId: string): SeerCheckResult {
  return isWolfRole(roleId) ? '狼人' : '好人';
}

// ============================================================
// Backward Compatibility - ROLES record
// ============================================================

/**
 * Role definition interface for backward compatibility
 */
export interface RoleDefinition {
  name: RoleName;
  displayName: string;
  type: Faction;
  description: string;
}

/**
 * Build ROLES record from ROLE_SPECS
 */
function buildRolesRecord(): Record<RoleName, RoleDefinition> {
  const roles: Partial<Record<RoleName, RoleDefinition>> = {};
  for (const id of getAllRoleIds()) {
    const spec = ROLE_SPECS[id];
    roles[id] = {
      name: id,
      displayName: spec.displayName,
      type: spec.faction,
      description: spec.description,
    };
  }
  return roles as Record<RoleName, RoleDefinition>;
}

/**
 * Role definitions record for backward compatibility
 */
export const ROLES: Record<RoleName, RoleDefinition> = buildRolesRecord();
