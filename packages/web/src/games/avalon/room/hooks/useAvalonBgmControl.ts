/** Host-owned Avalon background music; narration and authoritative game state remain independent. */

import type { AvalonPhaseKind } from '@game-judge/game-engine/games/avalon/public';

import {
  type RoomBgmControlState,
  useRoomBgmControl,
} from '@/features/room/audio/useRoomBgmControl';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';

/** Phases between dawn and the end of the game: music is under manual host control only. */
const AVALON_DAY_PHASES: ReadonlySet<AvalonPhaseKind> = new Set<AvalonPhaseKind>([
  'nominate',
  'vote',
  'voteResult',
  'quest',
  'lady',
  'assassin',
]);

/**
 * BGM lifecycle mode derived from authoritative state:
 * - auto: night narration plus its dawn tail (the engine advances phase to nominate
 *   before queueing night_end, so the tail is observable only through isAudioPlaying).
 * - manual: day phases; the host's play/pause choice survives phase changes.
 * - off: lobby / identity viewing / ended.
 */
type AvalonBgmLifecycle = 'auto' | 'manual' | 'off';

function resolveBgmLifecycle(phase: AvalonPhaseKind, isAudioPlaying: boolean): AvalonBgmLifecycle {
  if (phase === 'night' || isAudioPlaying) return 'auto';
  return AVALON_DAY_PHASES.has(phase) ? 'manual' : 'off';
}

export type AvalonBgmControlState = RoomBgmControlState;

/**
 * Binds saved music preferences to Avalon lifecycle and explicit host playback controls.
 * Automatic BGM is night-only, matching werewolf. The shared audio core silences BGM
 * right before the dawn voice; the dawn ack moves the lifecycle from auto to manual,
 * which runs the (idempotent) stop below. Leaving play (lobby / ended) or losing host
 * ownership stops music. The play/pause control reads the player's own state.
 */
export function useAvalonBgmControl(
  audio: AvalonAudioRuntime,
  isHost: boolean,
  phase: AvalonPhaseKind,
  isAudioPlaying: boolean,
): AvalonBgmControlState {
  return useRoomBgmControl(audio, isHost, resolveBgmLifecycle(phase, isAudioPlaying));
}
