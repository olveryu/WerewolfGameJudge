/** Authoritative Spotmatch engine; delegates persistence and delivery to the platform. */

import {
  type CommandContext,
  commitDomainRejection,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  requireHost,
} from '../../platform/engine';
import { buildGameCompletionPayloadV2 } from '../../platform/engine/completionEffect';
import { resolveActingSeat } from '../../platform/room/actingSeat';
import { isBotOccupant, isRoomFull } from '../../platform/room/seating';
import type { SpotmatchCommand } from './commands/types';
import { chooseSpotmatchSymbols, createSpotmatchCard } from './domain/cards';
import {
  commitSpotmatch,
  SPOTMATCH_REASONS,
  type SpotmatchDecision,
  type SpotmatchEffect,
  type SpotmatchEvent,
} from './domain/decision';
import { evolveSpotmatchState } from './domain/evolve';
import { decideSpotmatchRoom } from './domain/seating';
import { normalizeSpotmatchState } from './state/normalize';
import {
  isValidSpotmatchConfig,
  SPOTMATCH_GAME_TYPE,
  SPOTMATCH_MIN_PLAYERS,
  SPOTMATCH_SUCCESS_PAUSE_MS,
  SPOTMATCH_WRONG_LOCK_MS,
  type SpotmatchConfig,
  type SpotmatchState,
} from './state/types';
import { SPOTMATCH_STATE_VERSION } from './state/version';

function createInitialState(config: SpotmatchConfig, context: CreateGameContext): SpotmatchState {
  if (!isValidSpotmatchConfig(config)) throw new Error(SPOTMATCH_REASONS.config);
  return normalizeSpotmatchState({
    gameType: SPOTMATCH_GAME_TYPE,
    stateVersion: SPOTMATCH_STATE_VERSION,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: { kind: 'lobby' },
    phaseRevision: 0,
    config: { ...config },
    roster: {},
    gameSequence: 0,
    xpSettled: false,
    round: null,
  });
}

/** 对局结束时发结算 effect，Worker 据此发 XP 奖励；xpSettled 保证恰好一次。 */
function completionEffect(state: SpotmatchState, context: CommandContext): SpotmatchEffect | null {
  const round = state.round;
  if (round === null || round.isTest || round.winnerSeat === null) return null;
  const humans = round.players.flatMap((player) =>
    player.userId === null ? [] : [{ ...player, userId: player.userId }],
  );
  const eligible = (player: (typeof humans)[number]) => player.correct > 0;
  const payload = buildGameCompletionPayloadV2({
    roundId: `spotmatch:game:${state.gameSequence}`,
    completedAt: context.nowMs,
    humans,
    minimumHumanPlayers: SPOTMATCH_MIN_PLAYERS,
    includeSeat: eligible,
    stats: humans.filter(eligible).map(({ userId, seat, correct, mistakes }) => ({
      userId,
      gamesPlayed: 1 as const,
      wins: seat === round.winnerSeat ? (1 as const) : (0 as const),
      correctCards: correct,
      mistakes,
    })),
  });
  if (payload === null) return null;
  return {
    type: 'spotmatch.game.completed',
    payload,
  };
}

