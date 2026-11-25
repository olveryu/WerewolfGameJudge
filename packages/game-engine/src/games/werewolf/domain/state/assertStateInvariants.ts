/**
 * Semantic invariants for authoritative Werewolf state.
 *
 * Called at persistence and broadcast boundaries. Invalid state is rejected;
 * this module never repairs, drops, or synthesizes game facts.
 */

import { isBotOccupant } from '../../../../platform/room/seating';
import { createWerewolfNightPlan, getWerewolfBoardConversion } from '../../roles/nightPlan';
import {
  GameStatus,
  getBottomCardRoleId,
  getPlayerCount,
  getRoleDealPool,
  isBottomCardRoleRemovedInPlagueMode,
  isValidBottomCardSet,
  isValidRoleId,
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
  const outcome = state.nightState?.conversion;
  if (outcome?.outcome !== 'converted') {
    assertSameRoleMultiset(actualRoles, expectedRoles, description);
    return;
  }

  // One card of the deal has become the role the board's converting role turns players into.
  const conversion = getWerewolfBoardConversion(state.templateRoles);
  if (conversion === null) fail('a player was converted on a board with no converting role');
  const { becomesRoleId } = conversion.declaration;
  if (!isValidRoleId(becomesRoleId)) fail(`conversion produces unknown role ${becomesRoleId}`);
  if (state.players[outcome.targetSeat]?.role !== becomesRoleId) {
    fail(`converted seat ${outcome.targetSeat} does not hold ${becomesRoleId}`);
  }

  const actual = countRoles(actualRoles);
  const expected = countRoles(expectedRoles);
  const roleIds = new Set([...actual.keys(), ...expected.keys()]);
  let replacedRoleId: RoleId | undefined;

  for (const roleId of roleIds) {
    const difference = (actual.get(roleId) ?? 0) - (expected.get(roleId) ?? 0);
    if (roleId === becomesRoleId) {
      if (difference !== 1) {
        fail(`${description} do not contain exactly one converted ${becomesRoleId}`);
      }
      continue;
    }
    if (difference === -1 && replacedRoleId === undefined) {
      replacedRoleId = roleId;
      continue;
    }
    if (difference !== 0) {
      fail(`${description} do not match the role deal pool at ${roleId}`);
    }
  }

  if (replacedRoleId === undefined) fail('the conversion did not replace any dealt role');
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
  // The settle countdown only arms once every eligible ballot is in
  // (and ballots are never removed), so an armed deadline implies a
  // complete submission set.
  if (election.deadline !== undefined) {
    for (const voterSeat of election.eligibleVoterSeats) {
      if (!Object.hasOwn(election.ballots, voterSeat)) {
        fail(`${election.phase} deadline is armed without voter ${voterSeat}'s ballot`);
      }
    }
  }
}

