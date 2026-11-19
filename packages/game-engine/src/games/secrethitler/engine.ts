/** Authoritative Secrethitler engine; delegates persistence and delivery to the platform. */

import { acknowledgeAudioQueue, guardAudioPlayback } from '../../platform/audio';
import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  requireHost,
} from '../../platform/engine';
import { resolveActingSeat } from '../../platform/room/actingSeat';
import {
  decideConfirmViewed,
  decideMarkBotsViewed,
  haveAllViewed,
} from '../../platform/room/identityViewing';
import { isBotSeat, isRoomFull } from '../../platform/room/seating';
import type { SecrethitlerCommand } from './commands/types';
import {
  commitSecrethitler,
  SECRETHITLER_REASONS,
  type SecrethitlerDecision,
  type SecrethitlerEffect,
  type SecrethitlerEvent,
} from './domain/decision';
import { evolveSecrethitlerState } from './domain/evolve';
import {
  beginSecrethitlerNight,
  decideSecrethitlerGameplay,
  evaluateSecrethitlerNightCompletion,
} from './domain/gameplay';
import {
  chooseSecrethitlerFirstPresident,
  createSecrethitlerPolicyDeck,
  dealSecrethitlerIdentities,
  getSecrethitlerNightParticipants,
} from './domain/rules';
import { decideSecrethitlerRoom } from './domain/seating';
import { normalizeSecrethitlerState } from './state/normalize';
import {
  getSecrethitlerViewingParticipants,
  isValidSecrethitlerConfig,
  SECRETHITLER_GAME_TYPE,
  type SecrethitlerConfig,
  type SecrethitlerState,
} from './state/types';
import { SECRETHITLER_STATE_VERSION } from './state/version';

function createInitialState(
  config: SecrethitlerConfig,
  context: CreateGameContext,
): SecrethitlerState {
  if (!isValidSecrethitlerConfig(config)) throw new Error(SECRETHITLER_REASONS.config);
  return normalizeSecrethitlerState({
    gameType: SECRETHITLER_GAME_TYPE,
    stateVersion: SECRETHITLER_STATE_VERSION,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: { kind: 'lobby' },
    phaseRevision: 0,
    config: { ...config },
    roster: {},
    identities: {},
    roleViewedSeats: [],
    gameSequence: 0,
    xpSettled: false,
    pendingAudioEffects: [],
    isAudioPlaying: false,
    audioBatchId: 0,
    livingSeats: [],
    nextPresidentSeat: 0,
    electionTracker: 0,
    lastPresidentSeat: null,
    lastChancellorSeat: null,
    liberalPolicies: 0,
    fascistPolicies: 0,
    policyDeck: [],
    policyDiscard: [],
    investigatedSeats: [],
    lastInvestigation: null,
    history: { governments: [], policies: [], actions: [] },
  });
}

/** 对局结束时发结算 effect，Worker 据此发 XP 奖励；xpSettled 保证恰好一次。 */
/**
 * Host deals the game: assign identities and
 * enter the viewing stage. Dealing never starts play — the host
 * begins the game only once every seat has viewed its identity.
 */
function startGame(state: SecrethitlerState, context: CommandContext): SecrethitlerDecision {
  const hostRejection = requireHost<SecrethitlerEvent, SecrethitlerEffect>(
    context,
    state.hostUserId,
    SECRETHITLER_REASONS.notHostStart,
  );
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'lobby') return reject(SECRETHITLER_REASONS.phase);
  if (!isRoomFull(state.roster, state.config.numberOfPlayers))
    return reject(SECRETHITLER_REASONS.full);
  const audioReason = guardAudioPlayback(state, SECRETHITLER_REASONS.audioPlaying);
  if (audioReason !== null) return reject(audioReason);
  return commitSecrethitler([
    {
      type: 'secrethitler.game.started',
      identities: dealSecrethitlerIdentities(state, context.randomSeed),
      gameSequence: state.gameSequence + 1,
      firstPresidentSeat: chooseSecrethitlerFirstPresident(state, context.randomSeed),
      policyDeck: createSecrethitlerPolicyDeck(context.randomSeed),
    },
  ]);
}

