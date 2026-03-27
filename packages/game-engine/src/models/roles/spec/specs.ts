/**
 * Role Specs Registry — re-export layer (to be removed in P9-C)
 */
import type { RoleDescription, RoleSpec } from './v2/roleSpec.types';
import { ROLE_SPECS, type RoleId } from './v2/specs';

// Re-export types and registry
export { ROLE_SPECS, type RoleId };
export type { RoleDescription };
// Re-export RoleSpec from roleSpec.types (cannot use same local name)
export type { RoleSpec } from './v2/roleSpec.types';

/** Get spec by ID */
export function getRoleSpec<K extends RoleId>(id: K): (typeof ROLE_SPECS)[K] {
  return ROLE_SPECS[id];
}

/**
 * Get the displayAs target for a role.
 * Returns the RoleId the role masquerades as (for player-facing display),
 * or undefined if the role shows its own identity.
 */
export function getRoleDisplayAs(roleId: RoleId): RoleId | undefined {
  const spec: RoleSpec = ROLE_SPECS[roleId];
  return spec.displayAs as RoleId | undefined;
}

/**
 * Get the emoji icon for a role (text character).
 */
export function getRoleEmoji(roleId: RoleId): string {
  return ROLE_SPECS[roleId].emoji;
}

/** Check if a string is a valid RoleId */
export function isValidRoleId(id: string): id is RoleId {
  return id in ROLE_SPECS;
}

/**
 * Get structured description for card UI rendering.
 * Returns undefined if the role has no structured description (falls back to flat text).
 */
export function getRoleStructuredDescription(roleId: RoleId): RoleDescription | undefined {
  return ROLE_SPECS[roleId].structuredDescription;
}

/** Get all role IDs */
export function getAllRoleIds(): RoleId[] {
  return Object.keys(ROLE_SPECS) as RoleId[];
}
