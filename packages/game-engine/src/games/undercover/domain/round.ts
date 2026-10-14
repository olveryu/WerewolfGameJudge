/** Undercover round decisions; preparation, controlled confirmations and atomic elimination.
 * @remarks System completions are correlated to a frozen round; host commands use real identity.
 */

import {
  buildGameCompletionPayload,
  type CommandContext,
  reject,
  resolveUserActorId,
} from '../../../platform/engine';
import {
  createSeededRng,
  randomBool,
  randomIntInclusive,
  shuffleArray,
} from '../../../platform/random';
import { resolveActingSeat } from '../../../platform/room/actingSeat';
import { hasBeenRevealed } from '../../../platform/room/hostReveal';
import { haveAllViewed, listUnviewedBotSeats } from '../../../platform/room/identityViewing';
import {
  commitPreparationEntry,
  decidePreparationComplete,
  decidePreparationFail,
  PREPARATION_FAILURE_CODES,
  PREPARATION_RETRY_STRATEGIES,
  type PreparationStateSlice,
  resolvePreparationRetryPending,
} from '../../../platform/room/preparation';
import { getHumanSeatMap } from '../../../platform/room/seating';
import type { UndercoverCommand } from '../commands/types';
import { isValidUndercoverWordPair } from '../state/normalize';
import {
  getUndercoverOccupiedSeatCount,
  getUndercoverViewingParticipants,
  isUndercoverSeat,
  type UndercoverPendingRound,
  type UndercoverRound,
  type UndercoverState,
} from '../state/types';
import {
  commitUndercover,
  requireUndercoverHost,
  UNDERCOVER_REASONS,
  type UndercoverDecision,
} from './decision';
import type { UndercoverEffect } from './events';
import { getUndercoverRoleCounts, getUndercoverWinner, type UndercoverRole } from './rules';

type RoundCommand = Exclude<
  UndercoverCommand,
  { readonly type: `room.${string}` | 'undercover.config.update' }
>;

function selectionEffect(
  state: UndercoverState,
  pendingRound: UndercoverPendingRound,
): UndercoverEffect {
  return {
    type: 'undercover.word.select',
    payload: {
      roundId: pendingRound.roundId,
      category: state.config.category,
      avoidWordPairIds: state.usedWordPairIds,
      shouldAllowRepeated: pendingRound.shouldAllowRepeated,
    },
  };
}

/** The preparation slice of the state, in the protocol's shape (state union unchanged). */
function preparationSlice(state: UndercoverState): PreparationStateSlice<UndercoverPendingRound> {
  return {
    phase: state.phase,
    pendingRound:
      state.phase === 'preparing' || state.phase === 'preparationFailed'
        ? state.pendingRound
        : null,
  };
}

const PREPARATION_REASONS = {
  notPreparing: UNDERCOVER_REASONS.phase,
  roundMismatch: UNDERCOVER_REASONS.round,
  failureInvalid: UNDERCOVER_REASONS.failure,
} as const;

function decideStart(
  state: UndercoverState,
  shouldAllowRepeated: boolean,
  context: CommandContext,
): UndercoverDecision {
  if (getUndercoverOccupiedSeatCount(state) !== state.config.numberOfPlayers)
    return reject(UNDERCOVER_REASONS.notFull);
  // D-1: a start always freezes a fresh pending round; only the
  // dedicated retry command reuses the failed one.
  const pendingRound = resolvePreparationRetryPending<UndercoverPendingRound>(
    PREPARATION_RETRY_STRATEGIES.fresh,
    null,
    () => {
      if (context.commandId.length === 0) throw new Error('Undercover start requires a command ID');
      return {
        roundId: `undercover-round:${context.commandId}`,
        requestedAt: context.nowMs,
        shouldAllowRepeated,
      };
    },
  );
  return commitPreparationEntry({
    pendingRound,
    buildPreparingEvent: (pending) => ({
      type: 'undercover.round.preparing',
      pendingRound: pending,
    }),
    buildSelectionEffect: (pending) => selectionEffect(state, pending),
    commit: commitUndercover,
  });
}