/** Host begins play from the viewing stage: the identity checkpoint must be complete. */
function beginGame(state: SecrethitlerState, context: CommandContext): SecrethitlerDecision {
  const hostRejection = requireHost<SecrethitlerEvent, SecrethitlerEffect>(
    context,
    state.hostUserId,
    SECRETHITLER_REASONS.notHostBegin,
  );
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'viewing') return reject(SECRETHITLER_REASONS.phase);
  if (!haveAllViewed(getSecrethitlerViewingParticipants(state), state.roleViewedSeats))
    return reject(SECRETHITLER_REASONS.notAllViewed);
  return beginSecrethitlerNight(state);
}

/**
 * Identity Viewing Protocol: records that the actor's seat viewed its
 * identity. Idempotent, and accepted in any in-game phase; the record
 * only gates the host's begin command in the viewing stage.
 */
function markRoleViewed(state: SecrethitlerState, context: CommandContext): SecrethitlerDecision {
  return decideConfirmViewed({
    actingSeat: resolveActingSeat(state, state.config.numberOfPlayers, context),
    viewedSeats: state.roleViewedSeats,
    phaseRejection:
      state.phase.kind === 'lobby' || state.phase.kind === 'ended'
        ? reject(SECRETHITLER_REASONS.phase)
        : null,
    buildViewedEvent: (seat) => ({ type: 'secrethitler.role.viewed', seat }),
    commit: commitSecrethitler,
  });
}

function restartGame(
  state: SecrethitlerState,
  command: Extract<SecrethitlerCommand, { readonly type: 'secrethitler.game.restart' }>,
  context: CommandContext,
): SecrethitlerDecision {
  const hostRejection = requireHost<SecrethitlerEvent, SecrethitlerEffect>(
    context,
    state.hostUserId,
    SECRETHITLER_REASONS.notHostAbort,
  );
  if (hostRejection !== null) return hostRejection;
  if (
    state.phase.kind === 'lobby' ||
    state.gameSequence !== command.gameSequence ||
    (state.phase.kind === 'ended') !== command.wasEnded
  )
    return reject(SECRETHITLER_REASONS.phase);
  const audioReason = guardAudioPlayback(state, SECRETHITLER_REASONS.audioPlaying);
  if (audioReason !== null) return reject(audioReason);
  return commitSecrethitler([{ type: 'secrethitler.game.returnedToLobby' }]);
}

function markAllBotsViewed(
  state: SecrethitlerState,
  context: CommandContext,
): SecrethitlerDecision {
  return decideMarkBotsViewed({
    gateRejection:
      state.phase.kind === 'lobby' || state.phase.kind === 'ended'
        ? reject(SECRETHITLER_REASONS.phase)
        : requireHost<SecrethitlerEvent, SecrethitlerEffect>(
            context,
            state.hostUserId,
            SECRETHITLER_REASONS.notHostMarkBots,
          ),
    participants: getSecrethitlerViewingParticipants(state),
    viewedSeats: state.roleViewedSeats,
    noBotSeatsReason: SECRETHITLER_REASONS.noBotSeats,
    buildViewedEvent: (seat) => ({ type: 'secrethitler.role.viewed', seat }),
    commit: commitSecrethitler,
  });
}

function markAllBotsGroupConfirmed(
  state: SecrethitlerState,
  context: CommandContext,
): SecrethitlerDecision {
  const hostRejection = requireHost<SecrethitlerEvent, SecrethitlerEffect>(
    context,
    state.hostUserId,
    SECRETHITLER_REASONS.notHostMarkBots,
  );
  if (hostRejection !== null) return hostRejection;
  const phase = state.phase;
  if (phase.kind !== 'night') return reject(SECRETHITLER_REASONS.phase);
  const bots = getSecrethitlerNightParticipants(state).filter((seat) =>
    isBotSeat(state.roster, seat),
  );
  if (bots.length === 0) return reject(SECRETHITLER_REASONS.noBotSeats);
  const unconfirmed = bots.filter((seat) => !phase.confirmedSeats.includes(seat));
  return commitSecrethitler(
    unconfirmed.length === 0
      ? []
      : [
          {
            type: 'secrethitler.gameplay.updated',
            patch: {
              phase: { ...phase, confirmedSeats: [...phase.confirmedSeats, ...unconfirmed] },
            },
          },
        ],
  );
}

