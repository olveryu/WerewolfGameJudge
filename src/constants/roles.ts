/**
 * Role Constants
 * 
 * Re-exports from role models for backward compatibility.
 * Prefer importing from '@/models/roles' directly for new code.
 */

import { 
  ROLE_MODELS, 
  getRolesByActionOrder, 
  Faction,
  isWolfRole as isWolfRoleFromModels,
  hasNightAction as hasNightActionFromModels,
} from '../models/roles';

// Re-export Faction enum
export { Faction };

// Define RoleName as literal union type for backward compatibility
export type RoleName =
  | 'villager'
  | 'wolf'
  | 'wolfQueen'
  | 'wolfKing'
  | 'darkWolfKing'
  | 'nightmare'
  | 'gargoyle'
  | 'bloodMoon'
  | 'wolfRobot'
  | 'spiritKnight'
  | 'seer'
  | 'hunter'
  | 'witch'
  | 'guard'
  | 'idiot'
  | 'graveyardKeeper'
  | 'slacker'
  | 'knight'
  | 'celebrity'
  | 'magician'
  | 'witcher'
  | 'psychic';

export interface RoleDefinition {
  name: RoleName;
  displayName: string;
  type: Faction;
  description: string;
  actionMessage?: string;
  actionConfirmMessage?: string;
}

// Night action order (derived from role models)
export const ACTION_ORDER: RoleName[] = getRolesByActionOrder().map(r => r.id) as RoleName[];

// Role definitions (derived from role models)
function buildRolesRecord(): Record<RoleName, RoleDefinition> {
  const roles: Record<string, RoleDefinition> = {};
  for (const [id, role] of Object.entries(ROLE_MODELS)) {
    roles[id] = {
      name: id as RoleName,
      displayName: role.displayName,
      type: role.faction,
      description: role.description,
      actionMessage: role.actionMessage,
      actionConfirmMessage: role.actionConfirmMessage,
    };
  }
  return roles as Record<RoleName, RoleDefinition>;
}

export const ROLES: Record<RoleName, RoleDefinition> = buildRolesRecord();

// Check if a role is a wolf (for night phase)
export const isWolfRole = (role: RoleName): boolean => isWolfRoleFromModels(role);

// Check if a role has night action (derived from role models)
export const hasNightAction = (role: RoleName): boolean => hasNightActionFromModels(role);
