/** Concrete authoritative FibKing engine definition. */

import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  requireHost,
} from '../../platform/engine';
import { buildGameCompletionPayload } from '../../platform/engine/completionEffect';
import { FIBKING_GAME_TYPE, type FibKingGameType } from '../../platform/protocol/gameTypes';
import { REASON_NOT_SEATED } from '../../platform/protocol/reasons';
import { resolveActingSeat } from '../../platform/room/actingSeat';
import { hasBeenRevealed } from '../../platform/room/hostReveal';
import {
  decideConfirmViewed,
  decideMarkBotsViewed,
  haveAllViewed,
} from '../../platform/room/identityViewing';
import {
  commitPreparationEntry,
  decidePreparationComplete,
  decidePreparationFail,
  decidePreparationStageUpdate,
  isFinalPreparationStage,
  PREPARATION_RETRY_STRATEGIES,
  type PreparationStageVocabulary,
  type PreparationStateSlice,
  resolvePreparationRetryPending,
} from '../../platform/room/preparation';
import { getHumanSeatMap } from '../../platform/room/seating';
import type { FibCommand } from './commands/types';
import { commitFib, type FibDecision } from './domain/decision';
import type { FibEvent } from './domain/events';
import { evolveFibState } from './domain/evolve';
import {
  REASON_FIB_GAME_NOT_ENDED,
  REASON_FIB_NO_BOT_SEATS,
  REASON_FIB_NOT_ALL_VIEWED,
  REASON_FIB_PREPARATION_STAGE_INVALID,
  REASON_FIB_ROUND_ALREADY_ONGOING,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_FULL,
  REASON_FIB_ROUND_NOT_ONGOING,
  REASON_FIB_ROUND_NOT_PREPARING,
  REASON_FIB_ROUND_NOT_VIEWING,
  REASON_FIB_ROUND_SEAT_ALREADY_GUESSED,
  REASON_FIB_WORD_INVALID,
  REASON_FIB_WORD_REUSED,
} from './domain/reasons';
import { assignFibRoles } from './domain/roles';
import { decideFibRoom } from './domain/seating';
import type { FibEffect } from './effects/types';
import { normalizeFibState } from './state/normalize';
import {
  FIB_MAX_PLAYERS,
  FIB_MIN_PLAYERS,
  FIB_PREPARATION_FAILURE_CODES,
  FIB_PREPARATION_STAGES,
  type FibConfig,
  type FibPreparationStage,
  type FibState,
  getFibRole,
  getFibViewingParticipants,
  isFibRoomFull,
  isValidFibConfig,
  isValidFibDefinitionField,
  isValidFibWord,
  type PendingFibRound,
} from './state/types';
import { FIB_STATE_IDENTITY, FIB_STATE_VERSION } from './state/version';

function createRoundId(commandId: string): string {
  if (commandId.length === 0) {
    throw new Error('Fib round start requires a non-empty command ID');
  }
  return `fib-round:${commandId}`;
}

function getFibParticipantUserIds(state: FibState): readonly string[] {
  return [
    ...new Set([
      state.hostUserId,
      ...Object.values(getHumanSeatMap(state.roster, state.numberOfPlayers)).map(
        (seat) => seat.userId,
      ),
    ]),
  ].sort();
}

/** The preparation slice of the state, in the protocol's shape (state union unchanged). */
function preparationSlice(state: FibState): PreparationStateSlice<PendingFibRound> {
  return {
    phase: state.phase,
    pendingRound: state.phase === 'preparing' ? state.pendingRound : null,
  };
}

/** D-5: FibKing injects its three progress stages into the preparation protocol. */
const FIB_PREPARATION_STAGE_LIST: PreparationStageVocabulary<FibPreparationStage> = [
  FIB_PREPARATION_STAGES.queued,
  FIB_PREPARATION_STAGES.selecting,
  FIB_PREPARATION_STAGES.finalizing,
];

