/** Undercover round decisions; preparation, controlled confirmations and atomic elimination.
 * @remarks System completions are correlated to a frozen round; host commands use real identity.
 */

import {
  type CommandContext,
  reject,
  resolveSystemActorEffectId,
  resolveUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_HOST, REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import { createSeededRng, randomBool, shuffleArray } from '../../../platform/random';
import { findSeatByUserId } from '../../../platform/room/seating';
import type { UndercoverCommand } from '../commands/types';
import { isValidUndercoverWordPair } from '../state/normalize';
import {
  getUndercoverOccupiedSeatCount,
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
  { readonly type: `room.${string}` | 'undercover.config.update' | 'undercover.bots.clear' }
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

function decideStart(
  state: UndercoverState,
  shouldAllowRepeated: boolean,
  context: CommandContext,
): UndercoverDecision {
  if (state.phase !== 'lobby') return reject(UNDERCOVER_REASONS.phase);
  if (getUndercoverOccupiedSeatCount(state) !== state.config.numberOfPlayers)
    return reject(UNDERCOVER_REASONS.notFull);
  if (context.commandId.length === 0) throw new Error('Undercover start requires a command ID');
  const pendingRound = {
    roundId: `undercover-round:${context.commandId}`,
    requestedAt: context.nowMs,
    shouldAllowRepeated,
  };
  return commitUndercover(
    [{ type: 'undercover.round.preparing', pendingRound }],
    [selectionEffect(state, pendingRound)],
  );
}

function decideInternal(
  state: UndercoverState,
  command: Extract<
    RoundCommand,
    { type: 'undercover.round.complete' | 'undercover.round.failPreparation' }
  >,
  context: CommandContext,
): UndercoverDecision {
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'preparing') return reject(UNDERCOVER_REASONS.phase);
  if (state.pendingRound.roundId !== command.roundId) return reject(UNDERCOVER_REASONS.round);
  if (command.type === 'undercover.round.failPreparation') {
    if (
      command.failureCode !== 'selectionFailed' &&
      command.failureCode !== 'inventoryEmpty' &&
      command.failureCode !== 'inventoryExhausted'
    )
      return reject(UNDERCOVER_REASONS.failure);
    return commitUndercover([
      { type: 'undercover.round.failed', failureCode: command.failureCode },
    ]);
  }
  if (
    !isValidUndercoverWordPair(command.wordPair) ||
    (state.config.category !== 'all' && state.config.category !== command.wordPair.category)
  )
    return reject(UNDERCOVER_REASONS.word);
  if (
    !state.pendingRound.shouldAllowRepeated &&
    state.usedWordPairIds.includes(command.wordPair.id)
  )
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
    confirmedSeats: [],
    revelations: [],
  };
  return commitUndercover([{ type: 'undercover.round.started', round }]);
}

function decideConfirmation(
  state: UndercoverState,
  roundId: string,
  context: CommandContext,
): UndercoverDecision {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'reading') return reject(UNDERCOVER_REASONS.phase);
  if (state.round.roundId !== roundId) return reject(UNDERCOVER_REASONS.round);
  let seat: number | null;
  if (context.controlledSeat !== null) {
    if (actor.value !== state.hostUserId) return reject(REASON_NOT_HOST);
    if (!state.botSeats.includes(context.controlledSeat)) return reject(UNDERCOVER_REASONS.bot);
    seat = context.controlledSeat;
  } else {
    seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
  }
  if (seat === null) return reject(REASON_NOT_SEATED);
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
  if (state.round.revelations.some((revelation) => revelation.seat === seat))
    return reject(UNDERCOVER_REASONS.alreadyRevealed);
  const revelation = { seat, role: state.round.roles[seat]!, revealedAt: context.nowMs };
  const eliminated = new Set([...state.round.revelations.map((previous) => previous.seat), seat]);
  const winner = getUndercoverWinner(
    state.round.roles.filter((_, index) => !eliminated.has(index)),
  );
  return commitUndercover([{ type: 'undercover.round.revealed', revelation, winner }]);
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
    return decideStart(state, command.shouldAllowRepeated, context);
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
  if (roundId !== command.roundId) return reject(UNDERCOVER_REASONS.round);
  switch (command.type) {
    case 'undercover.round.markAllBotsViewed':
      return state.phase === 'reading'
        ? commitUndercover(
            state.botSeats
              .filter((seat) => !state.round.confirmedSeats.includes(seat))
              .map((seat) => ({ type: 'undercover.round.confirmed', seat })),
          )
        : reject(UNDERCOVER_REASONS.phase);
    case 'undercover.round.retry':
      return state.phase === 'preparationFailed'
        ? commitUndercover(
            [{ type: 'undercover.round.preparing', pendingRound: state.pendingRound }],
            [selectionEffect(state, state.pendingRound)],
          )
        : reject(UNDERCOVER_REASONS.phase);
    case 'undercover.round.abort':
      return state.phase === 'preparing' ||
        state.phase === 'preparationFailed' ||
        state.phase === 'reading' ||
        state.phase === 'ongoing'
        ? commitUndercover([{ type: 'undercover.round.aborted' }])
        : reject(UNDERCOVER_REASONS.phase);
    case 'undercover.round.reveal':
      return decideRevelation(state, command.seat, context);
  }
}
