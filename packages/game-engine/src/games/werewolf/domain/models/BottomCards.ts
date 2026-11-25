/**
 * Bottom-card rules shared by template validation, dealing, and state validation.
 *
 * Which roles set cards aside, how many, and which combinations are legal is
 * declared by those roles (`useBottomCardSelection` in their role files). This
 * module applies the declarations; it has no random source and names no role.
 */

import { WEREWOLF_PRESENCE_DECLARATIONS } from '../../roles';
import { getWerewolfRoleDefinition } from '../../roles/nightPlan';
import {
  type BottomCardDeck,
  type DealCard,
  resolveNightPresenceFacts,
} from '../../roles/presence';
import { getAllRoleIds, type RoleId } from './roles';

const DECKS: ReadonlyMap<string, BottomCardDeck> = new Map(
  resolveNightPresenceFacts(getAllRoleIds(), WEREWOLF_PRESENCE_DECLARATIONS).bottomCardDecks.map(
    ({ role, deck }) => [role, deck],
  ),
);

function requireDeck(roleId: RoleId): BottomCardDeck {
  const deck = DECKS.get(roleId);
  if (deck === undefined) throw new Error(`[FAIL-FAST] ${roleId} sets no bottom cards aside`);
  return deck;
}

function toDealCard(roleId: RoleId): DealCard {
  return { roleId, faction: getWerewolfRoleDefinition(roleId).traits.faction };
}

/** Every role that sets bottom cards aside, in the order roles are listed to players. */
export function getBottomCardRoleIds(): RoleId[] {
  return getAllRoleIds().filter((roleId) => DECKS.has(roleId));
}

/** Count physical bottom-card actor cards in a template role multiset. */
export function countBottomCardRoles(roles: readonly RoleId[]): number {
  return roles.filter((roleId) => DECKS.has(roleId)).length;
}

/** Return the sole bottom-card actor, rejecting ambiguous role multisets. */
export function getBottomCardRoleId(roles: readonly RoleId[]): RoleId | null {
  const matches = roles.filter((roleId) => DECKS.has(roleId));
  if (matches.length > 1) {
    throw new Error('[FAIL-FAST] A template must contain at most one bottom-card actor');
  }
  return matches[0] ?? null;
}

/** Return the number of cards dealt to the template's bottom-card actor. */
export function getBottomCardCount(roles: readonly RoleId[]): number {
  const roleId = getBottomCardRoleId(roles);
  return roleId === null ? 0 : getBottomCardCountForRole(roleId);
}

/** Return the fixed deck size for a known bottom-card actor. */
export function getBottomCardCountForRole(roleId: RoleId): number {
  return requireDeck(roleId).size;
}

/** Whether plague mode deals this bottom-card actor as a villager, with no deck. */
export function isBottomCardRoleRemovedInPlagueMode(roleId: RoleId): boolean {
  return DECKS.get(roleId)?.isRemovedInPlagueMode === true;
}

/**
 * Why this board can never give its bottom-card actor a legal deck, in the
 * actor's own words; null when the board has no such actor or no objection.
 */
export function getBottomCardBoardRequirement(roles: readonly RoleId[]): string | null {
  const actorRoleId = getBottomCardRoleId(roles);
  if (actorRoleId === null) return null;
  const otherCards = roles.filter((roleId) => roleId !== actorRoleId).map(toDealCard);
  return requireDeck(actorRoleId).boardRequirement?.(otherCards) ?? null;
}

/** Validate a complete bottom-card set for its actor. */
export function isValidBottomCardSet(cards: readonly RoleId[], actorRoleId: RoleId): boolean {
  const deck = requireDeck(actorRoleId);
  if (cards.length !== deck.size) return false;
  // A card that itself sets cards aside, or that may never be set aside, cannot be in a deck.
  const hasExcludedCard = cards.some(
    (roleId) =>
      DECKS.has(roleId) || getWerewolfRoleDefinition(roleId).traits.cannotBeBottomCard === true,
  );
  return !hasExcludedCard && deck.isLegal(cards.map(toDealCard));
}

function collectIndexCombinations(
  itemCount: number,
  selectionCount: number,
  startIndex: number,
  selected: number[],
  combinations: number[][],
): void {
  if (selected.length === selectionCount) {
    combinations.push([...selected]);
    return;
  }

  const remainingSlots = selectionCount - selected.length;
  for (let index = startIndex; index <= itemCount - remainingSlots; index += 1) {
    selected.push(index);
    collectIndexCombinations(itemCount, selectionCount, index + 1, selected, combinations);
    selected.pop();
  }
}

/**
 * Enumerate legal physical-card partitions for a template.
 *
 * Repeated role IDs remain distinct cards, so index-based combinations preserve
 * the correct deal weighting without inventing role identities.
 */
export function getValidBottomCardDeals(
  roles: readonly RoleId[],
  actorRoleId: RoleId,
): readonly {
  readonly seatedRoles: readonly RoleId[];
  readonly bottomCards: readonly RoleId[];
}[] {
  const combinations: number[][] = [];
  collectIndexCombinations(
    roles.length,
    getBottomCardCountForRole(actorRoleId),
    0,
    [],
    combinations,
  );

  const deals: {
    readonly seatedRoles: readonly RoleId[];
    readonly bottomCards: readonly RoleId[];
  }[] = [];

  for (const bottomCardIndexes of combinations) {
    const indexSet = new Set(bottomCardIndexes);
    const bottomCards = roles.filter((_, index) => indexSet.has(index));
    if (!isValidBottomCardSet(bottomCards, actorRoleId)) continue;
    deals.push({
      seatedRoles: roles.filter((_, index) => !indexSet.has(index)),
      bottomCards,
    });
  }

  return deals;
}
