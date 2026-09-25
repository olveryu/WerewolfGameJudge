/** Synchronized Story Relay playback with monotonic reveal position and resumable timers. */

import { reject } from '../../../platform/engine';
import type { StoryRelayState } from '../state/types';
import { commitStoryRelay, STORY_RELAY_REASONS, type StoryRelayDecision } from './decision';
import { storyRelayDeadline, storyRelayPhase } from './tasks';

/** Moves playback, pausing at story boundaries while retaining already revealed entries. */
export function moveStoryRelayGallery(
  state: StoryRelayState,
  direction: 1 | -1,
  nowMs: number,
): StoryRelayDecision {
  if (state.phase !== 'gallery' || state.gallery === null) return reject(STORY_RELAY_REASONS.phase);
  const total = state.config.numberOfPlayers ** 2;
  const position = state.gallery.position + direction;
  if (position < 0) return commitStoryRelay([]);
  if (position >= total)
    return commitStoryRelay([
      storyRelayPhase(state, 'ended', null, state.stepIndex, state.gallery),
    ]);
  const isStoryBoundary =
    position % state.config.numberOfPlayers === state.config.numberOfPlayers - 1;
  const isNewStory =
    Math.floor(position / state.config.numberOfPlayers) !==
    Math.floor(state.gallery.position / state.config.numberOfPlayers);
  const isPlaying =
    state.config.galleryItemDurationSeconds !== null &&
    !isStoryBoundary &&
    (isNewStory || state.gallery.isPlaying);
  const gallery = {
    position,
    revealedPosition: Math.max(position, state.gallery.revealedPosition),
    isPlaying,
    remainingMs: null,
  };
  return commitStoryRelay([
    storyRelayPhase(
      state,
      'gallery',
      isPlaying ? storyRelayDeadline(nowMs, state.config.galleryItemDurationSeconds) : null,
      state.stepIndex,
      gallery,
    ),
  ]);
}

/** Applies host playback controls after the caller has checked host and revision. */
export function controlStoryRelayGallery(
  state: StoryRelayState,
  type: string,
  nowMs: number,
): StoryRelayDecision {
  if (state.phase !== 'gallery' || state.gallery === null) return reject(STORY_RELAY_REASONS.phase);
  if (type === 'storyrelay.gallery.advance') return moveStoryRelayGallery(state, 1, nowMs);
  if (type === 'storyrelay.gallery.rewind') return moveStoryRelayGallery(state, -1, nowMs);
  if (type === 'storyrelay.gallery.finish') {
    const position = state.config.numberOfPlayers ** 2 - 1;
    return commitStoryRelay([
      storyRelayPhase(state, 'ended', null, state.stepIndex, {
        position,
        revealedPosition: position,
        isPlaying: false,
        remainingMs: null,
      }),
    ]);
  }
  if (type === 'storyrelay.gallery.pause') {
    return commitStoryRelay([
      storyRelayPhase(state, 'gallery', null, state.stepIndex, {
        ...state.gallery,
        isPlaying: false,
        remainingMs:
          state.deadlineAt === null
            ? state.gallery.remainingMs
            : Math.max(0, state.deadlineAt - nowMs),
      }),
    ]);
  }
  if (type !== 'storyrelay.gallery.resume') return reject(STORY_RELAY_REASONS.phase);
  if (state.config.galleryItemDurationSeconds === null) return reject(STORY_RELAY_REASONS.manual);
  if (state.gallery.position % state.config.numberOfPlayers === state.config.numberOfPlayers - 1)
    return moveStoryRelayGallery(state, 1, nowMs);
  const duration = state.gallery.remainingMs ?? state.config.galleryItemDurationSeconds * 1000;
  return commitStoryRelay([
    storyRelayPhase(state, 'gallery', nowMs + duration, state.stepIndex, {
      ...state.gallery,
      isPlaying: true,
      remainingMs: null,
    }),
  ]);
}