function decideInternal(
  state: UndercoverState,
  command: Extract<
    RoundCommand,
    { type: 'undercover.round.complete' | 'undercover.round.failPreparation' }
  >,
  context: CommandContext,
): UndercoverDecision {
  if (command.type === 'undercover.round.failPreparation') {
    // D-2: Undercover declares the full superset as its emittable subset.
    return decidePreparationFail({
      state: preparationSlice(state),
      roundId: command.roundId,
      failureCode: command.failureCode,
      failureCodes: PREPARATION_FAILURE_CODES,
      reasons: PREPARATION_REASONS,
      context,
      buildFailedEvent: (failureCode) => ({ type: 'undercover.round.failed', failureCode }),
      commit: commitUndercover,
    });
  }
  return decidePreparationComplete({
    state: preparationSlice(state),
    roundId: command.roundId,
    reasons: PREPARATION_REASONS,
    context,
    complete: (pendingRound) => {
      if (
        !isValidUndercoverWordPair(command.wordPair) ||
        (state.config.category !== 'all' && state.config.category !== command.wordPair.category)
      )
        return reject(UNDERCOVER_REASONS.word);
      if (!pendingRound.shouldAllowRepeated && state.usedWordPairIds.includes(command.wordPair.id))
        return reject(UNDERCOVER_REASONS.reused);
      const counts = getUndercoverRoleCounts(state.config.numberOfPlayers, state.config.hasBlank);
      const roles: UndercoverRole[] = [
        ...Array.from({ length: counts.civilian }, (): UndercoverRole => 'civilian'),
        ...Array.from({ length: counts.undercover }, (): UndercoverRole => 'undercover'),
        ...Array.from({ length: counts.blank }, (): UndercoverRole => 'blank'),
      ];
      const random = createSeededRng(context.randomSeed);
      const isSwapped = randomBool(random);
      const round: UndercoverRound = {
        roundId: command.roundId,
        wordPair: { ...command.wordPair },
        civilianWord: isSwapped ? command.wordPair.wordB : command.wordPair.wordA,
        undercoverWord: isSwapped ? command.wordPair.wordA : command.wordPair.wordB,
        roles: shuffleArray(roles, random),
        speakingStartSeat: randomIntInclusive(0, state.config.numberOfPlayers - 1, random),
        // Identity Viewing Protocol: nobody is marked at deal time;
        // bot seats are marked by the host scaffold action.
        confirmedSeats: [],
        revelations: [],
      };
      return commitUndercover([{ type: 'undercover.round.started', round }]);
    },
  });
}

function decideConfirmation(
  state: UndercoverState,
  roundId: string,
  context: CommandContext,
): UndercoverDecision {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'viewing') return reject(UNDERCOVER_REASONS.phase);
  if (state.round.roundId !== roundId) return reject(UNDERCOVER_REASONS.round);
  const acting = resolveActingSeat(state, state.config.numberOfPlayers, context);
  if (acting.kind === 'rejected') return reject(acting.reason);
  const seat = acting.value;
  return state.round.confirmedSeats.includes(seat)
    ? commitUndercover([])
    : commitUndercover([{ type: 'undercover.round.confirmed', seat }]);
}

function decideRevelation(
  state: UndercoverState,
  seat: number,
  context: CommandContext,
): UndercoverDecision {
  if (state.phase !== 'ongoing') return reject(UNDERCOVER_REASONS.phase);
  if (!isUndercoverSeat(state, seat)) return reject(UNDERCOVER_REASONS.config);
  if (hasBeenRevealed(state.round.revelations, seat))
    return reject(UNDERCOVER_REASONS.alreadyRevealed);
  const revelation = { seat, role: state.round.roles[seat]!, revealedAt: context.nowMs };
  const eliminated = new Set([...state.round.revelations.map((previous) => previous.seat), seat]);
  const winner = getUndercoverWinner(
    state.round.roles.filter((_, index) => !eliminated.has(index)),
  );
  return commitUndercover(
    [{ type: 'undercover.round.revealed', revelation, winner }],
    winner === null
      ? []
      : [
          {
            type: 'undercover.game.completed',
            payload: buildGameCompletionPayload({
              roundId: state.round.roundId,
              completedAt: context.nowMs,
              humans: Object.values(getHumanSeatMap(state.roster, state.config.numberOfPlayers)),
            }),
          },
        ],
  );
}

