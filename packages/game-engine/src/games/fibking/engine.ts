/** Concrete authoritative FibKing engine definition. */

import {
  type CommandContext,
  commit,
  type CommonGameLifecycle,
  type CreateGameContext,
  type Decision,
  type GameEngineDefinition,
  reject,
  resolveHostActorId,
  resolveSystemActorEffectId,
  resolveUncontrolledUserActorId,
} from '../../platform/engine';
import { FIBKING_GAME_TYPE, type FibKingGameType } from '../../platform/protocol/gameTypes';
import { REASON_GAME_IN_PROGRESS, REASON_NOT_SEATED } from '../../platform/protocol/reasons';
import {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
  type SeatChange,
  type SeatOperationResult,
} from '../../platform/room/seating';
import type { FibCommand } from './commands/types';
import type { FibEvent } from './domain/events';
import { evolveFibState } from './domain/evolve';
import {
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_FIB_PLAYER_COUNT_INVALID,
  REASON_FIB_PREPARATION_STAGE_INVALID,
  REASON_FIB_ROUND_ALREADY_ONGOING,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_FULL,
  REASON_FIB_ROUND_NOT_ONGOING,
  REASON_FIB_ROUND_NOT_PREPARING,
  REASON_FIB_WORD_INVALID,
  REASON_FIB_WORD_REUSED,
} from './domain/reasons';
import { assignFibRoles } from './domain/roles';
import type { FibEffect } from './effects/types';
import { normalizeFibState } from './state/normalize';
import {
  FIB_MIN_PLAYERS,
  FIB_PREPARATION_STAGES,
  type FibConfig,
  type FibHumanSeat,
  type FibProfileUpdate,
  type FibSeatProfile,
  type FibState,
  isFibImplicitBotSeat,
  isFibRoomFull,
  isValidFibDefinitionField,
  isValidFibPlayerCount,
  isValidFibWord,
} from './state/types';
import { FIB_STATE_IDENTITY, FIB_STATE_VERSION } from './state/version';

type FibDecision = Decision<FibEvent, FibEffect>;

function commitFib(events: readonly FibEvent[], effects: readonly FibEffect[] = []): FibDecision {
  return commit({
    events,
    effects,
    broadcast: events.length === 0 ? 'none' : 'state',
  });
}

function rejectSeatOperation(
  result: Extract<SeatOperationResult<FibHumanSeat>, { kind: 'rejected' }>,
): FibDecision {
  return reject(result.reason);
}

function seatChangesEvent(changes: readonly SeatChange<FibHumanSeat>[]): FibEvent {
  return { type: 'fib.seats.changed', changes };
}

function requireLobby(state: FibState): FibDecision | null {
  return state.phase === 'lobby' ? null : reject(REASON_GAME_IN_PROGRESS);
}

function decideTakeFibSeat(
  state: FibState,
  seat: number,
  profile: FibSeatProfile,
  context: CommandContext,
): FibDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);

  const result = decideTakeSeat(
    state.realSeats,
    state.numberOfPlayers,
    seat,
    actor.value,
    (targetSeat): FibHumanSeat => ({
      userId: actor.value,
      seat: targetSeat,
      profile: { ...profile },
    }),
  );
  return result.kind === 'rejected'
    ? rejectSeatOperation(result)
    : commitFib([seatChangesEvent(result.changes)]);
}

function decideLeaveFibSeat(state: FibState, context: CommandContext): FibDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideLeaveSeat(state.realSeats, state.numberOfPlayers, actor.value);
  return result.kind === 'rejected'
    ? rejectSeatOperation(result)
    : commitFib([seatChangesEvent(result.changes)]);
}

function decideKickFibSeat(state: FibState, seat: number, context: CommandContext): FibDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (isFibImplicitBotSeat(state, seat)) {
    return commitFib([{ type: 'fib.botSeat.excluded', seat }]);
  }
  const result = decideKickSeat(state.realSeats, state.numberOfPlayers, seat);
  if (result.kind === 'rejected') return rejectSeatOperation(result);
  const events: FibEvent[] = [seatChangesEvent(result.changes)];
  if (state.fillEmptySeatsWithBots && !state.excludedBotSeats.includes(seat)) {
    events.push({ type: 'fib.botSeat.excluded', seat });
  }
  return commitFib(events);
}

function decideClearFibSeats(state: FibState, context: CommandContext): FibDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const result = decideClearSeats(state.realSeats, state.numberOfPlayers);
  if (result.kind === 'rejected') return rejectSeatOperation(result);

  const events: FibEvent[] = [];
  if (result.changes.length > 0) events.push(seatChangesEvent(result.changes));
  if (state.fillEmptySeatsWithBots) {
    events.push({ type: 'fib.botFill.changed', isEnabled: false });
  }
  return commitFib(events);
}

