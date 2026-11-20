/** Secrethitler semantic invariants; invalid persisted or evolved states fail explicitly. */

import {
  assertStateIdentity,
  createStateInvariant,
  type StateInvariant,
} from '../../../platform/protocol/stateInvariant';
import { isBotOccupant } from '../../../platform/room/seating';
import { getSecrethitlerNightParticipants, getSecrethitlerRoleCounts } from '../domain/rules';
import {
  isSecrethitlerOccupiedSeat,
  isValidSecrethitlerConfig,
  type SecrethitlerHumanSeat,
  type SecrethitlerPolicy,
  type SecrethitlerState,
} from './types';
import { SECRETHITLER_STATE_IDENTITY } from './version';

const invariant: StateInvariant = createStateInvariant('Secrethitler');

function assertUniqueSeats(
  seats: readonly number[],
  isSeat: (seat: number) => boolean,
  condition: string,
): void {
  invariant(seats.every(isSeat) && new Set(seats).size === seats.length, condition);
}

function countPolicies(
  policies: readonly SecrethitlerPolicy[],
  policy: SecrethitlerPolicy,
): number {
  return policies.filter((candidate) => candidate === policy).length;
}

function assertSetupState(state: SecrethitlerState): void {
  assertStateIdentity(state, SECRETHITLER_STATE_IDENTITY, 'Secrethitler');
  invariant(isValidSecrethitlerConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.gameSequence) && state.gameSequence >= 0, 'game sequence');
  invariant(
    new Set(state.reviewCompletedUserIds).size === state.reviewCompletedUserIds.length &&
      state.reviewCompletedUserIds.every((userId) => userId.trim().length > 0) &&
      (state.phase.kind === 'ended' || state.reviewCompletedUserIds.length === 0),
    'review completion',
  );
  invariant(typeof state.xpSettled === 'boolean', 'xp settled flag');
  invariant(Number.isSafeInteger(state.audioBatchId) && state.audioBatchId >= 0, 'audio batch id');
  invariant(typeof state.isAudioPlaying === 'boolean', 'audio playing flag');
  invariant(
    state.pendingAudioEffects.every(
      (effect) =>
        typeof effect.audioKey === 'string' &&
        effect.audioKey.length > 0 &&
        (effect.isEndAudio === undefined || typeof effect.isEndAudio === 'boolean'),
    ),
    'audio effects',
  );
  const entries = Object.entries(state.roster);
  invariant(
    entries.every(
      ([seat, occupant]) =>
        occupant != null &&
        isSeat(Number(seat)) &&
        occupant.seat === Number(seat) &&
        (isBotOccupant(occupant) || occupant.profile.displayName.trim().length > 0),
    ),
    'roster seats',
  );
  const users = entries.filter(
    (entry): entry is [string, SecrethitlerHumanSeat] =>
      entry[1] != null && !isBotOccupant(entry[1]),
  );
  invariant(
    new Set(users.map(([, occupant]) => occupant.userId)).size === users.length,
    'duplicate user',
  );
  invariant(
    state.roleViewedSeats.every(
      (seat) => isSeat(seat) && isSecrethitlerOccupiedSeat(state, seat),
    ) && new Set(state.roleViewedSeats).size === state.roleViewedSeats.length,
    'role viewed seats',
  );
  const identitySeats = Object.keys(state.identities).map(Number);
  if (state.phase.kind === 'lobby') {
    invariant(identitySeats.length === 0, 'lobby identities');
    invariant(state.roleViewedSeats.length === 0, 'lobby viewed seats');
    invariant(state.livingSeats.length === 0, 'lobby living seats');
    invariant(state.policyDeck.length === 0 && state.policyDiscard.length === 0, 'lobby policies');
    invariant(state.liberalPolicies === 0 && state.fascistPolicies === 0, 'lobby tracks');
    invariant(!state.xpSettled, 'lobby settlement');
  } else {
    invariant(
      identitySeats.every((seat) => isSeat(seat) && isSecrethitlerOccupiedSeat(state, seat)) &&
        identitySeats.length === entries.length,
      'dealt identities',
    );
    const expectedRoles = getSecrethitlerRoleCounts(count);
    invariant(
      Object.values(state.identities).filter((role) => role === 'liberal').length ===
        expectedRoles.liberal &&
        Object.values(state.identities).filter((role) => role === 'fascist').length ===
          expectedRoles.fascist &&
        Object.values(state.identities).filter((role) => role === 'hitler').length === 1,
      'role distribution',
    );
    assertUniqueSeats(state.livingSeats, (seat) => identitySeats.includes(seat), 'living seats');
    invariant(state.livingSeats.length > 0, 'at least one living player');
    invariant(
      isSeat(state.nextPresidentSeat) && state.livingSeats.includes(state.nextPresidentSeat),
      'next president',
    );
    invariant(
      state.roleViewedSeats.every((seat) => identitySeats.includes(seat)),
      'viewed dealt seat',
    );
  }
}

