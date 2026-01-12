/**
 * Role Constants
 * 
 * Re-exports from role models for backward compatibility.
 * Prefer importing from '@/models/roles' directly for new code.
 */

// Re-export types and constants from role models
export { 
  Faction, 
  Team, 
  TEAM_DISPLAY_NAMES, 
  ROLE_MODELS,
  SeerCheckResult,
} from '../models/roles';

import { 
  ROLE_MODELS, 
  getRolesByActionOrder, 
  isWolfRole as isWolfRoleFromModels,
  hasNightAction as hasNightActionFromModels,
  getRoleDisplayName as getRoleDisplayNameFromModels,
  getRoleTeam as getRoleTeamFromModels,
  getRoleTeamDisplayName as getRoleTeamDisplayNameFromModels,
  getTeamDisplayName as getTeamDisplayNameFromModels,
  getNightActionOrderForRoles as getNightActionOrderForRolesFromModels,
  getWolfRoleIds as getWolfRoleIdsFromModels,
  getSeerCheckResult as getSeerCheckResultFromModels,
  Faction,
  Team,
  SeerCheckResult,
} from '../models/roles';

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

// Get role display name (from registry)
export const getRoleDisplayName = (role: RoleName): string => getRoleDisplayNameFromModels(role);

// Get role team (wolf/good/third)
export const getRoleTeam = (role: RoleName): Team => getRoleTeamFromModels(role);

// Get team display name in Chinese
export const getTeamDisplayName = (team: Team): string => getTeamDisplayNameFromModels(team);

// Get role team display name (for UI - can include '第三方')
export const getRoleTeamDisplayName = (role: RoleName): string => getRoleTeamDisplayNameFromModels(role);

// Get night action order for a set of roles
export const getNightActionOrderForRoles = (roles: RoleName[]): RoleName[] => 
  getNightActionOrderForRolesFromModels(roles);

// Get all wolf role IDs
export const getWolfRoleIds = (): RoleName[] => getWolfRoleIdsFromModels();

// Get seer check result - strictly binary '好人' or '狼人'
export const getSeerCheckResult = (role: RoleName): SeerCheckResult => getSeerCheckResultFromModels(role);
