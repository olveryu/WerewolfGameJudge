/**
 * Semantic invariants for authoritative Werewolf state.
 *
 * Called at persistence and broadcast boundaries. Invalid state is rejected;
 * this module never repairs, drops, or synthesizes game facts.
 */

import {
  Faction,
  GameStatus,
  getBottomCardRoleId,
  getPlayerCount,
  getRoleDealPool,
  getRoleSpec,
  isValidBottomCardSet,
  type RoleId,
  validateTemplateRoles,
} from '../models';
import type { GameState } from '../protocol/types';

function fail(message: string): never {
  throw new Error(`[FAIL-FAST] Invalid Werewolf state: ${message}`);
}

function assertNoBottomCardRuntimeState(state: GameState): void {
  if (state.bottomCards !== undefined) fail('bottomCards exist without an active bottom-card deal');
  if (state.treasureMasterSeat !== undefined) {
    fail('treasureMasterSeat exists without an active treasure-master deal');
  }
  if (state.thiefSeat !== undefined) fail('thiefSeat exists without an active thief deal');
  if (state.currentNightResults?.treasureMasterChosenCard !== undefined) {
    fail('treasureMasterChosenCard exists without an active treasure-master deal');
  }
  if (state.currentNightResults?.thiefChosenCard !== undefined) {
    fail('thiefChosenCard exists without an active thief deal');
  }
}

function assertBottomCardActor(
  state: GameState,
  actorSeat: number | undefined,
  actorRoleId: 'treasureMaster' | 'thief',
): number {
  if (actorSeat === undefined) fail(`${actorRoleId} deal has no actor seat`);
  const actor = state.players[actorSeat];
  if (actor === undefined || actor === null)
    fail(`${actorRoleId} actor seat ${actorSeat} is empty`);
  if (actor.role !== actorRoleId) {
    fail(`${actorRoleId} actor seat ${actorSeat} contains ${actor.role ?? 'no role'}`);
  }
  return actorSeat;
}

function assertChosenCardBelongsToDeck(
  chosenRoleId: RoleId,
  bottomCards: readonly RoleId[],
  actorRoleId: 'treasureMaster' | 'thief',
): void {
  if (!bottomCards.includes(chosenRoleId)) {
    fail(`${actorRoleId} chose ${chosenRoleId}, which is not in bottomCards`);
  }
}

function countRoles(roles: readonly RoleId[]): Map<RoleId, number> {
  const counts = new Map<RoleId, number>();
  for (const roleId of roles) counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
  return counts;
}

function assertSameRoleMultiset(
  actualRoles: readonly RoleId[],
  expectedRoles: readonly RoleId[],
  description: string,
): void {
  const actual = countRoles(actualRoles);
  const expected = countRoles(expectedRoles);
  const roleIds = new Set([...actual.keys(), ...expected.keys()]);
  for (const roleId of roleIds) {
    if ((actual.get(roleId) ?? 0) !== (expected.get(roleId) ?? 0)) {
      fail(`${description} do not match the role deal pool at ${roleId}`);
    }
  }
}

function assertRoleMultisetSubset(
  actualRoles: readonly RoleId[],
  expectedPool: readonly RoleId[],
  description: string,
): void {
  const actual = countRoles(actualRoles);
  const expected = countRoles(expectedPool);
  for (const [roleId, count] of actual) {
    if (count > (expected.get(roleId) ?? 0)) {
      fail(`${description} contain too many ${roleId} cards for the role deal pool`);
    }
  }
}

function getAssignedRoles(state: GameState): RoleId[] {
  const expectedSeatCount = getPlayerCount(state.templateRoles);
  if (Object.keys(state.players).length !== expectedSeatCount) {
    fail(
      `players contain ${Object.keys(state.players).length} seats; expected ${expectedSeatCount}`,
    );
  }

  const roles: RoleId[] = [];
  for (const [seatKey, player] of Object.entries(state.players)) {
    const seat = Number.parseInt(seatKey, 10);
    if (!Number.isSafeInteger(seat) || seat < 0)
      fail(`players contain invalid seat key ${seatKey}`);
    if (player === null) fail(`assigned state contains empty seat ${seat}`);
    if (player.seat !== seat) fail(`player at key ${seat} claims seat ${player.seat}`);
    if (player.role === null || player.role === undefined) {
      fail(`assigned state contains no role at seat ${seat}`);
    }
    roles.push(player.role);
  }
  return roles;
}