function assertPolicyState(state: SecrethitlerState): void {
  const identitySeats = Object.keys(state.identities).map(Number);
  invariant(
    Number.isSafeInteger(state.electionTracker) &&
      state.electionTracker >= 0 &&
      state.electionTracker <= 2,
    'election tracker',
  );
  invariant(
    Number.isSafeInteger(state.liberalPolicies) &&
      state.liberalPolicies >= 0 &&
      state.liberalPolicies <= 5,
    'liberal policy track',
  );
  invariant(
    Number.isSafeInteger(state.fascistPolicies) &&
      state.fascistPolicies >= 0 &&
      state.fascistPolicies <= 6,
    'fascist policy track',
  );
  invariant(
    (state.lastPresidentSeat === null || identitySeats.includes(state.lastPresidentSeat)) &&
      (state.lastChancellorSeat === null || identitySeats.includes(state.lastChancellorSeat)) &&
      (state.lastPresidentSeat === null) === (state.lastChancellorSeat === null),
    'last government',
  );
  assertUniqueSeats(
    state.investigatedSeats,
    (seat) => identitySeats.includes(seat),
    'investigated seats',
  );
  if (state.lastInvestigation !== null) {
    invariant(
      identitySeats.includes(state.lastInvestigation.presidentSeat) &&
        identitySeats.includes(state.lastInvestigation.targetSeat) &&
        state.lastInvestigation.presidentSeat !== state.lastInvestigation.targetSeat &&
        state.investigatedSeats.includes(state.lastInvestigation.targetSeat),
      'last investigation',
    );
  }
  invariant(
    state.history.policies.filter(({ policy }) => policy === 'liberal').length ===
      state.liberalPolicies &&
      state.history.policies.filter(({ policy }) => policy === 'fascist').length ===
        state.fascistPolicies,
    'policy history',
  );
  invariant(
    state.history.actions.every(
      ({ action, targetSeat }) =>
        (action === 'policyPeek' && targetSeat === null) ||
        (action !== 'policyPeek' && targetSeat !== null && identitySeats.includes(targetSeat)),
    ),
    'public actions',
  );
  invariant(
    state.history.governments.every(
      ({ presidentSeat, chancellorSeat, outcome, votes }) =>
        identitySeats.includes(presidentSeat) &&
        identitySeats.includes(chancellorSeat) &&
        presidentSeat !== chancellorSeat &&
        ((outcome === 'pending' && votes === null) || (outcome !== 'pending' && votes !== null)),
    ),
    'government history',
  );
  if (state.phase.kind === 'voting') {
    const currentGovernment = state.history.governments.at(-1);
    invariant(
      currentGovernment?.outcome === 'pending' &&
        currentGovernment.presidentSeat === state.phase.presidentSeat &&
        currentGovernment.chancellorSeat === state.phase.chancellorSeat &&
        currentGovernment.votes === null,
      'pending government history',
    );
  }
  const currentHand =
    state.phase.kind === 'legislativePresident' ||
    state.phase.kind === 'legislativeChancellor' ||
    state.phase.kind === 'vetoResponse'
      ? state.phase.hand
      : state.phase.kind === 'publicResult' && state.phase.previous.kind !== 'voting'
        ? state.phase.previous.hand
        : [];
  const cardPool = [...state.policyDeck, ...state.policyDiscard, ...currentHand];
  const policyCards = {
    liberal: state.liberalPolicies + countPolicies(cardPool, 'liberal'),
    fascist: state.fascistPolicies + countPolicies(cardPool, 'fascist'),
  };
  if (state.phase.kind === 'lobby') {
    invariant(policyCards.liberal === 0 && policyCards.fascist === 0, 'lobby policy conservation');
  } else {
    invariant(
      policyCards.liberal === 6 && policyCards.fascist === 11,
      `policy conservation (${policyCards.liberal} liberal, ${policyCards.fascist} fascist; track ${state.liberalPolicies}/${state.fascistPolicies}; deck ${countPolicies(state.policyDeck, 'liberal')}/${countPolicies(state.policyDeck, 'fascist')}; discard ${countPolicies(state.policyDiscard, 'liberal')}/${countPolicies(state.policyDiscard, 'fascist')}; hand ${countPolicies(currentHand, 'liberal')}/${countPolicies(currentHand, 'fascist')}; phase ${state.phase.kind})`,
    );
  }
}

