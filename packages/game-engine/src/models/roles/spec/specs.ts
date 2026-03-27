/**
 * Role Specs Registry — V2-based canonical exports
 *
 * Single source of truth for all role definitions.
 * All role data comes from ROLE_SPECS_V2 in v2/specs.ts.
 *
 * 36 roles total:
 * - Villager faction: villager, mirrorSeer, drunkSeer (3)
 * - God faction: seer, witch, hunter, guard, idiot, knight, magician, witcher, psychic,
 *   dreamcatcher, graveyardKeeper, pureWhite, dancer, silenceElder, votebanElder (15)
 * - Wolf faction: wolf, wolfQueen, wolfKing, darkWolfKing, nightmare, gargoyle,
 *   awakenedGargoyle, bloodMoon, wolfRobot, wolfWitch, spiritKnight, masquerade, warden (13)
 * - Third-party: slacker, wildChild, piper, shadow, avenger (5)
 *
 * V2 re-export layer. Helper functions preserved for backward compatibility.
 * Not dependent on services or side effects.
 */
import type { RoleDescription, RoleSpecV2 } from './v2/roleSpec.types';
import { ROLE_SPECS_V2, type RoleIdV2 } from './v2/specs';

/** Canonical role specs registry */
export const ROLE_SPECS = ROLE_SPECS_V2;

/** Role ID type (auto-derived from V2 registry keys) */
export type RoleId = RoleIdV2;

/** Role Spec type alias */
export type RoleSpec = RoleSpecV2;

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
  const spec: RoleSpecV2 = ROLE_SPECS[roleId];
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