/** Host starts the game (or restarts from ended) without a deadline. */
function startGame(state: SpotmatchState, context: CommandContext): SpotmatchDecision {
  const hostRejection = requireHost<SpotmatchEvent, SpotmatchEffect>(
    context,
    state.hostUserId,
    SPOTMATCH_REASONS.notHostStart,
  );
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'lobby' && state.phase.kind !== 'ended')
    return reject(SPOTMATCH_REASONS.phase);
  if (!isRoomFull(state.roster, state.config.numberOfPlayers))
    return reject(SPOTMATCH_REASONS.full);
  const gameSequence = state.gameSequence + 1;
  const roundId = `spotmatch:game:${gameSequence}`;
  const symbolMap = chooseSpotmatchSymbols(`${context.randomSeed}:symbols`);
  const central = createSpotmatchCard(roundId, 0, [], symbolMap, `${context.randomSeed}:central`);
  const excluded = [central.typeId];
  const players = Object.values(state.roster)
    .filter((occupant) => occupant != null)
    .map((occupant, index) => {
      const top = createSpotmatchCard(
        roundId,
        index + 1,
        excluded,
        symbolMap,
        `${context.randomSeed}:seat:${occupant.seat}`,
      );
      excluded.push(top.typeId);
      return {
        seat: occupant.seat,
        userId: isBotOccupant(occupant) ? null : occupant.userId,
        isBot: isBotOccupant(occupant),
        remaining: state.config.cardsPerPlayer,
        correct: 0,
        mistakes: 0,
        lockedUntil: 0,
        lastMistake: null,
        top,
      };
    });
  return commitSpotmatch([
    {
      type: 'spotmatch.game.started',
      gameSequence,
      round: {
        roundId,
        central,
        symbolMap,
        players,
        serial: players.length + 1,
        isTest: players.some((player) => player.isBot),
        winnerSeat: null,
        lastPlayedSeat: null,
        success: null,
      },
    },
  ]);
}

function returnToLobby(state: SpotmatchState, context: CommandContext): SpotmatchDecision {
  const hostRejection = requireHost<SpotmatchEvent, SpotmatchEffect>(
    context,
    state.hostUserId,
    SPOTMATCH_REASONS.notHostReturnToLobby,
  );
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'ended') return reject(SPOTMATCH_REASONS.phase);
  return commitSpotmatch([{ type: 'spotmatch.game.returnedToLobby' }]);
}

export function endSpotmatchGame(
  state: SpotmatchState,
  context: CommandContext,
): SpotmatchDecision {
  if (state.phase.kind !== 'playing' || state.round?.winnerSeat == null)
    return reject(SPOTMATCH_REASONS.phase);
  const events: readonly SpotmatchEvent[] = [{ type: 'spotmatch.game.ended' }];
  const ended = events.reduce(evolveSpotmatchState, state);
  const effect = state.xpSettled ? null : completionEffect(ended, context);
  return commitSpotmatch(events, effect === null ? [] : [effect]);
}

function claimCard(
  state: SpotmatchState,
  command: Extract<SpotmatchCommand, { type: 'spotmatch.card.claim' }>,
  context: CommandContext,
): SpotmatchDecision {
  const actor = resolveActingSeat(state, state.config.numberOfPlayers, context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.phase.kind !== 'playing' || state.round === null)
    return reject(SPOTMATCH_REASONS.phase);
  const round = state.round;
  const player = round.players.find((entry) => entry.seat === actor.value);
  if (
    player?.top == null ||
    command.roundId !== round.roundId ||
    command.centralInstanceId !== round.central.instanceId ||
    command.topInstanceId !== player.top.instanceId
  )
    return reject(SPOTMATCH_REASONS.stale);
  if (context.nowMs < player.lockedUntil) return reject(SPOTMATCH_REASONS.cooldown);
  if (round.success !== null && context.nowMs < round.success.until)
    return reject(SPOTMATCH_REASONS.paused);
  const inHand = player.top.symbols.includes(command.symbolId);
  const inCentral = round.central.symbols.includes(command.symbolId);
  if (!inHand && !inCentral) return reject(SPOTMATCH_REASONS.symbol);
  if (!inHand || !inCentral) {
    return commitDomainRejection(SPOTMATCH_REASONS.wrong, {
      events: [
        {
          type: 'spotmatch.round.updated',
          round: {
            ...round,
            players: round.players.map((entry) =>
              entry === player
                ? {
                    ...entry,
                    mistakes: entry.mistakes + 1,
                    lockedUntil: context.nowMs + SPOTMATCH_WRONG_LOCK_MS,
                    lastMistake: {
                      centralInstanceId: command.centralInstanceId,
                      topInstanceId: command.topInstanceId,
                      symbolId: command.symbolId,
                    },
                  }
                : entry,
            ),
          },
        },
      ],
    });
  }
  const remaining = player.remaining - 1;
  const central = player.top;
  const top =
    remaining === 0
      ? null
      : createSpotmatchCard(
          round.roundId,
          round.serial,
          [
            central.typeId,
            ...round.players.flatMap((entry) =>
              entry.seat === player.seat || entry.top === null ? [] : [entry.top.typeId],
            ),
          ],
          round.symbolMap,
          `${context.randomSeed}:refill`,
        );
  const nextRound = {
    ...round,
    central,
    serial: round.serial + 1,
    lastPlayedSeat: player.seat,
    success: {
      seat: player.seat,
      symbolId: command.symbolId,
      previousCentral: round.central,
      until: context.nowMs + SPOTMATCH_SUCCESS_PAUSE_MS,
    },
    winnerSeat: remaining === 0 ? player.seat : null,
    players: round.players.map((entry) =>
      entry === player
        ? {
            ...entry,
            top,
            remaining,
            correct: entry.correct + 1,
            lockedUntil: 0,
            lastMistake: null,
          }
        : entry,
    ),
  };
  const event: SpotmatchEvent = { type: 'spotmatch.round.updated', round: nextRound };
  if (remaining > 0) return commitSpotmatch([event]);
  const terminal = endSpotmatchGame(evolveSpotmatchState(state, event), context);
  if (terminal.kind !== 'commit') return terminal;
  return commitSpotmatch([event, ...terminal.events], terminal.effects);
}

