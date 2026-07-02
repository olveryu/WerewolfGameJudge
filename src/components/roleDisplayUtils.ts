/**
 * roleDisplayUtils - shared role-display utilities
 *
 * Provides faction-name derivation, shared by multiple RoleCard components.
 * Exports pure functions (derived from ROLE_SPECS).
 * No service imports, no side effects or React hooks. Colors are defined per-component by theme.
 *
 * Role emoji is consolidated into RoleSpec.emoji (SSOT), accessed via getRoleEmoji().
 */
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { getRoleSpec, isWolfRole } from '@werewolf/game-engine/werewolf/models/roles';
import { Faction } from '@werewolf/game-engine/werewolf/models/roles/spec/types';

/** Get Chinese faction name from roleId */
export const getFactionName = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '狼人阵营';
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return '神职阵营';
  if (spec?.faction === Faction.Special) return '第三方阵营';
  return '好人阵营';
};
