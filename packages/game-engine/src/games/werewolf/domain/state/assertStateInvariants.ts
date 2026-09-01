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
import type {
  GameState,
  SheriffElectionRoundResult,
  SheriffElectionState,
} from '../protocol/types';

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

function assertAssignedRolesMatchDeal(
  state: GameState,
  actualRoles: readonly RoleId[],
  expectedRoles: readonly RoleId[],
  description: string,
): void {
  const infectionResult = state.seedWolfInfectionResult;
  if (infectionResult?.outcome !== 'converted') {
    assertSameRoleMultiset(actualRoles, expectedRoles, description);
    return;
  }

  if (!state.templateRoles.includes('seedWolf')) {
    fail('converted Seed Wolf infection exists without seedWolf in templateRoles');
  }
  if (state.players[infectionResult.targetSeat]?.role !== 'wolf') {
    fail(`converted Seed Wolf target seat ${infectionResult.targetSeat} is not a wolf`);
  }

  const actual = countRoles(actualRoles);
  const expected = countRoles(expectedRoles);
  const roleIds = new Set([...actual.keys(), ...expected.keys()]);
  let replacedRoleId: RoleId | undefined;

  for (const roleId of roleIds) {
    const difference = (actual.get(roleId) ?? 0) - (expected.get(roleId) ?? 0);
    if (roleId === 'wolf') {
      if (difference !== 1) {
        fail(`${description} do not contain exactly one converted wolf`);
      }
      continue;
    }
    if (difference === -1 && replacedRoleId === undefined) {
      if (getRoleSpec(roleId).faction === Faction.Wolf) {
        fail(`Seed Wolf infection replaced wolf-faction role ${roleId}`);
      }
      replacedRoleId = roleId;
      continue;
    }
    if (difference !== 0) {
      fail(`${description} do not match the role deal pool at ${roleId}`);
    }
  }

  if (replacedRoleId === undefined) {
    fail('converted Seed Wolf infection did not replace a non-wolf role');
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

function assertUniqueSeats(seats: readonly number[], description: string): void {
  if (new Set(seats).size !== seats.length) fail(`${description} contain duplicate seats`);
}

function assertOccupiedSeats(
  state: GameState,
  seats: readonly number[],
  description: string,
): void {
  assertUniqueSeats(seats, description);
  for (const seat of seats) {
    if (state.players[seat] == null) fail(`${description} contain empty seat ${seat}`);
  }
}

function getOccupiedSeats(state: GameState): number[] {
  return Object.entries(state.players)
    .filter(([, player]) => player !== null)
    .map(([seat]) => Number(seat))
    .sort((left, right) => left - right);
}

function getExpectedEligibleVoterSeats(
  state: GameState,
  round: SheriffElectionRoundResult['round'],
  registeredSeats: readonly number[],
  candidateSeats: readonly number[],
): number[] {
  const excludedVoterSeats = round === 'first' ? registeredSeats : candidateSeats;
  return getOccupiedSeats(state).filter((seat) => !excludedVoterSeats.includes(seat));
}

function assertSameSeats(
  actual: readonly number[],
  expected: readonly number[],
  description: string,
): void {
  if (actual.length !== expected.length || actual.some((seat, index) => seat !== expected[index])) {
    fail(`${description} do not match their ballots`);
  }
}

function assertSameSeatSet(
  actual: readonly number[],
  expected: readonly number[],
  description: string,
): void {
  if (actual.length !== expected.length || actual.some((seat) => !expected.includes(seat))) {
    fail(`${description} do not match the expected seat set`);
  }
}

function assertSheriffRound(
  state: GameState,
  result: SheriffElectionRoundResult,
  registeredSeats: readonly number[],
): void {
  assertOccupiedSeats(state, result.candidateSeats, `${result.round} round candidates`);
  assertOccupiedSeats(state, result.eligibleVoterSeats, `${result.round} round eligible voters`);
  for (const seat of result.candidateSeats) {
    if (!registeredSeats.includes(seat))
      fail(`${result.round} round contains unregistered candidate`);
    if (result.eligibleVoterSeats.includes(seat)) {
      fail(`${result.round} round candidate ${seat} is also an eligible voter`);
    }
  }
  assertSameSeatSet(
    result.eligibleVoterSeats,
    getExpectedEligibleVoterSeats(state, result.round, registeredSeats, result.candidateSeats),
    `${result.round} round eligible voters`,
  );

  const ballotSeats = Object.keys(result.ballots).map(Number);
  assertSameSeats(ballotSeats, result.eligibleVoterSeats, `${result.round} round ballot seats`);
  const calculatedVoteCounts: Record<number, number> = {};
  for (const candidateSeat of result.candidateSeats) calculatedVoteCounts[candidateSeat] = 0;
  const calculatedAbstainingSeats: number[] = [];
  for (const voterSeat of result.eligibleVoterSeats) {
    const targetSeat = result.ballots[voterSeat];
    if (targetSeat === undefined) fail(`${result.round} round is missing voter ${voterSeat}`);
    if (targetSeat === null) {
      calculatedAbstainingSeats.push(voterSeat);
      continue;
    }
    const currentCount = calculatedVoteCounts[targetSeat];
    if (currentCount === undefined)
      fail(`${result.round} round targets non-candidate ${targetSeat}`);
    calculatedVoteCounts[targetSeat] = currentCount + 1;
  }
  const voteCountSeats = Object.keys(result.voteCounts).map(Number);
  assertSameSeatSet(
    voteCountSeats,
    result.candidateSeats,
    `${result.round} round vote-count seats`,
  );
  for (const candidateSeat of result.candidateSeats) {
    if (result.voteCounts[candidateSeat] !== calculatedVoteCounts[candidateSeat]) {
      fail(`${result.round} round vote count is incorrect for candidate ${candidateSeat}`);
    }
  }
  assertSameSeats(
    result.abstainingSeats,
    calculatedAbstainingSeats,
    `${result.round} round abstaining seats`,
  );
}

function assertActiveSheriffVotingPhase(
  state: GameState,
  election: Extract<SheriffElectionState, { phase: 'firstVote' | 'runoffVote' }>,
): void {
  assertOccupiedSeats(state, election.candidateSeats, `${election.phase} candidates`);
  assertOccupiedSeats(state, election.eligibleVoterSeats, `${election.phase} eligible voters`);
  for (const candidateSeat of election.candidateSeats) {
    if (!election.registeredSeats.includes(candidateSeat)) {
      fail(`${election.phase} contains unregistered candidate ${candidateSeat}`);
    }
    if (election.withdrawnSeats.includes(candidateSeat)) {
      fail(`${election.phase} contains withdrawn candidate ${candidateSeat}`);
    }
    if (election.eligibleVoterSeats.includes(candidateSeat)) {
      fail(`${election.phase} candidate ${candidateSeat} is also an eligible voter`);
    }
  }
  assertSameSeatSet(
    election.eligibleVoterSeats,
    getExpectedEligibleVoterSeats(
      state,
      election.phase === 'firstVote' ? 'first' : 'runoff',
      election.registeredSeats,
      election.candidateSeats,
    ),
    `${election.phase} eligible voters`,
  );
  for (const [voterSeatKey, targetSeat] of Object.entries(election.ballots)) {
    const voterSeat = Number(voterSeatKey);
    if (!election.eligibleVoterSeats.includes(voterSeat)) {
      fail(`${election.phase} contains ballot from ineligible voter ${voterSeat}`);
    }
    if (targetSeat !== null && !election.candidateSeats.includes(targetSeat)) {
      fail(`${election.phase} targets non-candidate ${targetSeat}`);
    }
  }
}

function assertSheriffElectionPhase(state: GameState, election: SheriffElectionState): void {
  switch (election.phase) {
    case 'registration':
    case 'withdrawal':
    case 'completed':
      return;
    case 'candidateSpeech':
    case 'runoffSpeech':
      assertOccupiedSeats(state, election.speakingOrder, `${election.phase} speaking order`);
      if (election.phase === 'candidateSpeech') {
        const activeSpeakingSeats = election.speakingOrder.filter(
          (seat) => !election.withdrawnSeats.includes(seat),
        );
        const activeCandidateSeats = election.registeredSeats.filter(
          (seat) => !election.withdrawnSeats.includes(seat),
        );
        assertSameSeatSet(activeSpeakingSeats, activeCandidateSeats, 'candidate speaking order');
      } else {
        assertSameSeatSet(election.speakingOrder, election.candidateSeats, 'runoff speaking order');
      }
      return;
    case 'firstVote':
    case 'runoffVote':
      assertActiveSheriffVotingPhase(state, election);
      return;
  }
  const exhaustive: never = election;
  return exhaustive;
}

function assertSheriffElection(state: GameState): void {
  const election = state.sheriffElection;
  const result = state.sheriffElectionResult;
  if (election === undefined) {
    if (result !== undefined) fail('sheriffElectionResult exists without sheriffElection');
    if (state.status === GameStatus.Day) fail('Day state has no sheriffElection');
    if (state.status === GameStatus.Ended && state.rules?.isSheriffElectionEnabled === true) {
      fail('enabled sheriff election has no completed state');
    }
    return;
  }
  if (state.rules?.isSheriffElectionEnabled !== true) {
    fail('sheriffElection exists while the rule is disabled');
  }
  if (state.status !== GameStatus.Day && state.status !== GameStatus.Ended) {
    fail(`sheriffElection exists during ${state.status}`);
  }

  assertOccupiedSeats(state, election.registeredSeats, 'registered sheriff candidates');
  assertUniqueSeats(election.withdrawnSeats, 'withdrawn sheriff candidates');
  for (const seat of election.withdrawnSeats) {
    if (!election.registeredSeats.includes(seat)) fail(`withdrawn seat ${seat} never registered`);
  }
  if (election.phase === 'registration' && election.withdrawnSeats.length > 0) {
    fail('registration contains withdrawn sheriff candidates');
  }
  if (election.completedRounds.length > 2) fail('sheriff election contains more than two rounds');
  election.completedRounds.forEach((round, index) => {
    const expectedRound = index === 0 ? 'first' : 'runoff';
    if (round.round !== expectedRound) fail(`completed round ${index} must be ${expectedRound}`);
    assertSheriffRound(state, round, election.registeredSeats);
  });
  assertSheriffElectionPhase(state, election);

  if (state.status === GameStatus.Day) {
    if (election.phase === 'completed') fail('Day state contains completed sheriff election');
    if (result !== undefined) fail('Day state contains sheriffElectionResult');
    return;
  }
  if (election.phase !== 'completed') fail('Ended state contains active sheriff election');
  if (result === undefined) fail('completed sheriff election has no result');
  if (result.kind === 'elected') {
    if (!election.registeredSeats.includes(result.sheriffSeat)) {
      fail(`elected sheriff seat ${result.sheriffSeat} never registered`);
    }
    if (election.withdrawnSeats.includes(result.sheriffSeat)) {
      fail(`elected sheriff seat ${result.sheriffSeat} withdrew`);
    }
  }
}

/** Reject semantic state combinations that the command pipeline cannot produce. */
export function assertWerewolfStateInvariants(state: GameState): void {
  const templateError = validateTemplateRoles(state.templateRoles);
  if (templateError !== null) fail(`templateRoles are invalid: ${templateError}`);

  assertSheriffElection(state);

  const hasNightResults = state.currentNightResults !== undefined;
  const isNightState =
    state.status === GameStatus.Ongoing ||
    state.status === GameStatus.Day ||
    state.status === GameStatus.Ended;
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
    state.status === GameStatus.Day ||
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
        assertAssignedRolesMatchDeal(state, assignedRoles, roleDealPool, 'assigned roles');
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
  assertAssignedRolesMatchDeal(
    state,
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