/** Reject semantic state combinations that the command pipeline cannot produce. */
export function assertWerewolfStateInvariants(state: GameState): void {
  const templateError = validateTemplateRoles(state.templateRoles);
  if (templateError !== null) fail(`templateRoles are invalid: ${templateError}`);

  const hasNightResults = state.currentNightResults !== undefined;
  const isNightState = state.status === GameStatus.Ongoing || state.status === GameStatus.Ended;
  if (isNightState !== hasNightResults) {
    fail(
      isNightState
        ? `${state.status} state has no currentNightResults`
        : `${state.status} state contains currentNightResults`,
    );
  }

  const bottomCardRoleId = getBottomCardRoleId(state.templateRoles);
  const isAssignedState =
    state.status === GameStatus.Assigned ||
    state.status === GameStatus.Ready ||
    state.status === GameStatus.Ongoing ||
    state.status === GameStatus.Ended;
  const isTreasureMasterDisabledByPlague =
    bottomCardRoleId === 'treasureMaster' && state.rules?.isPlagueMode === true;

  const assignedRoles = isAssignedState ? getAssignedRoles(state) : null;
  const roleDealPool = isAssignedState ? getRoleDealPool(state.templateRoles, state.rules) : null;

  if (bottomCardRoleId === null || !isAssignedState || isTreasureMasterDisabledByPlague) {
    assertNoBottomCardRuntimeState(state);
    if (assignedRoles !== null && roleDealPool !== null) {
      if (isTreasureMasterDisabledByPlague) {
        assertRoleMultisetSubset(assignedRoles, roleDealPool, 'assigned roles');
      } else {
        assertSameRoleMultiset(assignedRoles, roleDealPool, 'assigned roles');
      }
    }
    return;
  }

  const bottomCards = state.bottomCards;
  if (bottomCards === undefined) fail(`${bottomCardRoleId} deal has no bottomCards`);
  if (!isValidBottomCardSet(bottomCards, bottomCardRoleId)) {
    fail(`${bottomCardRoleId} bottomCards violate the canonical deck rules`);
  }
  if (assignedRoles === null || roleDealPool === null) {
    fail(`${bottomCardRoleId} deal exists before role assignment`);
  }
  assertSameRoleMultiset(
    [...assignedRoles, ...bottomCards],
    roleDealPool,
    'assigned roles and bottomCards',
  );

  if (bottomCardRoleId === 'treasureMaster') {
    assertBottomCardActor(state, state.treasureMasterSeat, bottomCardRoleId);
    if (state.thiefSeat !== undefined) fail('treasure-master deal also contains thiefSeat');
    if (state.currentNightResults?.thiefChosenCard !== undefined) {
      fail('treasure-master deal also contains thiefChosenCard');
    }

    const chosenRoleId = state.currentNightResults?.treasureMasterChosenCard;
    if (chosenRoleId === undefined) return;
    assertChosenCardBelongsToDeck(chosenRoleId, bottomCards, bottomCardRoleId);
    if (getRoleSpec(chosenRoleId).faction === Faction.Wolf) {
      fail('treasureMasterChosenCard is a wolf-faction card');
    }
    return;
  }

  assertBottomCardActor(state, state.thiefSeat, bottomCardRoleId);
  if (state.treasureMasterSeat !== undefined) fail('thief deal also contains treasureMasterSeat');
  if (state.currentNightResults?.treasureMasterChosenCard !== undefined) {
    fail('thief deal also contains treasureMasterChosenCard');
  }

  const chosenRoleId = state.currentNightResults?.thiefChosenCard;
  if (chosenRoleId === undefined) return;
  assertChosenCardBelongsToDeck(chosenRoleId, bottomCards, bottomCardRoleId);
  const hasWolfCard = bottomCards.some((roleId) => getRoleSpec(roleId).faction === Faction.Wolf);
  if (hasWolfCard && getRoleSpec(chosenRoleId).faction !== Faction.Wolf) {
    fail('thiefChosenCard must be the wolf-faction card present in bottomCards');
  }
}