function assertPhaseState(state: SecrethitlerState): void {
  if (state.phase.kind === 'publicResult') {
    const result = state.phase;
    const previousState = { ...state, phase: result.previous };
    assertPhaseState(previousState);
    if (result.previous.kind === 'voting') assertPolicyState(previousState);
    invariant(Number.isSafeInteger(result.deadlineAt) && result.deadlineAt >= 0, 'result deadline');
    invariant(
      state.livingSeats.includes(result.previous.presidentSeat) &&
        state.livingSeats.includes(result.previous.chancellorSeat) &&
        result.previous.presidentSeat !== result.previous.chancellorSeat,
      'result government',
    );
    invariant(
      result.previous.kind === 'voting'
        ? result.policy === null &&
            result.vetoApproved === null &&
            result.previous.deadlineAt !== null &&
            state.livingSeats.every(
              (seat) =>
                result.previous.kind === 'voting' && result.previous.votes[seat] !== undefined,
            )
        : result.previous.kind === 'legislativeChancellor'
          ? result.policy !== null &&
            result.previous.hand.includes(result.policy) &&
            result.vetoApproved === null &&
            result.chaosPolicy === null
          : result.policy === null && result.vetoApproved !== null,
      'result contents',
    );
    const failedVote =
      result.previous.kind === 'voting' &&
      state.livingSeats.filter(
        (seat) => result.previous.kind === 'voting' && result.previous.votes[seat] === 'ja',
      ).length <=
        state.livingSeats.length / 2;
    const expectsChaos =
      state.electionTracker === 2 &&
      (failedVote || (result.previous.kind === 'vetoResponse' && result.vetoApproved === true));
    invariant((result.chaosPolicy !== null) === expectsChaos, 'chaos result');
    if (result.chaosPolicy !== null) {
      const available =
        state.policyDeck.length > 0
          ? state.policyDeck.slice(0, 1)
          : [
              ...state.policyDiscard,
              ...(result.previous.kind === 'vetoResponse' ? result.previous.hand : []),
            ];
      invariant(available.includes(result.chaosPolicy), 'chaos result policy');
    }
  }
  if (state.phase.kind === 'night') {
    invariant(state.phase.step === 1, 'night step');
    const participants = getSecrethitlerNightParticipants(state);
    assertUniqueSeats(
      state.phase.confirmedSeats,
      (seat) => participants.includes(seat),
      'night confirmations',
    );
  }
  if (state.phase.kind === 'election') {
    invariant(state.livingSeats.includes(state.phase.presidentSeat), 'election president');
    invariant(
      state.phase.returnToSeat === null || state.livingSeats.includes(state.phase.returnToSeat),
      'election return seat',
    );
  }
  if (state.phase.kind === 'voting') {
    invariant(
      state.livingSeats.includes(state.phase.presidentSeat) &&
        state.livingSeats.includes(state.phase.chancellorSeat) &&
        state.phase.presidentSeat !== state.phase.chancellorSeat,
      'voting government',
    );
    invariant(
      Object.keys(state.phase.votes).every((seat) => state.livingSeats.includes(Number(seat))),
      'vote seats',
    );
    invariant(
      state.phase.deadlineAt === null ||
        (Number.isSafeInteger(state.phase.deadlineAt) &&
          state.phase.deadlineAt >= 0 &&
          state.livingSeats.every(
            (seat) => state.phase.kind === 'voting' && state.phase.votes[seat] !== undefined,
          )),
      'vote deadline',
    );
  }
  if (
    state.phase.kind === 'legislativePresident' ||
    state.phase.kind === 'legislativeChancellor' ||
    state.phase.kind === 'vetoResponse'
  ) {
    invariant(
      state.livingSeats.includes(state.phase.presidentSeat) &&
        state.livingSeats.includes(state.phase.chancellorSeat) &&
        state.phase.presidentSeat !== state.phase.chancellorSeat,
      'legislative government',
    );
    const expectedHand = state.phase.kind === 'legislativePresident' ? 3 : 2;
    invariant(state.phase.hand.length === expectedHand, 'legislative hand');
    invariant(
      state.phase.returnToSeat === null || state.livingSeats.includes(state.phase.returnToSeat),
      'legislative return seat',
    );
  }
  if (state.phase.kind === 'executive') {
    invariant(state.livingSeats.includes(state.phase.presidentSeat), 'executive president');
    invariant(
      (state.phase.power === 'policyPeek' && state.phase.preview.length === 3) ||
        (state.phase.power !== 'policyPeek' && state.phase.preview.length === 0),
      'executive preview',
    );
  }
  if (state.phase.kind === 'investigationResult') {
    invariant(
      state.livingSeats.includes(state.phase.presidentSeat) &&
        state.lastInvestigation?.presidentSeat === state.phase.presidentSeat &&
        (state.phase.returnToSeat === null || state.livingSeats.includes(state.phase.returnToSeat)),
      'pending investigation result',
    );
  }
  if (state.phase.kind === 'ended') {
    invariant(state.xpSettled, 'ended settles exactly once');
    invariant(
      (state.phase.winner === 'liberal' &&
        (state.phase.reason === 'liberalPolicies' || state.phase.reason === 'hitlerExecuted')) ||
        (state.phase.winner === 'fascist' &&
          (state.phase.reason === 'fascistPolicies' || state.phase.reason === 'hitlerElected')),
      'winner and reason',
    );
  } else {
    invariant(!state.xpSettled, 'unfinished settlement');
  }
}

/** Validates authoritative state without repairing or dropping submitted content. */
export function normalizeSecrethitlerState(state: SecrethitlerState): SecrethitlerState {
  assertSetupState(state);
  assertPolicyState(state);
  assertPhaseState(state);
  return state;
}
