/** Authoritative plain-text Story Relay engine; delegates persistence and delivery to the platform. */

import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  resolveUncontrolledUserActorId,
} from '../../platform/engine';
import type { StoryRelayCommand } from './commands/types';
import { createStoryRelayAssignment } from './domain/assignment';
import {
  commitStoryRelay,
  requireStoryRelayHost,
  STORY_RELAY_REASONS,
  type StoryRelayDecision,
  type StoryRelayEffect,
  type StoryRelayEvent,
} from './domain/decision';
import { evolveStoryRelayState } from './domain/evolve';
import { controlStoryRelayGallery, moveStoryRelayGallery } from './domain/gallery';
import { decideStoryRelayRoom } from './domain/seating';
import {
  decideStoryRelaySkip,
  decideStoryRelayTask,
  storyRelayDeadline,
  storyRelayPhase,
} from './domain/tasks';
import { normalizeStoryRelayState } from './state/normalize';
import {
  getStoryRelayOccupiedSeatCount,
  isValidStoryRelayConfig,
  STORY_RELAY_GAME_TYPE,
  STORY_RELAY_STATE_VERSION,
  type StoryRelayConfig,
  type StoryRelayState,
} from './state/types';

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
    realSeats: {},
    botSeats: [],
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
  const hostRejection = requireStoryRelayHost(state, context);
  if (hostRejection !== null) return hostRejection;
  if (getStoryRelayOccupiedSeatCount(state) !== state.config.numberOfPlayers)
    return reject(STORY_RELAY_REASONS.full);
  const roundId = `storyrelay-round:${context.commandId}`;
  const assignment = createStoryRelayAssignment(state.config.numberOfPlayers, context.randomSeed);
  const participants = assignment.seatOrder.map((seat) => {
    const occupant = state.realSeats[seat];
    return {
      seat,
      userId: occupant === undefined ? null : occupant.userId,
      displayName: occupant === undefined ? `机器人${seat + 1}号` : occupant.profile.displayName,
    };
  });
  return commitStoryRelay([
    {
      type: 'storyrelay.round.started',
      round: {
        roundId,
        startedAt: context.nowMs,
        ...assignment,
        participants,
        deadlineAt: storyRelayDeadline(context.nowMs, state.config.writingDurationSeconds),
        chains: assignment.seatOrder.map((originSeat) => ({
          id: `${roundId}:chain:${originSeat}`,
          originSeat,
          entries: [],
        })),
      },
    },
  ]);
}

function expirePhase(state: StoryRelayState, context: CommandContext): StoryRelayDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (state.deadlineAt === null || context.nowMs < state.deadlineAt)
    return reject(STORY_RELAY_REASONS.deadline);
  switch (state.phase) {
    case 'answering':
      return commitStoryRelay([storyRelayPhase(state, 'settling', null)]);
    case 'transition': {
      if (state.completedAt !== null) {
        const isPlaying = state.config.galleryItemDurationSeconds !== null;
        return commitStoryRelay([
          storyRelayPhase(
            state,
            'gallery',
            storyRelayDeadline(context.nowMs, state.config.galleryItemDurationSeconds),
            state.stepIndex,
            { position: 0, revealedPosition: 0, isPlaying, remainingMs: null },
          ),
        ]);
      }
      return commitStoryRelay([
        storyRelayPhase(
          state,
          'answering',
          storyRelayDeadline(context.nowMs, state.config.writingDurationSeconds),
          state.stepIndex + 1,
        ),
      ]);
    }
    case 'gallery':
      return moveStoryRelayGallery(state, 1, context.nowMs);
    default:
      return reject(STORY_RELAY_REASONS.phase);
  }
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
    case 'storyrelay.bots.clear':
      return decideStoryRelayRoom(state, command, context);
    case 'storyrelay.round.start':
      return state.phase === 'lobby'
        ? startRound(state, context)
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.round.next':
      return state.phase === 'ended'
        ? startRound(state, context)
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.task.ready.set':
    case 'storyrelay.text.submit':
    case 'storyrelay.task.empty.submit':
      return decideStoryRelayTask(state, command, context);
    case 'storyrelay.task.skip':
    case 'storyrelay.bots.skip':
      return decideStoryRelaySkip(state, command, context);
    case 'storyrelay.phase.expire':
      return expirePhase(state, context);
    default:
      break;
  }
  const hostRejection = requireStoryRelayHost(state, context);
  if (hostRejection !== null) return hostRejection;
  switch (command.type) {
    case 'storyrelay.phase.finish':
      return state.phase === 'answering'
        ? commitStoryRelay([storyRelayPhase(state, 'settling', null)])
        : reject(STORY_RELAY_REASONS.phase);
    case 'storyrelay.round.abort':
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