function decideCommand(
  state: SpotmatchState,
  command: SpotmatchCommand,
  context: CommandContext,
): SpotmatchDecision {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'spotmatch.config.update':
      return decideSpotmatchRoom(state, command, context);
    case 'spotmatch.game.begin':
      return startGame(state, context);
    case 'spotmatch.game.returnToLobby':
      return returnToLobby(state, context);
    case 'spotmatch.card.claim':
      return claimCard(state, command, context);
    case 'spotmatch.game.abort': {
      const denied = requireHost<SpotmatchEvent, SpotmatchEffect>(
        context,
        state.hostUserId,
        SPOTMATCH_REASONS.notHostReturnToLobby,
      );
      if (denied !== null) return denied;
      if (state.phase.kind !== 'playing') return reject(SPOTMATCH_REASONS.phase);
      return commitSpotmatch([{ type: 'spotmatch.game.returnedToLobby' }]);
    }
    case 'spotmatch.game.restart': {
      const denied = requireHost<SpotmatchEvent, SpotmatchEffect>(
        context,
        state.hostUserId,
        SPOTMATCH_REASONS.notHostReturnToLobby,
      );
      if (denied !== null) return denied;
      if (command.gameSequence !== state.gameSequence || command.expectedPhase !== state.phase.kind)
        return reject(SPOTMATCH_REASONS.staleRestart);
      return commitSpotmatch([{ type: 'spotmatch.game.returnedToLobby' }]);
    }
    default:
      return reject(SPOTMATCH_REASONS.phase);
  }
}

/** Decides public and worker-internal commands against the authoritative state. */
export function decideSpotmatchCommand(
  state: SpotmatchState,
  command: SpotmatchCommand,
  context: CommandContext,
): SpotmatchDecision {
  return decideCommand(state, command, context);
}

/** Projects domain phases into the shared room lifecycle. */
export function getSpotmatchLifecycle(state: SpotmatchState): CommonGameLifecycle {
  return state.phase.kind === 'lobby'
    ? 'setup'
    : state.phase.kind === 'ended'
      ? 'ended'
      : 'ongoing';
}

export const spotmatchEngine = {
  gameType: SPOTMATCH_GAME_TYPE,
  stateVersion: SPOTMATCH_STATE_VERSION,
  capabilities: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botBulkViewing: false,
  },
  createInitialState,
  decide: decideSpotmatchCommand,
  evolve: evolveSpotmatchState,
  normalize: normalizeSpotmatchState,
  getLifecycle: getSpotmatchLifecycle,
} satisfies GameEngineDefinition<
  typeof SPOTMATCH_GAME_TYPE,
  SpotmatchState,
  SpotmatchConfig,
  SpotmatchCommand,
  SpotmatchEvent,
  SpotmatchEffect
>;