const FIB_PREPARATION_REASONS = {
  notPreparing: REASON_FIB_ROUND_NOT_PREPARING,
  roundMismatch: REASON_FIB_ROUND_MISMATCH,
  stageInvalid: REASON_FIB_PREPARATION_STAGE_INVALID,
} as const;

function decideStartFibRound(state: FibState, context: CommandContext): FibDecision {
  const hostRejection = requireHost<FibEvent, FibEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  if (state.phase === 'preparing') {
    return reject(REASON_FIB_ROUND_ALREADY_ONGOING);
  }
  if (!isFibRoomFull(state)) return reject(REASON_FIB_ROUND_NOT_FULL);

  // D-1: every FibKing start — the first round, the next round, and
  // the preparationFailed "重新准备" alike — freezes a fresh pending
  // round (fresh strategy); a retry therefore consumes word-sequence
  // progress again, exactly as before the extraction.
  const pendingRound = resolvePreparationRetryPending<PendingFibRound>(
    PREPARATION_RETRY_STRATEGIES.fresh,
    null,
    () => ({
      roundId: createRoundId(context.commandId),
      requestedAt: context.nowMs,
      stage: FIB_PREPARATION_STAGES.queued,
    }),
  );
  return commitPreparationEntry({
    pendingRound,
    buildPreparingEvent: (pending) => ({ type: 'fibking.round.preparing', pendingRound: pending }),
    buildSelectionEffect: (pending) => ({
      type: 'fibking.word.select',
      payload: {
        roundId: pending.roundId,
        avoidWords: [...state.usedWords],
        participantUserIds: getFibParticipantUserIds(state),
      },
    }),
    commit: commitFib,
  });
}

function decideCancelFibPreparation(state: FibState, context: CommandContext): FibDecision {
  const hostRejection = requireHost<FibEvent, FibEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  return state.phase === 'preparing' || state.phase === 'preparationFailed'
    ? commitFib([{ type: 'fibking.round.preparationCancelled' }])
    : reject(REASON_FIB_ROUND_NOT_PREPARING);
}

/**
 * The single round-ending path: revealing the answer and guessing
 * the honest seat both land here, so the ended event and the game
 * completion payload can never diverge between the two exits.
 */
function commitFibRoundEnded(
  state: FibState & { readonly round: NonNullable<FibState['round']> },
  context: CommandContext,
  leadingEvents: readonly FibEvent[],
): FibDecision {
  return commitFib(
    [...leadingEvents, { type: 'fibking.round.ended' }],
    [
      {
        type: 'fibking.game.completed',
        payload: buildGameCompletionPayload({
          roundId: state.round.roundId,
          completedAt: context.nowMs,
          humans: Object.values(getHumanSeatMap(state.roster, state.numberOfPlayers)),
        }),
      },
    ],
  );
}

function decideRevealFibRound(state: FibState, context: CommandContext): FibDecision {
  const hostRejection = requireHost<FibEvent, FibEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  if (state.phase !== 'ongoing') return reject(REASON_FIB_ROUND_NOT_ONGOING);
  return commitFibRoundEnded(state, context, []);
}

/**
 * Host begins play from the viewing stage: the identity checkpoint
 * must be complete (every seat, bots included, has a view record);
 * play never opens on the last view record alone.
 */
function decideBeginFibRound(state: FibState, context: CommandContext): FibDecision {
  const hostRejection = requireHost<FibEvent, FibEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  if (state.phase !== 'viewing') return reject(REASON_FIB_ROUND_NOT_VIEWING);
  if (!haveAllViewed(getFibViewingParticipants(state), state.round.viewedSeats)) {
    return reject(REASON_FIB_NOT_ALL_VIEWED);
  }
  return commitFib([{ type: 'fibking.round.begun' }]);
}

/**
 * Host-operated guess: the host names the seat they believe is the
 * honest player. Every guess publicly records that seat's real role
 * (hostReveal); naming the honest seat ends the round through the
 * same path as revealing the answer, a miss changes nothing else.
 */
