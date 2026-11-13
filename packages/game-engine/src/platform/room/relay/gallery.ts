/**
 * Relay gallery playback: linear position over all chains, monotonic
 * reveal, synchronized reveal animation, and resumable hold timers.
 *
 * Every newly revealed position is anchored with `revealStartedAt` and
 * `revealDurationMs`; clients play its reveal animation against that
 * server-time anchor. An automatic item's deadline is the end of its
 * reveal animation (or now, if later) plus the configured hold. Items
 * that were already revealed (rewind, revisit) clear the anchor, replay
 * nothing on any client, and get just the hold; finishing clears it too. Pausing never pauses the animation: it freezes only the
 * hold time that remains after the animation would end, and resuming
 * waits for any still-running animation before restoring that hold.
 * Playback pauses at chain boundaries. Manual-paging galleries (no
 * per-item duration) still anchor reveals but reject resume — paging is
 * the host's job there. Position is linear (chainIndex * players +
 * entryIndex); games that persist a two-dimensional position convert at
 * their own boundary.
 */

import { type Decision, type GameEffect, type GameEvent, reject } from '../../engine';
import { relayDeadline, relaySettleDueEffect } from './clock';
import type {
  RelayEventKit,
  RelayGalleryControl,
  RelayGalleryState,
  RelayRoundSlice,
} from './types';

function graphemeCount(text: string): number {
  // Constructed per call: a module-scope Segmenter would crash runtimes
  // that lack it (Safari 14) merely by importing the engine.
  if (typeof Intl.Segmenter !== 'function') return Array.from(text).length;
  return Array.from(new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(text)).length;
}

/** Text reveal animation length: 0 when empty, else 80 ms per grapheme within 400–8000 ms. */
export function relayTextRevealDuration(text: string): number {
  if (text.length === 0) return 0;
  return Math.min(8000, Math.max(400, graphemeCount(text) * 80));
}

export function relayRevealDuration<TEntry, TEvent extends GameEvent, TEffect extends GameEffect>(
  kit: RelayEventKit<TEntry, TEvent, TEffect>,
  state: RelayRoundSlice<TEntry>,
  position: number,
): number {
  const entry =
    state.chains[Math.floor(position / kit.shape.numberOfPlayers)]?.entries[
      position % kit.shape.numberOfPlayers
    ];
  if (entry === undefined) throw new Error('Missing relay gallery entry');
  return kit.revealDuration(entry);
}

/** The instant the current item's reveal animation ends, or now when it has none left. */
function revealEndAt(gallery: RelayGalleryState, nowMs: number): number {
  if (gallery.revealStartedAt === null) return nowMs;
  return Math.max(nowMs, gallery.revealStartedAt + gallery.revealDurationMs);
}

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
    // Only a first reveal animates; moving onto an already revealed item
    // (rewind or revisit) clears the anchor so no client replays it.
    revealStartedAt: position > state.gallery.revealedPosition ? nowMs : null,
    revealDurationMs:
      position > state.gallery.revealedPosition ? relayRevealDuration(kit, state, position) : 0,
  };
  const deadlineAt = isPlaying
    ? relayDeadline(revealEndAt(gallery, nowMs), kit.shape.galleryItemDurationSeconds)
    : null;
  const settleEffect = relaySettleDueEffect(kit, state, state.stepIndex, deadlineAt);
  return kit.commit(
    [kit.phaseChanged('gallery', deadlineAt, state.stepIndex, gallery)],
    settleEffect === null ? [] : [settleEffect],
  );
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
        // Finishing reveals everything at once; nothing is animated.
        revealStartedAt: null,
        revealDurationMs: 0,
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
            : Math.max(0, state.deadlineAt - revealEndAt(state.gallery, nowMs)),
      }),
    ]);
  }
  if (kit.shape.galleryItemDurationSeconds === null) return reject(kit.reasons.manual);
  if (state.gallery.position % kit.shape.numberOfPlayers === kit.shape.numberOfPlayers - 1)
    return moveRelayGallery(kit, state, 1, nowMs);
  const duration = state.gallery.remainingMs ?? kit.shape.galleryItemDurationSeconds * 1000;
  const deadlineAt = revealEndAt(state.gallery, nowMs) + duration;
  const settleEffect = relaySettleDueEffect(kit, state, state.stepIndex, deadlineAt);
  return kit.commit(
    [
      kit.phaseChanged('gallery', deadlineAt, state.stepIndex, {
        ...state.gallery,
        isPlaying: true,
        remainingMs: null,
      }),
    ],
    settleEffect === null ? [] : [settleEffect],
  );
}