function decideFillFibBots(state: FibState, context: CommandContext): FibDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return state.fillEmptySeatsWithBots && state.excludedBotSeats.length === 0
    ? commitFib([])
    : commitFib([{ type: 'fib.botFill.changed', isEnabled: true }]);
}

function decideUpdateFibProfile(
  state: FibState,
  profile: FibProfileUpdate,
  context: CommandContext,
): FibDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const seat = findSeatByUserId(state.realSeats, state.numberOfPlayers, actor.value);
  return seat === null
    ? reject(REASON_NOT_SEATED)
    : commitFib([{ type: 'fib.profile.updated', seat, profile: { ...profile } }]);
}

function decideUpdateFibConfig(
  state: FibState,
  numberOfPlayers: number,
  context: CommandContext,
): FibDecision {
  const lobbyRejection = requireLobby(state);
  if (lobbyRejection !== null) return lobbyRejection;
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (!isValidFibPlayerCount(numberOfPlayers)) {
    return reject(REASON_FIB_PLAYER_COUNT_INVALID);
  }

  const hasRemovedRealSeat = Object.keys(state.realSeats).some(
    (seat) => Number(seat) >= numberOfPlayers,
  );
  if (hasRemovedRealSeat) return reject(REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE);
  return numberOfPlayers === state.numberOfPlayers
    ? commitFib([])
    : commitFib([{ type: 'fib.config.updated', numberOfPlayers }]);
}

function createRoundId(commandId: string): string {
  if (commandId.length === 0) {
    throw new Error('Fib round start requires a non-empty command ID');
  }
  return `fib-round:${commandId}`;
}

function decideStartFibRound(state: FibState, context: CommandContext): FibDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase === 'preparing' || state.phase === 'ongoing') {
    return reject(REASON_FIB_ROUND_ALREADY_ONGOING);
  }
  if (!isFibRoomFull(state)) return reject(REASON_FIB_ROUND_NOT_FULL);

  const roundId = createRoundId(context.commandId);
  return commitFib(
    [
      {
        type: 'fib.round.preparing',
        pendingRound: {
          roundId,
          requestedAt: context.nowMs,
          stage: FIB_PREPARATION_STAGES.queued,
        },
      },
    ],
    [
      {
        type: 'fib.word.generate',
        payload: { roundId, avoidWords: [...state.usedWords] },
      },
    ],
  );
}

function decideCancelFibPreparation(state: FibState, context: CommandContext): FibDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return state.phase === 'preparing' || state.phase === 'preparationFailed'
    ? commitFib([{ type: 'fib.round.preparationCancelled' }])
    : reject(REASON_FIB_ROUND_NOT_PREPARING);
}

function decideRevealFibRound(state: FibState, context: CommandContext): FibDecision {
  const actor = resolveHostActorId(context, state.hostUserId);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return state.phase === 'ongoing'
    ? commitFib([{ type: 'fib.round.ended' }])
    : reject(REASON_FIB_ROUND_NOT_ONGOING);
}

function decideUpdateFibPreparationStage(
  state: FibState,
  command: Extract<FibCommand, { readonly type: 'fib.round.updatePreparationStage' }>,
  context: CommandContext,
): FibDecision {
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'preparing') return reject(REASON_FIB_ROUND_NOT_PREPARING);
  if (command.roundId !== state.pendingRound.roundId) return reject(REASON_FIB_ROUND_MISMATCH);

  const expectedStage =
    state.pendingRound.stage === FIB_PREPARATION_STAGES.queued
      ? FIB_PREPARATION_STAGES.generating
      : state.pendingRound.stage === FIB_PREPARATION_STAGES.generating
        ? FIB_PREPARATION_STAGES.finalizing
        : null;
  if (command.stage !== expectedStage) {
    return reject(REASON_FIB_PREPARATION_STAGE_INVALID);
  }

  return commitFib([
    {
      type: 'fib.round.preparationStageUpdated',
      stage: command.stage,
    },
  ]);
}