/** Decides one round operation; @pre actor identity is authenticated by the platform. */
export function decideUndercoverRound(
  state: UndercoverState,
  command: RoundCommand,
  context: CommandContext,
): UndercoverDecision {
  if (
    command.type === 'undercover.round.complete' ||
    command.type === 'undercover.round.failPreparation'
  )
    return decideInternal(state, command, context);
  if (command.type === 'undercover.round.confirm')
    return decideConfirmation(state, command.roundId, context);
  const hostRejection = requireUndercoverHost(state, context);
  if (hostRejection !== null) return hostRejection;
  if (command.type === 'undercover.round.start')
    return state.phase === 'lobby'
      ? decideStart(state, command.shouldAllowRepeated, context)
      : reject(UNDERCOVER_REASONS.phase);
  if (command.type === 'undercover.game.returnToLobby') {
    return state.phase === 'ended' ||
      state.phase === 'aborted' ||
      state.phase === 'preparationFailed'
      ? commitUndercover([{ type: 'undercover.game.returnedToLobby' }])
      : reject(UNDERCOVER_REASONS.phase);
  }
  const roundId =
    state.phase === 'preparing' || state.phase === 'preparationFailed'
      ? state.pendingRound.roundId
      : state.round?.roundId;
  if (command.type === 'undercover.round.restart') {
    if (state.phase === 'lobby') return reject(UNDERCOVER_REASONS.phase);
    if ((roundId ?? null) !== command.roundId) return reject(UNDERCOVER_REASONS.round);
    return decideStart(state, false, context);
  }
  if (roundId !== command.roundId) return reject(UNDERCOVER_REASONS.round);
  switch (command.type) {
    case 'undercover.round.begin': {
      // The begin gate is the identity checkpoint: play opens only once
      // every seat (bots via the host scaffold action) has viewed.
      if (state.phase !== 'viewing') return reject(UNDERCOVER_REASONS.phase);
      if (!haveAllViewed(getUndercoverViewingParticipants(state), state.round.confirmedSeats))
        return reject(UNDERCOVER_REASONS.notAllViewed);
      return commitUndercover([{ type: 'undercover.round.begun' }]);
    }
    case 'undercover.round.markAllBotsViewed': {
      // Host scaffold action: fill every unviewed bot seat's record
      // through the protocol's seat computation; the begin gate runs
      // the strict checkpoint when the host begins the round.
      if (state.phase !== 'viewing') return reject(UNDERCOVER_REASONS.phase);
      const participants = getUndercoverViewingParticipants(state);
      // Werewolf parity (Wave 8): with no bot seats at all the scaffold
      // command rejects instead of committing an empty success.
      if (!participants.some((participant) => participant.isBot))
        return reject(UNDERCOVER_REASONS.noBots);
      return commitUndercover(
        listUnviewedBotSeats(participants, state.round.confirmedSeats).map((participant) => ({
          type: 'undercover.round.confirmed' as const,
          seat: participant.seat,
        })),
      );
    }
    case 'undercover.round.retry':
      // D-1: retry reuses the failed pending round unchanged — the
      // same roundId, requestedAt and selection policy are replayed.
      return state.phase === 'preparationFailed'
        ? commitPreparationEntry({
            pendingRound: resolvePreparationRetryPending(
              PREPARATION_RETRY_STRATEGIES.reuse,
              state.pendingRound,
              () => state.pendingRound,
            ),
            buildPreparingEvent: (pending) => ({
              type: 'undercover.round.preparing',
              pendingRound: pending,
            }),
            buildSelectionEffect: (pending) => selectionEffect(state, pending),
            commit: commitUndercover,
          })
        : reject(UNDERCOVER_REASONS.phase);
    case 'undercover.round.abort':
      return state.phase === 'preparing' ||
        state.phase === 'preparationFailed' ||
        state.phase === 'viewing' ||
        state.phase === 'ongoing'
        ? commitUndercover([{ type: 'undercover.round.aborted' }])
        : reject(UNDERCOVER_REASONS.phase);
    case 'undercover.round.reveal':
      return decideRevelation(state, command.seat, context);
  }
}
