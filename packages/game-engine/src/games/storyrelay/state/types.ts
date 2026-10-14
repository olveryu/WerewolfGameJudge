/** Authoritative Story Relay state; plain text only, without IO. */

import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import {
  countOccupiedSeats,
  findRosterSeatByUserId,
  type RosterMap,
  type SeatOccupant,
} from '../../../platform/room/seating';

export const STORY_RELAY_GAME_TYPE = 'storyrelay' as const;
export const STORY_RELAY_MIN_PLAYERS = 4;
export const STORY_RELAY_MAX_PLAYERS = 20;
export const STORY_RELAY_TEXT_MAX_LENGTH = 512;
export const STORY_RELAY_WRITING_DURATIONS = [45, 60, 90, 120, 180, null] as const;
export const STORY_RELAY_TRANSITION_DURATIONS = [0, 3, 5, 10] as const;
export const STORY_RELAY_GALLERY_DURATIONS = [10, 15, 20, 30, null] as const;
export const STORY_RELAY_PHASES = [
  'lobby',
  'answering',
  'settling',
  'transition',
  'gallery',
  'ended',
  'aborted',
] as const;

export interface StoryRelayConfig {
  readonly numberOfPlayers: number;
  readonly writingDurationSeconds: (typeof STORY_RELAY_WRITING_DURATIONS)[number];
  readonly transitionDurationSeconds: (typeof STORY_RELAY_TRANSITION_DURATIONS)[number];
  readonly galleryItemDurationSeconds: (typeof STORY_RELAY_GALLERY_DURATIONS)[number];
}

export const DEFAULT_STORY_RELAY_CONFIG: StoryRelayConfig = {
  numberOfPlayers: 6,
  writingDurationSeconds: 90,
  transitionDurationSeconds: 3,
  galleryItemDurationSeconds: null,
};

export interface StoryRelayHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export type StoryRelayEntry = {
  readonly id: string;
  readonly authorSeat: number;
  readonly submittedAt: number;
} & ({ readonly kind: 'text'; readonly text: string } | { readonly kind: 'empty' });

export interface StoryRelayChain {
  readonly id: string;
  readonly originSeat: number;
  readonly entries: readonly StoryRelayEntry[];
}

export interface StoryRelayGallery {
  readonly position: number;
  readonly revealedPosition: number;
  readonly isPlaying: boolean;
  readonly remainingMs: number | null;
}

export interface StoryRelayState extends BaseGameState<typeof STORY_RELAY_GAME_TYPE> {
  readonly phase: (typeof STORY_RELAY_PHASES)[number];
  readonly phaseRevision: number;
  readonly config: StoryRelayConfig;
  readonly roster: RosterMap<StoryRelayHumanSeat>;
  readonly roundNumber: number;
  readonly roundId: string | null;
  readonly startedAt: number | null;
  readonly participants: readonly {
    readonly seat: number;
    readonly displayName: string;
    readonly userId: string | null;
  }[];
  readonly seatOrder: readonly number[];
  readonly stepOffsets: readonly number[];
  readonly stepIndex: number;
  readonly deadlineAt: number | null;
  readonly readySeats: readonly number[];
  readonly chains: readonly StoryRelayChain[];
  readonly gallery: StoryRelayGallery | null;
  readonly completedAt: number | null;
  readonly abortedAt: number | null;
}

export interface StoryRelayTask {
  readonly roundId: string;
  readonly stepIndex: number;
  readonly chainId: string;
  readonly authorSeat: number;
  readonly previousEntry:
    | { readonly kind: 'text'; readonly text: string }
    | { readonly kind: 'empty' }
    | null;
  readonly isSubmitted: boolean;
}

/** Checks supported lobby settings without replacing invalid values. */
export function isValidStoryRelayConfig(config: StoryRelayConfig): boolean {
  return (
    Number.isSafeInteger(config.numberOfPlayers) &&
    config.numberOfPlayers >= STORY_RELAY_MIN_PLAYERS &&
    config.numberOfPlayers <= STORY_RELAY_MAX_PLAYERS &&
    STORY_RELAY_WRITING_DURATIONS.includes(config.writingDurationSeconds) &&
    STORY_RELAY_TRANSITION_DURATIONS.includes(config.transitionDurationSeconds) &&
    STORY_RELAY_GALLERY_DURATIONS.includes(config.galleryItemDurationSeconds)
  );
}

/** Counts occupied seats (humans and bots). */
export function getStoryRelayOccupiedSeatCount(state: StoryRelayState): number {
  return countOccupiedSeats(state.roster);
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getStoryRelayUserSeat(state: StoryRelayState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}
