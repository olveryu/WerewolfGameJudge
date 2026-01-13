/**
 * Role Models Index
 * 
 * Central registry for all role models.
 * Import roles from here to access their configurations and logic.
 * 
 * Directory structure:
 * 
 * roles/
 * ├── base/           - Base classes (BaseRole, WolfBaseRole, GodBaseRole)
 * ├── wolf/           - Basic wolf roles (Wolf)
 * ├── skilled-wolf/   - Skilled wolf roles (WolfQueen, WolfKing, DarkWolfKing, Nightmare, Gargoyle, etc.)
 * ├── god/            - God roles (Seer, Witch, Hunter, Guard, Dreamcatcher, etc.)
 * ├── villager/       - Villager roles (Villager)
 * ├── third-party/    - Third-party roles (Slacker)
 * └── index.ts        - This file (central registry)
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
export * from './base/BaseRole';
export * from './base/WolfBaseRole';
export * from './base/GodBaseRole';

// Skilled wolf roles (wolves with special abilities)
export * from './skilled-wolf/WolfQueenRole';
export * from './skilled-wolf/WolfKingRole';
export * from './skilled-wolf/DarkWolfKingRole';
export * from './skilled-wolf/NightmareRole';
export * from './skilled-wolf/GargoyleRole';
export * from './skilled-wolf/BloodMoonRole';
export * from './skilled-wolf/WolfRobotRole';
export * from './skilled-wolf/SpiritKnightRole';

// God roles
export * from './god/SeerRole';
export * from './god/WitchRole';
export * from './god/HunterRole';
export * from './god/GuardRole';
export * from './god/KnightRole';
export * from './god/MagicianRole';
export * from './god/WitcherRole';
export * from './god/PsychicRole';
export * from './god/IdiotRole';
export * from './god/DreamcatcherRole';
export * from './god/GraveyardKeeperRole';

// Villager roles
export * from './villager/VillagerRole';

// Third-party roles
export * from './third-party/SlackerRole';

// Import instances for registry
import { BaseRole, Faction } from './base/BaseRole';
import { wolfRole } from './wolf/WolfRole';
import { wolfQueenRole } from './skilled-wolf/WolfQueenRole';
import { wolfKingRole } from './skilled-wolf/WolfKingRole';
import { darkWolfKingRole } from './skilled-wolf/DarkWolfKingRole';
import { nightmareRole } from './skilled-wolf/NightmareRole';
import { gargoyleRole } from './skilled-wolf/GargoyleRole';
import { bloodMoonRole } from './skilled-wolf/BloodMoonRole';
import { wolfRobotRole } from './skilled-wolf/WolfRobotRole';
import { spiritKnightRole } from './skilled-wolf/SpiritKnightRole';
import { seerRole } from './god/SeerRole';
import { witchRole } from './god/WitchRole';
import { hunterRole } from './god/HunterRole';
import { guardRole } from './god/GuardRole';
import { knightRole } from './god/KnightRole';
import { magicianRole } from './god/MagicianRole';
import { witcherRole } from './god/WitcherRole';
import { psychicRole } from './god/PsychicRole';
import { idiotRole } from './god/IdiotRole';
import { dreamcatcherRole } from './god/DreamcatcherRole';
import { graveyardKeeperRole } from './god/GraveyardKeeperRole';
import { villagerRole } from './villager/VillagerRole';
import { slackerRole } from './third-party/SlackerRole';

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
  celebrity: dreamcatcherRole, // Dreamcatcher (摄梦人) - role id kept as 'celebrity' for backward compatibility
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
 * Get all wolf-faction roles (camp classification).
 * IMPORTANT: This is NOT the same as "wolves who meet at night".
 */
export function getWolfFactionRoles(): BaseRole[] {
  return Object.values(ROLE_MODELS).filter(role => role.isWolf);
}

/**
 * Get the wolf pack roles (wolves who "meet" / can see wolves at night).
 * This is used for night UI visibility.
 */
export function getWolfPackRoles(): BaseRole[] {
  return getWolfFactionRoles().filter(role => role.canSeeWolves);
}

/**
 * Check if a role participates in wolf vote
 */
export function doesRoleParticipateInWolfVote(roleId: string): boolean {
  const role = getRoleModel(roleId);
  if (!role) return false;
  if (!role.isWolf) return false;
  // RULE: non-meeting wolves can't vote
  if (!role.canSeeWolves) return false;
  return role.participatesInWolfVote ?? false;
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
 * Get roles sorted by action order
 */
export function getRolesByActionOrder(): BaseRole[] {
  return Object.values(ROLE_MODELS)
    .filter(role => role.hasNightAction)
    .sort((a, b) => a.actionOrder - b.actionOrder);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(roleId: string): string {
  const role = getRoleModel(roleId);
  return role?.displayName ?? roleId;
}

/**
 * Get role English name
 * Returns the englishName if defined, otherwise derives from role id (capitalize first letter)
 */
export function getRoleEnglishName(roleId: string): string {
  const role = getRoleModel(roleId);
  if (!role) return roleId;
  if (role.englishName) return role.englishName;
  // Derive from id: 'celebrity' -> 'Celebrity', 'wolfQueen' -> 'WolfQueen'
  return roleId.charAt(0).toUpperCase() + roleId.slice(1);
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
  return getWolfFactionRoles().map(role => role.id) as RoleName[];
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