function decideGuessFibSeat(state: FibState, seat: number, context: CommandContext): FibDecision {
  const hostRejection = requireHost<FibEvent, FibEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  if (state.phase !== 'ongoing') return reject(REASON_FIB_ROUND_NOT_ONGOING);
  if (state.roster[seat] == null) return reject(REASON_NOT_SEATED);
  if (hasBeenRevealed(state.round.guesses, seat)) {
    return reject(REASON_FIB_ROUND_SEAT_ALREADY_GUESSED);
  }
  const guessedEvent: FibEvent = {
    type: 'fibking.round.guessed',
    revelation: { seat, role: getFibRole(state.round.roles, seat), revealedAt: context.nowMs },
  };
  return seat === state.round.roles.honestSeat
    ? commitFibRoundEnded(state, context, [guessedEvent])
    : commitFib([guessedEvent]);
}

function decideConfirmFibRoleView(state: FibState, context: CommandContext): FibDecision {
  return decideConfirmViewed({
    actingSeat: resolveActingSeat(state, state.numberOfPlayers, context),
    viewedSeats: state.round?.viewedSeats ?? [],
    // FibKing's phase policy: new records are viewing-stage only. A
    // confirmation that lands after the stage flipped still succeeds
    // in the skeleton when the seat's record already exists (the
    // begin gate requires the record, so a late confirm is always
    // for an already-viewed seat).
    phaseRejection: state.phase !== 'viewing' ? reject(REASON_FIB_ROUND_NOT_VIEWING) : null,
    buildViewedEvent: (seat) => ({ type: 'fibking.role.viewed', seat }),
    commit: commitFib,
  });
}

/**
 * Identity Viewing Protocol scaffold action (host only): marks
 * every unviewed bot seat as viewed. Filling the last missing
 * record only opens the begin gate; the host still begins play
 * with fibking.game.begin.
 */
function decideMarkAllBotsViewed(state: FibState, context: CommandContext): FibDecision {
  // FibKing's viewing phase gate stays here (it also narrows the
  // round); the shared skeleton owns everything past the host gate.
  if (state.phase !== 'viewing') return reject(REASON_FIB_ROUND_NOT_VIEWING);
  return decideMarkBotsViewed({
    gateRejection: requireHost<FibEvent, FibEffect>(context, state.hostUserId),
    participants: getFibViewingParticipants(state),
    viewedSeats: state.round.viewedSeats,
    noBotSeatsReason: REASON_FIB_NO_BOT_SEATS,
    buildViewedEvent: (seat) => ({ type: 'fibking.role.viewed', seat }),
    commit: commitFib,
  });
}

function decideReturnFibGameToLobby(state: FibState, context: CommandContext): FibDecision {
  const hostRejection = requireHost<FibEvent, FibEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  return state.phase === 'viewing' || state.phase === 'ongoing' || state.phase === 'ended'
    ? commitFib([{ type: 'fibking.game.returnedToLobby' }])
    : reject(REASON_FIB_GAME_NOT_ENDED);
}

function decideUpdateFibPreparationStage(
  state: FibState,
  command: Extract<FibCommand, { readonly type: 'fibking.round.updatePreparationStage' }>,
  context: CommandContext,
): FibDecision {
  return decidePreparationStageUpdate({
    state: preparationSlice(state),
    roundId: command.roundId,
    stage: command.stage,
    stages: FIB_PREPARATION_STAGE_LIST,
    reasons: FIB_PREPARATION_REASONS,
    context,
    buildStageEvent: (stage) => ({ type: 'fibking.round.preparation.stage.updated', stage }),
    commit: commitFib,
  });
}

function decideFailFibPreparation(
  state: FibState,
  command: Extract<FibCommand, { readonly type: 'fibking.round.failPreparation' }>,
  context: CommandContext,
): FibDecision {
  // D-2: FibKing declares its two-code subset; the codes themselves
  // are validated by the worker command schema, so the decide layer
  // carries no failureInvalid reason. A replayed fail for the round
  // already recorded as failed stays an idempotent no-op.
  return decidePreparationFail({
    state: preparationSlice(state),
    roundId: command.roundId,
    failureCode: command.failureCode,
    failureCodes: FIB_PREPARATION_FAILURE_CODES,
    reasons: FIB_PREPARATION_REASONS,
    context,
    alreadyFailedRoundId:
      state.phase === 'preparationFailed' ? state.preparationFailure.roundId : null,
    buildFailedEvent: (failureCode) => ({
      type: 'fibking.round.preparationFailed',
      failedAt: context.nowMs,
      failureCode,
    }),
    commit: commitFib,
  });
}