/** 房主播完指定批次后提交 ack：当前批次清空队列、释放音频门；旧批次幂等空转；未入队的批次拒绝。 */
function ackAudio(
  state: SecrethitlerState,
  audioBatchId: number,
  context: CommandContext,
): SecrethitlerDecision {
  const hostRejection = requireHost<SecrethitlerEvent, SecrethitlerEffect>(
    context,
    state.hostUserId,
    SECRETHITLER_REASONS.notHostAckAudio,
  );
  if (hostRejection !== null) return hostRejection;
  const ack = acknowledgeAudioQueue(state, audioBatchId);
  switch (ack.kind) {
    case 'alreadyAcknowledged':
      return commitSecrethitler([]);
    case 'unknownBatch':
      return reject(SECRETHITLER_REASONS.unknownAudioBatch);
    case 'cleared':
      return commitSecrethitler([{ type: 'secrethitler.audio.cleared', audioBatchId }]);
  }
}

function decideCommand(
  state: SecrethitlerState,
  command: SecrethitlerCommand,
  context: CommandContext,
): SecrethitlerDecision {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'secrethitler.config.update':
      return decideSecrethitlerRoom(state, command, context);
    case 'secrethitler.roles.assign':
      return startGame(state, context);
    case 'secrethitler.game.begin':
      return beginGame(state, context);
    case 'secrethitler.game.restart':
      return restartGame(state, command, context);
    case 'secrethitler.bots.markAllBotsViewed':
      return markAllBotsViewed(state, context);
    case 'secrethitler.bots.markAllBotsGroupConfirmed':
      return markAllBotsGroupConfirmed(state, context);
    case 'secrethitler.role.viewed':
      return markRoleViewed(state, context);
    case 'secrethitler.audio.ack':
      return ackAudio(state, command.audioBatchId, context);
  }
  return decideSecrethitlerGameplay(state, command, context) ?? reject(SECRETHITLER_REASONS.phase);
}

/** Decides public and worker-internal commands against the authoritative state. */
export function decideSecrethitlerCommand(
  state: SecrethitlerState,
  command: SecrethitlerCommand,
  context: CommandContext,
): SecrethitlerDecision {
  const decision = decideCommand(state, command, context);
  if (
    decision.kind !== 'commit' ||
    (command.type !== 'secrethitler.audio.ack' &&
      command.type !== 'secrethitler.night.confirm' &&
      command.type !== 'secrethitler.bots.markAllBotsGroupConfirmed')
  )
    return decision;
  const intermediate = decision.events.reduce(evolveSecrethitlerState, state);
  const progression = evaluateSecrethitlerNightCompletion(intermediate);
  return progression.length === 0
    ? decision
    : commitSecrethitler([...decision.events, ...progression], decision.effects);
}

/** Projects domain phases into the shared room lifecycle. */
export function getSecrethitlerLifecycle(state: SecrethitlerState): CommonGameLifecycle {
  return state.phase.kind === 'lobby'
    ? 'setup'
    : state.phase.kind === 'ended'
      ? 'ended'
      : 'ongoing';
}

export const secrethitlerEngine = {
  gameType: SECRETHITLER_GAME_TYPE,
  stateVersion: SECRETHITLER_STATE_VERSION,
  capabilities: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: false,
    audioOrchestration: true,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botBulkViewing: true,
  },
  createInitialState,
  decide: decideSecrethitlerCommand,
  evolve: evolveSecrethitlerState,
  normalize: normalizeSecrethitlerState,
  getLifecycle: getSecrethitlerLifecycle,
} satisfies GameEngineDefinition<
  typeof SECRETHITLER_GAME_TYPE,
  SecrethitlerState,
  SecrethitlerConfig,
  SecrethitlerCommand,
  SecrethitlerEvent,
  SecrethitlerEffect
>;
