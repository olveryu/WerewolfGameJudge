/**
 * Relay Chain — shared flow machine for chain-relay games.
 *
 * Pictionary and Story Relay run the same machine: a seeded seat
 * rotation hands every chain to every seat exactly once (Williams
 * offsets), each step collects one entry per chain, a full step moves
 * through a timed transition into the next step, and the finished
 * chains play back in a gallery with a monotonic reveal position and
 * freezable timers. These types are the machine's vocabulary; the
 * logic lives in assignment / tasks / gallery / clock / evolve in
 * this directory and is the single implementation both games use.
 *
 * What stays game-owned: entry payloads and kinds (TEntry), the
 * reason strings (RelayReasons carries each game's own table — the
 * strings are keys into that game's client failure copy), the event
 * and effect shapes (built through RelayEventKit factories), and the
 * moment a completed round settles (injected per game; the two games
 * currently settle at different points by registered difference).
 */

import type { Decision, GameCompletionPayload, GameEffect, GameEvent } from '../../engine';
import type { RosterMap, SeatOccupant } from '../seating';

/** Binds a task command to the round, step and chain it acts on. */
export interface RelayTaskIdentity {
  readonly roundId: string;
  readonly stepIndex: number;
  readonly chainId: string;
}

/** One relay chain: an origin seat plus the entries appended step by step. */
export interface RelayChain<TEntry> {
  readonly id: string;
  readonly originSeat: number;
  readonly entries: readonly TEntry[];
}

/** Linear gallery playback state; position is chainIndex * players + entryIndex. */
export interface RelayGalleryState {
  readonly position: number;
  readonly revealedPosition: number;
  readonly isPlaying: boolean;
  readonly remainingMs: number | null;
}

/** Frozen per-seat identity for one round, captured when the round starts. */
export interface RelayParticipant {
  readonly seat: number;
  readonly displayName: string;
  readonly userId: string | null;
}

/** The phase set every relay game runs; no game adds or renames a phase. */
export type RelayPhase =
  | 'lobby'
  | 'answering'
  | 'settling'
  | 'transition'
  | 'gallery'
  | 'ended'
  | 'aborted';

/**
 * One seat's current task. The projection is the privacy boundary of
 * the machine: it exposes only the immediately previous entry of the
 * seat's current chain, never earlier entries or other chains.
 */
export interface RelayTask<TPrevious> {
  readonly roundId: string;
  readonly stepIndex: number;
  readonly chainId: string;
  readonly authorSeat: number;
  readonly previousEntry: TPrevious | null;
  readonly isSubmitted: boolean;
}

/** The round-owned slice of state the shared machine reads and evolves. */
export interface RelayRoundSlice<TEntry> {
  readonly phase: RelayPhase;
  readonly phaseRevision: number;
  readonly roundId: string | null;
  readonly roundNumber: number;
  readonly participants: readonly RelayParticipant[];
  readonly seatOrder: readonly number[];
  readonly stepOffsets: readonly number[];
  readonly stepIndex: number;
  readonly deadlineAt: number | null;
  readonly readySeats: readonly number[];
  readonly chains: readonly RelayChain<TEntry>[];
  readonly gallery: RelayGalleryState | null;
}

/** The rejection points the shared machine can raise, in the game's own strings. */
export interface RelayReasons {
  readonly phase: string;
  readonly task: string;
  /**
   * Reason for a task command that arrives after its phase
   * deadline. Optional: a game whose late-arrival and stale-task
   * points share one string omits it and falls back to `task`.
   */
  readonly taskExpired?: string;
  readonly submitted: string;
  readonly text: string;
  readonly manual: string;
}

/** Round dimensions the machine needs, read from the game's own config. */
export interface RelayShape {
  readonly numberOfPlayers: number;
  readonly transitionDurationSeconds: number;
  readonly galleryItemDurationSeconds: number | null;
}

/**
 * Game-supplied assembly for the shared decisions: the game's reason
 * strings and shape, its commit, and factories that build its own
 * event/effect shapes from the machine's canonical payloads.
 */
export interface RelayEventKit<TEntry, TEvent extends GameEvent, TEffect extends GameEffect> {
  readonly reasons: RelayReasons;
  readonly shape: RelayShape;
  commit(events: readonly TEvent[], effects?: readonly TEffect[]): Decision<TEvent, TEffect>;
  phaseChanged(
    phase: RelayPhase,
    deadlineAt: number | null,
    stepIndex: number,
    gallery: RelayGalleryState | null,
  ): TEvent;
  taskReady(seat: number, isReady: boolean): TEvent;
  entryAppended(chainId: string, entry: TEntry): TEvent;
  roundCompleted(completedAt: number): TEvent;
  completionEffect(payload: GameCompletionPayload): TEffect;
}

/** A task command at machine level; games map their command types onto kinds. */
export type RelayTaskCommand =
  | (RelayTaskIdentity & { readonly kind: 'ready'; readonly isReady: boolean })
  | (RelayTaskIdentity & { readonly kind: 'text'; readonly text: string })
  | (RelayTaskIdentity & { readonly kind: 'empty' });

/** Host gallery controls at machine level; games map their command types onto these. */
export type RelayGalleryControl = 'pause' | 'resume' | 'advance' | 'rewind' | 'finish';

/** Roster access the shared task decisions need, satisfied by every game's state. */
export interface RelayActorSlice {
  readonly hostUserId: string;
  readonly roster: RosterMap<SeatOccupant>;
}
