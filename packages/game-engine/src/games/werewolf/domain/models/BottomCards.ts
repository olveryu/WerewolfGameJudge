/**
 * Bottom-card rules shared by template validation, dealing, and state validation.
 *
 * This module owns deck-role cardinality and legal card combinations. It has no
 * random source, state mutation, or resolver dependency.
 */

import { Faction, getRoleSpec, type RoleId } from './roles';

export type BottomCardRoleId = 'treasureMaster' | 'thief';

const BOTTOM_CARD_COUNTS: Readonly<Record<BottomCardRoleId, number>> = {
  treasureMaster: 3,
  thief: 2,
};

function isBottomCardRoleId(roleId: RoleId): roleId is BottomCardRoleId {
  return roleId === 'treasureMaster' || roleId === 'thief';
}

/** Count physical bottom-card actor cards in a template role multiset. */
export function countBottomCardRoles(roles: readonly RoleId[]): number {
  return roles.filter(isBottomCardRoleId).length;
}

/** Return the sole bottom-card actor, rejecting ambiguous role multisets. */
export function getBottomCardRoleId(roles: readonly RoleId[]): BottomCardRoleId | null {
  const matches = roles.filter(isBottomCardRoleId);
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
export function getBottomCardCountForRole(roleId: BottomCardRoleId): number {
  return BOTTOM_CARD_COUNTS[roleId];
}

/** Validate a complete bottom-card set for its actor. */
export function isValidBottomCardSet(
  cards: readonly RoleId[],
  actorRoleId: BottomCardRoleId,
): boolean {
  if (cards.length !== getBottomCardCountForRole(actorRoleId)) return false;
  if (cards.includes(actorRoleId) || cards.includes('cupid')) return false;

  const wolfCount = cards.filter((roleId) => getRoleSpec(roleId).faction === Faction.Wolf).length;

  if (actorRoleId === 'thief') return wolfCount <= 1;

  const godCount = cards.filter((roleId) => getRoleSpec(roleId).faction === Faction.God).length;
  const villagerCount = cards.filter(
    (roleId) => getRoleSpec(roleId).faction === Faction.Villager,
  ).length;
  return wolfCount === 1 && godCount === 1 && villagerCount === 1 && cards.includes('wolf');
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
  actorRoleId: BottomCardRoleId,
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