function assertSheriffElectionPhase(state: GameState, election: SheriffElectionState): void {
  switch (election.phase) {
    case 'registration':
    case 'completed':
      return;
    case 'candidateSpeech':
      assertOccupiedSeats(state, [election.speakingStartSeat], 'candidate speech starting seat');
      if (!election.registeredSeats.includes(election.speakingStartSeat)) {
        fail(`candidate speech starts from unregistered seat ${election.speakingStartSeat}`);
      }
      return;
    case 'runoffSpeech':
      assertOccupiedSeats(state, [election.speakingStartSeat], 'runoff speech starting seat');
      if (!election.candidateSeats.includes(election.speakingStartSeat)) {
        fail(`runoff speech starts from non-candidate seat ${election.speakingStartSeat}`);
      }
      return;
    case 'firstVote':
    case 'runoffVote':
      assertActiveSheriffVotingPhase(state, election);
      return;
    case 'result':
      if (!Number.isSafeInteger(election.deadline) || election.deadline < 0)
        fail('sheriff result deadline is invalid');
      if (election.next.kind === 'final' && election.next.result.kind === 'elected') {
        const seat = election.next.result.sheriffSeat;
        if (!election.registeredSeats.includes(seat) || election.withdrawnSeats.includes(seat))
          fail(`result sheriff seat ${seat} is not an active candidate`);
      }
      if (election.next.kind === 'runoff') {
        assertOccupiedSeats(state, election.next.candidateSeats, 'runoff result candidates');
        if (!election.next.candidateSeats.includes(election.next.speakingStartSeat))
          fail('runoff result starts from a non-candidate');
      }
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

/**
 * Since the v6 split, occupancy (roster) and per-seat game data (players)
 * are two maps that must stay seat-aligned: a seat has game data exactly
 * when it has an occupant, every occupant sits inside the seat range and
 * stores its own seat, and human userIds are unique.
 */
function assertRosterAlignment(state: GameState): void {
  const seatCount = Object.keys(state.players).length;
  const seenUserIds = new Set<string>();
  for (const [key, occupant] of Object.entries(state.roster)) {
    const seat = Number(key);
    if (occupant == null) fail(`roster seat ${key} holds an empty occupant`);
    if (occupant.seat !== seat) {
      fail(`roster occupant at seat ${key} stores seat ${occupant.seat}`);
    }
    if (seat < 0 || seat >= seatCount) {
      fail(`roster occupant seat ${seat} is outside the ${seatCount}-seat players map`);
    }
    if (state.players[seat] == null) {
      fail(`roster occupant at seat ${seat} has no player record`);
    }
    if (!isBotOccupant(occupant)) {
      if (seenUserIds.has(occupant.userId)) {
        fail(`roster userId ${occupant.userId} occupies more than one seat`);
      }
      seenUserIds.add(occupant.userId);
    }
  }
  for (const [key, player] of Object.entries(state.players)) {
    if (player != null && state.roster[Number(key)] == null) {
      fail(`player record at seat ${key} has no roster occupant`);
    }
  }
}

/**
 * The night window: `nightState` exists exactly from the moment the night
 * starts (`Ongoing`, `Day`, `Ended`), and must agree with the deal.
 */
function assertWerewolfStepWindow(state: GameState): void {
  const night = state.nightState;
  const hasNight =
    state.status === GameStatus.Ongoing ||
    state.status === GameStatus.Day ||
    state.status === GameStatus.Ended;
  if (hasNight !== (night !== null)) {
    fail(hasNight ? `${state.status} state has no nightState` : 'nightState exists before night');
  }
  if (night !== null) assertSpecNightState(state, night);
}

function assertSpecNightState(state: GameState, night: NonNullable<GameState['nightState']>): void {
  const seatedSeats = Object.keys(state.players)
    .map(Number)
    .filter((seat) => state.players[seat] != null)
    .sort((first, second) => first - second);
  if (
    seatedSeats.length !== night.roles.seatedSeats.length ||
    seatedSeats.some((seat, index) => seat !== night.roles.seatedSeats[index])
  ) {
    fail('night roles do not match the seated players');
  }
  const deal = seatedSeats.map((seat) => {
    const identity = night.roles.identities[seat];
    if (identity === undefined || !isValidRoleId(identity.dealtRole)) {
      fail(`night seat ${seat} has no valid dealt identity`);
    }
    const playerRole = state.players[seat]?.role;
    const isConverted =
      night.conversion?.outcome === 'converted' && night.conversion.targetSeat === seat;
    if (playerRole !== (isConverted ? identity.currentRole : identity.dealtRole)) {
      fail(`night seat ${seat} disagrees with its dealt identity`);
    }
    return { seat, role: identity.dealtRole };
  });
  const order = createWerewolfNightPlan({
    seats: deal,
    templateRoles: state.templateRoles,
    seerLabelMap: state.seerLabelMap ?? {},
    witchCanSelfHeal: night.roles.rules.witchCanSelfHeal,
  }).map((step) => step.stepId);
  if (
    order.length !== night.slice.order.length ||
    order.some((step, index) => step !== night.slice.order[index])
  ) {
    fail('night step order does not match the deal');
  }
  const current = night.slice.current;
  if (current !== null && current.serial !== order.indexOf(current.stepId) + 1) {
    fail('night step serial does not match its position');
  }
  if (state.status !== GameStatus.Ongoing) {
    if (current !== null || night.slice.deadlineMs !== null)
      fail('completed night is still active');
    return;
  }
  if (current === null && night.slice.deadlineMs !== null) {
    fail('finished night still has a deadline');
  }
}

/** Reject semantic state combinations that the command pipeline cannot produce. */
export function assertWerewolfStateInvariants(state: GameState): void {
  const templateError = validateTemplateRoles(state.templateRoles);
  if (templateError !== null) fail(`templateRoles are invalid: ${templateError}`);

  assertRosterAlignment(state);
  assertSheriffElection(state);

  assertWerewolfStepWindow(state);

  const bottomCardRoleId = getBottomCardRoleId(state.templateRoles);
  const isAssignedState =
    state.status === GameStatus.Assigned ||
    state.status === GameStatus.Ready ||
    state.status === GameStatus.Ongoing ||
    state.status === GameStatus.Day ||
    state.status === GameStatus.Ended;
  // Plague mode deals some bottom-card actors as a villager and sets no deck aside for them.
  const isDeckRemovedByPlague =
    bottomCardRoleId !== null &&
    state.rules?.isPlagueMode === true &&
    isBottomCardRoleRemovedInPlagueMode(bottomCardRoleId);

  const assignedRoles = isAssignedState ? getAssignedRoles(state) : null;
  const roleDealPool = isAssignedState ? getRoleDealPool(state.templateRoles, state.rules) : null;

  if (bottomCardRoleId === null || !isAssignedState || isDeckRemovedByPlague) {
    if (state.bottomCards !== undefined) {
      fail('bottomCards exist without an active bottom-card deal');
    }
    if (assignedRoles !== null && roleDealPool !== null) {
      if (isDeckRemovedByPlague) {
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
}
