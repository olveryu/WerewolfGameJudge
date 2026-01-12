/**
 * Role Models Index
 * 
 * Central registry for all role models.
 * Import roles from here to access their configurations and logic.
 * 
 * Inheritance structure:
 * 
 * BaseRole (abstract)
 * ├── WolfBaseRole (abstract) - All wolves inherit from this
 * │   ├── WolfRole, WolfQueenRole, WolfKingRole, ...
 * │   └── (common: participatesInWolfVote, canSeeWolves)
 * ├── GodBaseRole (abstract) - All gods inherit from this
 * │   ├── SeerRole, WitchRole, HunterRole, ...
 * │   └── (common: faction = 'god')
 * ├── VillagerRole - Plain villager
 * └── SlackerRole - Special faction
 */

// Base classes and types
export * from './BaseRole';
export * from './WolfBaseRole';
export * from './GodBaseRole';

// Wolf roles
export * from './WolfRole';
export * from './WolfQueenRole';
export * from './WolfKingRole';
export * from './DarkWolfKingRole';
export * from './NightmareRole';
export * from './GargoyleRole';
export * from './BloodMoonRole';
export * from './WolfRobotRole';
export * from './SpiritKnightRole';

// God roles
export * from './SeerRole';
export * from './WitchRole';
export * from './HunterRole';
export * from './GuardRole';
export * from './IdiotRole';
export * from './GraveyardKeeperRole';
export * from './KnightRole';
export * from './CelebrityRole';
export * from './MagicianRole';
export * from './WitcherRole';
export * from './PsychicRole';

// Villager roles
export * from './VillagerRole';

// Special roles
export * from './SlackerRole';

// Import instances for registry
import { BaseRole, Faction } from './BaseRole';
import { wolfRole } from './WolfRole';
import { wolfQueenRole } from './WolfQueenRole';
import { wolfKingRole } from './WolfKingRole';
import { darkWolfKingRole } from './DarkWolfKingRole';
import { nightmareRole } from './NightmareRole';
import { gargoyleRole } from './GargoyleRole';
import { bloodMoonRole } from './BloodMoonRole';
import { wolfRobotRole } from './WolfRobotRole';
import { spiritKnightRole } from './SpiritKnightRole';
import { seerRole } from './SeerRole';
import { witchRole } from './WitchRole';
import { hunterRole } from './HunterRole';
import { guardRole } from './GuardRole';
import { idiotRole } from './IdiotRole';
import { graveyardKeeperRole } from './GraveyardKeeperRole';
import { knightRole } from './KnightRole';
import { celebrityRole } from './CelebrityRole';
import { magicianRole } from './MagicianRole';
import { witcherRole } from './WitcherRole';
import { psychicRole } from './PsychicRole';
import { villagerRole } from './VillagerRole';
import { slackerRole } from './SlackerRole';

/**
 * Role name type (all valid role IDs)
 */
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

/**
 * Registry of all role models
 * Maps role ID to role model instance
 */
export const ROLE_MODELS: Record<RoleName, BaseRole> = {
  // Wolves
  wolf: wolfRole,
  wolfQueen: wolfQueenRole,
  wolfKing: wolfKingRole,
  darkWolfKing: darkWolfKingRole,
  nightmare: nightmareRole,
  gargoyle: gargoyleRole,
  bloodMoon: bloodMoonRole,
  wolfRobot: wolfRobotRole,
  spiritKnight: spiritKnightRole,
  // Gods
  seer: seerRole,
  witch: witchRole,
  hunter: hunterRole,
  guard: guardRole,
  idiot: idiotRole,
  graveyardKeeper: graveyardKeeperRole,
  knight: knightRole,
  celebrity: celebrityRole,
  magician: magicianRole,
  witcher: witcherRole,
  psychic: psychicRole,
  // Villager
  villager: villagerRole,
  // Special
  slacker: slackerRole,
};

/**
 * Check if a string is a valid RoleName
 */
export function isValidRoleName(roleId: string): roleId is RoleName {
  return roleId in ROLE_MODELS;
}

/**
 * Get a role model by ID
 */
export function getRoleModel(roleId: string): BaseRole | undefined {
  if (isValidRoleName(roleId)) {
    return ROLE_MODELS[roleId];
  }
  return undefined;
}

/**
 * Check if a role can save itself (e.g., witch cannot)
 */
