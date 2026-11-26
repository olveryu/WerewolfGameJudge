/** Authoritative Decrypto engine; delegates persistence and delivery to the platform. */

import {
  buildGameCompletionPayloadV2,
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  requireHost,
} from '../../platform/engine';
import { getHumanSeatMap } from '../../platform/room/seating';
import type { DecryptoCommand } from './commands/types';
import {
  commitDecrypto,
  DECRYPTO_REASONS,
  type DecryptoDecision,
  type DecryptoEffect,
  type DecryptoEvent,
} from './domain/decision';
import { evolveDecryptoState } from './domain/evolve';
import { decideRoundCommand } from './domain/roundCommands';
import { decideDecryptoRoom } from './domain/seating';
import { decideTeamCommand } from './domain/teamCommands';
import { normalizeDecryptoState } from './state/normalize';
import {
  DECRYPTO_GAME_TYPE,
  DECRYPTO_MIN_PLAYERS,
  type DecryptoConfig,
  type DecryptoState,
  isValidDecryptoConfig,
} from './state/types';

function createInitialState(config: DecryptoConfig, context: CreateGameContext): DecryptoState {
  if (!isValidDecryptoConfig(config)) throw new Error(DECRYPTO_REASONS.config);
  return normalizeDecryptoState({
    gameType: DECRYPTO_GAME_TYPE,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: { kind: 'lobby' },
    phaseRevision: 0,
    config: { ...config },
    roster: {},
    gameSequence: 0,
    xpSettled: false,
  });
}

function completionEffect(
  state: DecryptoState,
  terminalEvents: readonly DecryptoEvent[],
  context: CommandContext,
): DecryptoEffect | null {
  const completedState = terminalEvents.reduce(evolveDecryptoState, state);
  if (completedState.phase.kind !== 'ended')
    throw new Error('Decrypto completion requires ended phase');
  const humans = Object.values(
    getHumanSeatMap(completedState.roster, completedState.config.numberOfPlayers),
  );
  const outcome = completedState.phase.game.outcome;
  if (outcome === null) throw new Error('Decrypto completion requires a winner');
  const stats = humans.map(({ userId, seat }) => {
    const team =
      completedState.phase.kind === 'ended'
        ? completedState.phase.game.assignments[seat]
        : undefined;
    if (team === undefined) throw new Error(`Decrypto completion is missing team for seat ${seat}`);
    return {
      userId,
      gamesPlayed: 1 as const,
      wins: outcome === 'shared' || outcome === team ? (1 as const) : (0 as const),
    };
  });
  const payload = buildGameCompletionPayloadV2({
    roundId: `decrypto:game:${completedState.gameSequence}`,
    completedAt: context.nowMs,
    humans,
    minimumHumanPlayers: DECRYPTO_MIN_PLAYERS,
    stats,
  });
  return payload === null ? null : { type: 'decrypto.game.completed', payload };
}

function restartGame(
  state: DecryptoState,
  command: Extract<DecryptoCommand, { type: 'decrypto.game.restart' }>,
  context: CommandContext,
): DecryptoDecision {
  const hostRejection = requireHost<DecryptoEvent, DecryptoEffect>(
    context,
    state.hostUserId,
    DECRYPTO_REASONS.notHostRestart,
  );
  if (hostRejection !== null) return hostRejection;
  if (
    (state.phase.kind !== 'preparing' &&
      state.phase.kind !== 'playing' &&
      state.phase.kind !== 'ended') ||
    state.gameSequence !== command.gameSequence ||
    (state.phase.kind === 'ended') !== command.wasEnded
  )
    return reject(DECRYPTO_REASONS.phase);
  return commitDecrypto([{ type: 'decrypto.game.returnedToLobby' }]);
}

function routeCommand(
  state: DecryptoState,
  command: DecryptoCommand,
  context: CommandContext,
): DecryptoDecision {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'decrypto.config.update':
      return decideDecryptoRoom(state, command, context);
    case 'decrypto.game.restart':
      return restartGame(state, command, context);
    default: {
      const teamDecision = decideTeamCommand(state, command, context);
      if (teamDecision !== null) return teamDecision;
      return decideRoundCommand(state, command, context) ?? reject(DECRYPTO_REASONS.phase);
    }
  }
}

function attachCompletion(
  state: DecryptoState,
  decision: DecryptoDecision,
  context: CommandContext,
): DecryptoDecision {
  if (decision.kind !== 'commit') return decision;
  const terminalEvents = decision.events.filter((event) => event.type === 'decrypto.game.ended');
  if (terminalEvents.length === 0) return decision;
  const effect = completionEffect(state, terminalEvents, context);
  if (effect === null) return decision;
  return commitDecrypto(decision.events, [...decision.effects, effect]);
}

/** Decides public and worker-internal commands against authoritative state. */
export function decideDecryptoCommand(
  state: DecryptoState,
  command: DecryptoCommand,
  context: CommandContext,
): DecryptoDecision {
  return attachCompletion(state, routeCommand(state, command, context), context);
}

/** Projects domain phases into the shared room lifecycle. */
export function getDecryptoLifecycle(state: DecryptoState): CommonGameLifecycle {
  return state.phase.kind === 'lobby'
    ? 'setup'
    : state.phase.kind === 'ended'
      ? 'ended'
      : 'ongoing';
}

export const decryptoEngine = {
  gameType: DECRYPTO_GAME_TYPE,
  capabilities: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: true,
    gallery: false,
    hostConfig: true,
    botBulkViewing: false,
  },
  createInitialState,
  decide: decideDecryptoCommand,
  evolve: evolveDecryptoState,
  normalize: normalizeDecryptoState,
  getLifecycle: getDecryptoLifecycle,
} satisfies GameEngineDefinition<
  typeof DECRYPTO_GAME_TYPE,
  DecryptoState,
  DecryptoConfig,
  DecryptoCommand,
  DecryptoEvent,
  DecryptoEffect
>;
