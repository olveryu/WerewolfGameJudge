/**
 * Relay gallery playback: linear position over all chains, monotonic
 * reveal, and resumable timers.
 *
 * Playback pauses at chain boundaries; pausing freezes the remaining
 * time out of the phase deadline, resuming restores it. Manual-paging
 * galleries (no per-item duration) reject resume — paging is the
 * host's job there. Position is linear (chainIndex * players +
 * entryIndex); games that persist a two-dimensional position convert
 * at their own boundary.
 */

import { type Decision, type GameEffect, type GameEvent, reject } from '../../engine';
import { relayDeadline } from './clock';
import type { RelayEventKit, RelayGalleryControl, RelayRoundSlice } from './types';

/** Moves playback, pausing at chain boundaries while retaining already revealed entries. */
export function moveRelayGallery<TEntry, TEvent extends GameEvent, TEffect extends GameEffect>(
  kit: RelayEventKit<TEntry, TEvent, TEffect>,
  state: RelayRoundSlice<TEntry>,
  direction: 1 | -1,
  nowMs: number,
): Decision<TEvent, TEffect> {
  if (state.phase !== 'gallery' || state.gallery === null) return reject(kit.reasons.phase);
  const total = kit.shape.numberOfPlayers ** 2;
  const position = state.gallery.position + direction;
  if (position < 0) return kit.commit([]);
  if (position >= total)
    return kit.commit([kit.phaseChanged('ended', null, state.stepIndex, state.gallery)]);
  const isStoryBoundary = position % kit.shape.numberOfPlayers === kit.shape.numberOfPlayers - 1;
  const isNewStory =
    Math.floor(position / kit.shape.numberOfPlayers) !==
    Math.floor(state.gallery.position / kit.shape.numberOfPlayers);
  const isPlaying =
    kit.shape.galleryItemDurationSeconds !== null &&
    !isStoryBoundary &&
    (isNewStory || state.gallery.isPlaying);
  const gallery = {
    position,
    revealedPosition: Math.max(position, state.gallery.revealedPosition),
    isPlaying,
    remainingMs: null,
  };
  return kit.commit([
    kit.phaseChanged(
      'gallery',
      isPlaying ? relayDeadline(nowMs, kit.shape.galleryItemDurationSeconds) : null,
      state.stepIndex,
      gallery,
    ),
  ]);
}

/** Applies host playback controls after the caller has checked host and revision. */
export function controlRelayGallery<TEntry, TEvent extends GameEvent, TEffect extends GameEffect>(
  kit: RelayEventKit<TEntry, TEvent, TEffect>,
  state: RelayRoundSlice<TEntry>,
  control: RelayGalleryControl,
  nowMs: number,
): Decision<TEvent, TEffect> {
  if (state.phase !== 'gallery' || state.gallery === null) return reject(kit.reasons.phase);
  if (control === 'advance') return moveRelayGallery(kit, state, 1, nowMs);
  if (control === 'rewind') return moveRelayGallery(kit, state, -1, nowMs);
  if (control === 'finish') {
    const position = kit.shape.numberOfPlayers ** 2 - 1;
    return kit.commit([
      kit.phaseChanged('ended', null, state.stepIndex, {
        position,
        revealedPosition: position,
        isPlaying: false,
        remainingMs: null,
      }),
    ]);
  }
  if (control === 'pause') {
    return kit.commit([
      kit.phaseChanged('gallery', null, state.stepIndex, {
        ...state.gallery,
        isPlaying: false,
        remainingMs:
          state.deadlineAt === null
            ? state.gallery.remainingMs
            : Math.max(0, state.deadlineAt - nowMs),
      }),
    ]);
  }
  if (kit.shape.galleryItemDurationSeconds === null) return reject(kit.reasons.manual);
  if (state.gallery.position % kit.shape.numberOfPlayers === kit.shape.numberOfPlayers - 1)
    return moveRelayGallery(kit, state, 1, nowMs);
  const duration = state.gallery.remainingMs ?? kit.shape.galleryItemDurationSeconds * 1000;
  return kit.commit([
    kit.phaseChanged('gallery', nowMs + duration, state.stepIndex, {
      ...state.gallery,
      isPlaying: true,
      remainingMs: null,
    }),
  ]);
}
