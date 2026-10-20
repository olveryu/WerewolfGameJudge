/** Authoritative plain-text Story Relay engine; delegates persistence and delivery to the platform. */

import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  requireHost,
} from '../../platform/engine';
import { guardPhaseExpiry } from '../../platform/room/phaseDeadline';
import { buildRelayChains, buildRelayParticipants } from '../../platform/room/relay/assignment';
import { expireRelayPhase, relayDeadline } from '../../platform/room/relay/clock';
import { isRoomFull } from '../../platform/room/seating';
import type { StoryRelayCommand } from './commands/types';
import {
  commitStoryRelay,
  STORY_RELAY_REASONS,
  type StoryRelayDecision,
  type StoryRelayEffect,
  type StoryRelayEvent,
} from './domain/decision';
import { evolveStoryRelayState } from './domain/evolve';
import {
  controlStoryRelayGallery,
  createStoryRelayAssignment,
  createStoryRelayRelayKit,
  decideStoryRelayTask,
  STORY_RELAY_EXPIRE_HOOKS,
  storyRelayPhase,
} from './domain/relay';
import { decideStoryRelayRoom } from './domain/seating';
import { normalizeStoryRelayState } from './state/normalize';
import {
  isValidStoryRelayConfig,
  STORY_RELAY_GAME_TYPE,
  type StoryRelayConfig,
  type StoryRelayEntry,
  type StoryRelayState,
} from './state/types';
import { STORY_RELAY_STATE_VERSION } from './state/version';

function createInitialState(config: StoryRelayConfig, context: CreateGameContext): StoryRelayState {
  if (!isValidStoryRelayConfig(config)) throw new Error(STORY_RELAY_REASONS.config);
  return normalizeStoryRelayState({
    gameType: STORY_RELAY_GAME_TYPE,
    stateVersion: STORY_RELAY_STATE_VERSION,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    config: { ...config },
    phase: 'lobby',
    phaseRevision: 0,
    roster: {},
    roundNumber: 0,
    roundId: null,
    startedAt: null,
    participants: [],
    seatOrder: [],
    stepOffsets: [],
    stepIndex: -1,
    deadlineAt: null,
    readySeats: [],
    chains: [],
    gallery: null,
    completedAt: null,
    abortedAt: null,
  });
}

function startRound(state: StoryRelayState, context: CommandContext): StoryRelayDecision {
  const hostRejection = requireHost<StoryRelayEvent, StoryRelayEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  if (!isRoomFull(state.roster, state.config.numberOfPlayers))
    return reject(STORY_RELAY_REASONS.full);
  const roundId = `storyrelay-round:${context.commandId}`;
  const assignment = createStoryRelayAssignment(state.config.numberOfPlayers, context.randomSeed);
  const participants = buildRelayParticipants(
    assignment.seatOrder,
    state.roster,
    (occupant) => occupant.profile.displayName,
  );
  return commitStoryRelay([
    {
      type: 'storyrelay.round.started',
      round: {
        roundId,
        startedAt: context.nowMs,
        ...assignment,
        participants,
        deadlineAt: relayDeadline(context.nowMs, state.config.writingDurationSeconds),
        chains: buildRelayChains<StoryRelayEntry>(roundId, assignment.seatOrder),
      },
    },
  ]);
}

function expirePhase(state: StoryRelayState, context: CommandContext): StoryRelayDecision {
  // The revision gate for this command runs in decideStoryRelayCommand
  // (stale revisions reject there); the shared guard sequence covers
  // the actor and deadline gates and the dispatch.
  return guardPhaseExpiry(context, {
    deadlineAt: state.deadlineAt,
    notExpiredReason: STORY_RELAY_REASONS.deadline,
    dispatch: (nowMs) =>
      expireRelayPhase(createStoryRelayRelayKit(state), state, nowMs, STORY_RELAY_EXPIRE_HOOKS),
  });
}

/** Decides public commands against the current authoritative round and phase revision. */
export function decideStoryRelayCommand(
  state: StoryRelayState,
  command: StoryRelayCommand,
  context: CommandContext,
): StoryRelayDecision {
  if ('phaseRevision' in command && command.phaseRevision !== state.phaseRevision)
    return reject(STORY_RELAY_REASONS.task);
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'storyrelay.config.update':
      return decideStoryRelayRoom(state, command, context);
    case 'storyrelay.game.begin':
      return state.phase === 'lobby'
        ? startRound(state, context)
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.game.next':
      return state.phase === 'ended'
        ? startRound(state, context)
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.task.ready.set':
    case 'storyrelay.text.submit':
    case 'storyrelay.task.empty.submit':
      return decideStoryRelayTask(state, command, context);
    case 'storyrelay.phase.expire':
      return expirePhase(state, context);
    default:
      break;
  }
  const hostRejection = requireHost<StoryRelayEvent, StoryRelayEffect>(context, state.hostUserId);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'storyrelay.phase.finish':
      return state.phase === 'answering'
        ? commitStoryRelay([storyRelayPhase(state, 'settling', null)])
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.game.abort':
      return ['answering', 'settling', 'transition'].includes(state.phase) &&
        state.completedAt === null
        ? commitStoryRelay([{ type: 'storyrelay.round.aborted', abortedAt: context.nowMs }])
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.game.returnToLobby':
      return state.phase === 'ended' || state.phase === 'aborted'
        ? commitStoryRelay([{ type: 'storyrelay.game.returnedToLobby' }])
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.gallery.pause':
    case 'storyrelay.gallery.resume':
    case 'storyrelay.gallery.advance':
    case 'storyrelay.gallery.rewind':
    case 'storyrelay.gallery.finish':
      return controlStoryRelayGallery(state, command.type, context.nowMs);
  }
}

/** Projects domain phases into the shared room lifecycle. */
export function getStoryRelayLifecycle(state: StoryRelayState): CommonGameLifecycle {
  return state.phase === 'lobby'
    ? 'setup'
    : state.phase === 'ended' || state.phase === 'aborted'
      ? 'ended'
      : 'ongoing';
}

export const storyRelayEngine = {
  gameType: STORY_RELAY_GAME_TYPE,
  stateVersion: STORY_RELAY_STATE_VERSION,
  capabilities: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: true,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: true,
    hostConfig: true,
    botTestScaffold: false,
  },
  createInitialState,
  decide: decideStoryRelayCommand,
  evolve: evolveStoryRelayState,
  normalize: normalizeStoryRelayState,
  getLifecycle: getStoryRelayLifecycle,
} satisfies GameEngineDefinition<
  typeof STORY_RELAY_GAME_TYPE,
  StoryRelayState,
  StoryRelayConfig,
  StoryRelayCommand,
  StoryRelayEvent,
  StoryRelayEffect
>;