function decideFailFibPreparation(
  state: FibState,
  command: Extract<FibCommand, { readonly type: 'fib.round.failPreparation' }>,
  context: CommandContext,
): FibDecision {
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase === 'preparationFailed') {
    return command.roundId === state.preparationFailure.roundId
      ? commitFib([])
      : reject(REASON_FIB_ROUND_MISMATCH);
  }
  if (state.phase !== 'preparing') return reject(REASON_FIB_ROUND_NOT_PREPARING);
  if (command.roundId !== state.pendingRound.roundId) return reject(REASON_FIB_ROUND_MISMATCH);
  return commitFib([
    {
      type: 'fib.round.preparationFailed',
      failedAt: context.nowMs,
      failureCode: command.failureCode,
    },
  ]);
}

function decideCompleteFibRound(
  state: FibState,
  command: Extract<FibCommand, { readonly type: 'fib.round.complete' }>,
  context: CommandContext,
): FibDecision {
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase !== 'preparing') return reject(REASON_FIB_ROUND_NOT_PREPARING);
  if (command.roundId !== state.pendingRound.roundId) return reject(REASON_FIB_ROUND_MISMATCH);
  if (state.pendingRound.stage !== FIB_PREPARATION_STAGES.finalizing) {
    return reject(REASON_FIB_PREPARATION_STAGE_INVALID);
  }
  if (
    !isValidFibWord(command.word) ||
    !isValidFibDefinitionField(command.definition.coreMeaning) ||
    !isValidFibDefinitionField(command.definition.usageNote)
  ) {
    return reject(REASON_FIB_WORD_INVALID);
  }
  if (state.usedWords.includes(command.word)) return reject(REASON_FIB_WORD_REUSED);

  return commitFib([
    {
      type: 'fib.round.started',
      roundId: command.roundId,
      word: command.word,
      definition: command.definition,
      source: command.source,
      roles: assignFibRoles(state.numberOfPlayers, context.randomSeed),
    },
  ]);
}

function createInitialFibState(config: FibConfig, context: CreateGameContext): FibState {
  if (!isValidFibPlayerCount(config.numberOfPlayers)) {
    throw new Error(
      `Invalid Fib config: numberOfPlayers must be a safe integer >= ${FIB_MIN_PLAYERS}`,
    );
  }
  return normalizeFibState({
    ...FIB_STATE_IDENTITY,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: 'lobby',
    numberOfPlayers: config.numberOfPlayers,
    realSeats: {},
    fillEmptySeatsWithBots: false,
    excludedBotSeats: [],
    usedWords: [],
    pendingRound: null,
    preparationFailure: null,
    round: null,
  });
}

export function getFibLifecycle(state: FibState): CommonGameLifecycle {
  switch (state.phase) {
    case 'lobby':
      return 'setup';
    case 'preparing':
    case 'preparationFailed':
    case 'ongoing':
      return 'ongoing';
    case 'ended':
      return 'ended';
  }
  const exhaustive: never = state;
  return exhaustive;
}

export function decideFibCommand(
  state: FibState,
  command: FibCommand,
  context: CommandContext,
): FibDecision {
  switch (command.type) {
    case 'room.seat.take':
      return decideTakeFibSeat(state, command.seat, command.profile, context);
    case 'room.seat.leave':
      return decideLeaveFibSeat(state, context);
    case 'room.seat.kick':
      return decideKickFibSeat(state, command.seat, context);
    case 'room.seat.clear':
      return decideClearFibSeats(state, context);
    case 'room.seat.fillBots':
      return decideFillFibBots(state, context);
    case 'room.profile.update':
      return decideUpdateFibProfile(state, command.profile, context);
    case 'fib.config.update':
      return decideUpdateFibConfig(state, command.numberOfPlayers, context);
    case 'fib.round.start':
      return decideStartFibRound(state, context);
    case 'fib.round.cancelPreparing':
      return decideCancelFibPreparation(state, context);
    case 'fib.round.reveal':
      return decideRevealFibRound(state, context);
    case 'fib.round.updatePreparationStage':
      return decideUpdateFibPreparationStage(state, command, context);
    case 'fib.round.failPreparation':
      return decideFailFibPreparation(state, command, context);
    case 'fib.round.complete':
      return decideCompleteFibRound(state, command, context);
  }
  const exhaustive: never = command;
  return exhaustive;
}

export const fibEngine = {
  gameType: FIBKING_GAME_TYPE,
  stateVersion: FIB_STATE_VERSION,
  createInitialState: createInitialFibState,
  decide: decideFibCommand,
  evolve: evolveFibState,
  normalize: normalizeFibState,
  getLifecycle: getFibLifecycle,
} satisfies GameEngineDefinition<
  FibKingGameType,
  FibState,
  FibConfig,
  FibCommand,
  FibEvent,
  FibEffect
>;

export type FibEngine = typeof fibEngine;