function decideCompleteFibRound(
  state: FibState,
  command: Extract<FibCommand, { readonly type: 'fibking.round.complete' }>,
  context: CommandContext,
): FibDecision {
  return decidePreparationComplete({
    state: preparationSlice(state),
    roundId: command.roundId,
    reasons: FIB_PREPARATION_REASONS,
    context,
    // D-5: completion may land only from the vocabulary's final stage.
    completionGate: (pendingRound) =>
      isFinalPreparationStage(FIB_PREPARATION_STAGE_LIST, pendingRound.stage)
        ? null
        : REASON_FIB_PREPARATION_STAGE_INVALID,
    complete: () => {
      if (
        !isValidFibWord(command.word) ||
        !isValidFibDefinitionField(command.definition.coreMeaning) ||
        !isValidFibDefinitionField(command.definition.usageNote)
      ) {
        return reject(REASON_FIB_WORD_INVALID);
      }
      if (state.usedWords.includes(command.word)) return reject(REASON_FIB_WORD_REUSED);

      return commitFib(
        [
          {
            type: 'fibking.round.started',
            roundId: command.roundId,
            word: command.word,
            definition: command.definition,
            source: command.source,
            roles: assignFibRoles(state.numberOfPlayers, context.randomSeed),
            // Identity Viewing Protocol: nobody is marked at round
            // start; bot seats are marked by the host scaffold action.
            initialViewedSeats: [],
          },
        ],
        [
          {
            type: 'fibking.word.recordUsage',
            payload: {
              roundId: command.roundId,
              word: command.word,
              source: command.source,
              usedAt: context.nowMs,
              participantUserIds: getFibParticipantUserIds(state),
            },
          },
        ],
      );
    },
  });
}

function createInitialFibState(config: FibConfig, context: CreateGameContext): FibState {
  if (!isValidFibConfig(config)) {
    throw new Error(
      `Invalid Fib config: numberOfPlayers must be an integer between ${FIB_MIN_PLAYERS} and ${FIB_MAX_PLAYERS}`,
    );
  }
  return normalizeFibState({
    ...FIB_STATE_IDENTITY,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    numberOfPlayers: config.numberOfPlayers,
    roster: {},
    usedWords: [],
    phase: 'lobby',
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
    case 'viewing':
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
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'fibking.config.update':
      return decideFibRoom(state, command, context);
    case 'fibking.game.returnToLobby':
      return decideReturnFibGameToLobby(state, context);
    case 'fibking.roles.assign':
      return decideStartFibRound(state, context);
    case 'fibking.round.cancelPreparing':
      return decideCancelFibPreparation(state, context);
    case 'fibking.round.reveal':
      return decideRevealFibRound(state, context);
    case 'fibking.role.viewed':
      return decideConfirmFibRoleView(state, context);
    case 'fibking.bots.markAllBotsViewed':
      return decideMarkAllBotsViewed(state, context);
    case 'fibking.game.begin':
      return decideBeginFibRound(state, context);
    case 'fibking.round.guess':
      return decideGuessFibSeat(state, command.seat, context);
    case 'fibking.round.updatePreparationStage':
      return decideUpdateFibPreparationStage(state, command, context);
    case 'fibking.round.failPreparation':
      return decideFailFibPreparation(state, command, context);
    case 'fibking.round.complete':
      return decideCompleteFibRound(state, command, context);
  }
  const exhaustive: never = command;
  return exhaustive;
}

export const fibEngine = {
  gameType: FIBKING_GAME_TYPE,
  stateVersion: FIB_STATE_VERSION,
  capabilities: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: true,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
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
