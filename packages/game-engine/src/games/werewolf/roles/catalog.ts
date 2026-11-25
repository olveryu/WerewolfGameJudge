/**
 * The role catalog — every role's display data and classification, read
 * from the role files. This is the only place the rest of the app looks
 * up a role's name, description, icon, faction, or wolf recognition.
 */

import { WEREWOLF_ROLE_DEFINITIONS } from './index';
import type {
  RoleAbilityTag,
  RoleDescription,
  WerewolfRoleDefinition,
  WerewolfRoleFaction,
  WerewolfRoleTeam,
} from './role';

/** Card colour and board grouping of a role. */
export enum Faction {
  Wolf = 'Wolf',
  God = 'God',
  Villager = 'Villager',
  Special = 'Special',
}

/** The side a role wins with at the start of the game. */
export enum Team {
  Wolf = 'Wolf',
  Good = 'Good',
  Third = 'Third',
}

export type RoleId = (typeof WEREWOLF_ROLE_DEFINITIONS)[number]['id'];

/** A role as the app displays and classifies it. */
export interface RoleCard {
  readonly id: RoleId;
  readonly displayName: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly englishName?: string;
  readonly description: string;
  readonly structuredDescription: RoleDescription;
  readonly tags?: readonly RoleAbilityTag[];
  readonly faction: Faction;
  readonly team: Team;
  /** The role this one is shown as to its holder and in public labels. */
  readonly displayAs?: RoleId;
  /** The night steps this role owns, in the order it declares them. */
  readonly nightStepIds: readonly string[];
}

const FACTIONS: Readonly<Record<WerewolfRoleFaction, Faction>> = {
  wolf: Faction.Wolf,
  god: Faction.God,
  villager: Faction.Villager,
  special: Faction.Special,
};

const TEAMS: Readonly<Record<WerewolfRoleTeam, Team>> = {
  wolf: Team.Wolf,
  good: Team.Good,
  third: Team.Third,
};

const DEFINITIONS: ReadonlyMap<string, WerewolfRoleDefinition> = new Map(
  WEREWOLF_ROLE_DEFINITIONS.map((role) => [role.id, role]),
);

/** Type guard for a registered role id. */
export function isValidRoleId(id: string): id is RoleId {
  return DEFINITIONS.has(id);
}

function createRoleCard(role: WerewolfRoleDefinition): RoleCard {
  if (!isValidRoleId(role.id)) throw new Error(`[FAIL-FAST] Unregistered role ${role.id}`);
  const displayAs = role.traits.displayAs;
  if (displayAs !== undefined && !isValidRoleId(displayAs)) {
    throw new Error(`[FAIL-FAST] ${role.id} is displayed as unknown role ${displayAs}`);
  }
  return {
    id: role.id,
    displayName: role.card.name,
    shortName: role.card.shortName,
    emoji: role.card.emoji,
    ...(role.card.englishName === undefined ? {} : { englishName: role.card.englishName }),
    description: role.card.description,
    structuredDescription: role.card.sections,
    ...(role.card.tags === undefined ? {} : { tags: role.card.tags }),
    faction: FACTIONS[role.traits.faction],
    team: TEAMS[role.traits.team],
    ...(displayAs === undefined ? {} : { displayAs }),
    nightStepIds: role.steps.map((step) => step.id),
  };
}

const CARDS: ReadonlyMap<RoleId, RoleCard> = new Map(
  WEREWOLF_ROLE_DEFINITIONS.map((role) => [role.id, createRoleCard(role)]),
);

/** The card of a registered role. */
export function getRoleCard(id: RoleId): RoleCard {
  const card = CARDS.get(id);
  if (card === undefined) throw new Error(`[FAIL-FAST] Unknown Werewolf role ID: ${id}`);
  return card;
}

/** Every role id, in the order roles are listed to players. */
export function getAllRoleIds(): RoleId[] {
  return WEREWOLF_ROLE_DEFINITIONS.map((role) => role.id);
}

function requireDefinition(roleId: string): WerewolfRoleDefinition {
  const role = DEFINITIONS.get(roleId);
  if (role === undefined) throw new Error(`[FAIL-FAST] Unknown Werewolf role ID: ${roleId}`);
  return role;
}

export function getRoleDisplayName(roleId: string): string {
  return requireDefinition(roleId).card.name;
}

/** The role shown in place of this one, when it is disguised. */
export function getRoleDisplayAs(roleId: RoleId): RoleId | undefined {
  return getRoleCard(roleId).displayAs;
}

export function getRoleStructuredDescription(roleId: RoleId): RoleDescription {
  return getRoleCard(roleId).structuredDescription;
}

/** Whether the role belongs to the wolf team. */
export function isWolfRole(roleId: string): boolean {
  return DEFINITIONS.get(roleId)?.traits.team === 'wolf';
}

/** Whether the role takes part in the wolves' vote. */
export function doesRoleParticipateInWolfVote(roleId: string): boolean {
  return DEFINITIONS.get(roleId)?.traits.recognition?.participatesInWolfVote === true;
}