export function canRoleSaveSelf(roleId: string): boolean {
  const role = getRoleModel(roleId);
  return role?.canSaveSelf ?? true;
}

/**
 * Check if a role participates in wolf vote
 */
export function doesRoleParticipateInWolfVote(roleId: string): boolean {
  const role = getRoleModel(roleId);
  return role?.participatesInWolfVote ?? false;
}

/**
 * Check if a role can see other wolves
 */
export function canRoleSeeWolves(roleId: string): boolean {
  const role = getRoleModel(roleId);
  return role?.canSeeWolves ?? false;
}

/**
 * Check if a role is a wolf
 */
export function isWolfRole(roleId: string): boolean {
  const role = getRoleModel(roleId);
  return role?.isWolf ?? false;
}

/**
 * Check if a role has night action
 */
export function hasNightAction(roleId: string): boolean {
  const role = getRoleModel(roleId);
  return role?.hasNightAction ?? false;
}

/**
 * Get all wolves (roles that can see each other)
 */
export function getWolfRoles(): BaseRole[] {
  return Object.values(ROLE_MODELS).filter(role => role.canSeeWolves);
}

/**
 * Get roles sorted by action order
 */
export function getRolesByActionOrder(): BaseRole[] {
  return Object.values(ROLE_MODELS)
    .filter(role => role.hasNightAction)
    .sort((a, b) => a.actionOrder - b.actionOrder);
}

/**
 * Get action order array (role IDs sorted by action order)
 */
export function getActionOrder(): string[] {
  return getRolesByActionOrder().map(role => role.id);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(roleId: string): string {
  const role = getRoleModel(roleId);
  return role?.displayName ?? roleId;
}

/**
 * Get role description
 */
export function getRoleDescription(roleId: string): string {
  const role = getRoleModel(roleId);
  return role?.description ?? '';
}

// ============================================================
// Team (Camp) Display Names - Single Source of Truth
// ============================================================

/**
 * Team type for role camp classification
 */
export type Team = 'wolf' | 'good' | 'third';

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
  const role = getRoleModel(roleId);
  if (!role) return 'good';
  
  if (role.isWolf) return 'wolf';
  if (role.faction === Faction.Special) return 'third';
  return 'good';
}

/**
 * Get team display name for a role (for UI purposes - can include '第三方')
 */
export function getRoleTeamDisplayName(roleId: string): string {
  return TEAM_DISPLAY_NAMES[getRoleTeam(roleId)];
}

/**
 * Seer check result type - strictly binary, no third party
 */
export type SeerCheckResult = '好人' | '狼人';

/**
 * Get seer check result for a role.
 * IMPORTANT: Seer can only see binary '好人' or '狼人'.
 * - All wolf-faction roles (wolf, gargoyle, wolfQueen, etc.) → '狼人'
 * - All other roles (villager, god, third-party) → '好人'
 * This is the authoritative function for seer results.
 */
export function getSeerCheckResult(roleId: string): SeerCheckResult {
  return isWolfRole(roleId) ? '狼人' : '好人';
}

/**
 * Get all wolf role IDs
 */
export function getWolfRoleIds(): RoleName[] {
  return getWolfRoles().map(role => role.id) as RoleName[];
}

/**
 * Get night action order for a set of roles
 * Returns only roles that have night actions, sorted by action order
 */
export function getNightActionOrderForRoles(roles: RoleName[]): RoleName[] {
  const roleSet = new Set(roles);
  return getRolesByActionOrder()
    .filter(role => roleSet.has(role.id as RoleName))
    .map(role => role.id as RoleName);
}

// ============================================================
// Backward Compatibility Exports (previously in constants/roles.ts)
// ============================================================

/**
 * Role definition interface for backward compatibility
 */
export interface RoleDefinition {
  name: RoleName;
  displayName: string;
  type: Faction;
  description: string;
  actionMessage?: string;
  actionConfirmMessage?: string;
}

/**
 * Night action order (role IDs sorted by action order)
 */
export const ACTION_ORDER: RoleName[] = getRolesByActionOrder().map(r => r.id) as RoleName[];

/**
 * Role definitions record for backward compatibility
 */
function buildRolesRecord(): Record<RoleName, RoleDefinition> {
  const roles: Partial<Record<RoleName, RoleDefinition>> = {};
  for (const id of Object.keys(ROLE_MODELS) as RoleName[]) {
    const role = ROLE_MODELS[id];
    roles[id] = {
      name: id,
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
