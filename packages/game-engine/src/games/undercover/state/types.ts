/** Undercover state contracts; authoritative data only, no UI or IO. */

import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { IdentityViewingParticipant } from '../../../platform/room/identityViewing';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import {
  countOccupiedSeats,
  findRosterSeatByUserId,
  getBotSeats,
  isBotSeat,
  type RosterMap,
  type SeatOccupant,
} from '../../../platform/room/seating';
import type { UndercoverRole } from '../domain/rules';

export const UNDERCOVER_STATE_VERSION = 4;
export const UNDERCOVER_CATEGORIES = [
  'food',
  'dailyLife',
  'school',
  'work',
  'relationships',
  'actions',
  'entertainment',
  'sportsAndGames',
  'travel',
  'nature',
] as const;
export type UndercoverCategory = (typeof UNDERCOVER_CATEGORIES)[number];

export interface UndercoverConfig {
  readonly numberOfPlayers: number;
  readonly hasBlank: boolean;
  readonly category: UndercoverCategory | 'all';
}

export interface UndercoverHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export interface UndercoverWordPair {
  readonly id: string;
  readonly wordA: string;
  readonly wordB: string;
  readonly category: UndercoverCategory;
}

export interface UndercoverPendingRound {
  readonly roundId: string;
  readonly requestedAt: number;
  readonly shouldAllowRepeated: boolean;
}

export interface UndercoverRevelation {
  readonly seat: number;
  readonly role: UndercoverRole;
  readonly revealedAt: number;
}

export interface UndercoverRound {
  readonly roundId: string;
  readonly wordPair: UndercoverWordPair;
  readonly civilianWord: string;
  readonly undercoverWord: string;
  readonly roles: readonly UndercoverRole[];
  readonly speakingStartSeat: number;
  readonly confirmedSeats: readonly number[];
  readonly revelations: readonly UndercoverRevelation[];
}

export type UndercoverPreparationFailure =
  | 'selectionFailed'
  | 'inventoryEmpty'
  | 'inventoryExhausted';

interface UndercoverStateBase extends BaseGameState<'undercover'> {
  readonly config: UndercoverConfig;
  readonly roster: RosterMap<UndercoverHumanSeat>;
  readonly usedWordPairIds: readonly string[];
}

export type UndercoverState = UndercoverStateBase &
  (
    | { readonly phase: 'lobby'; readonly round: null }
    | {
        readonly phase: 'preparing';
        readonly round: null;
        readonly pendingRound: UndercoverPendingRound;
      }
    | {
        readonly phase: 'preparationFailed';
        readonly round: null;
        readonly pendingRound: UndercoverPendingRound;
        readonly failureCode: UndercoverPreparationFailure;
      }
    | { readonly phase: 'reading' | 'ongoing'; readonly round: UndercoverRound }
    | { readonly phase: 'ended'; readonly round: UndercoverRound; readonly winner: UndercoverRole }
    | { readonly phase: 'aborted'; readonly round: UndercoverRound | null }
  );

/** Returns whether an index is a seat in this room. */
export function isUndercoverSeat(state: UndercoverState, seat: number): boolean {
  return Number.isSafeInteger(seat) && seat >= 0 && seat < state.config.numberOfPlayers;
}

/** Returns the number of occupied seats (humans and bots). */
export function getUndercoverOccupiedSeatCount(state: UndercoverState): number {
  return countOccupiedSeats(state.roster);
}

/** Returns the seats held by bots, ascending. */
export function getUndercoverBotSeats(state: UndercoverState): readonly number[] {
  return getBotSeats(state.roster);
}

/** Returns whether a seat is held by a bot. */
export function isUndercoverBotSeat(state: UndercoverState, seat: number): boolean {
  return isBotSeat(state.roster, seat);
}

/** Identity Viewing Protocol participants: every occupied seat with its bot flag. */
export function getUndercoverViewingParticipants(
  state: UndercoverState,
): readonly IdentityViewingParticipant[] {
  const participants: IdentityViewingParticipant[] = [];
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (state.roster[seat] == null) continue;
    participants.push({ seat, isBot: isBotSeat(state.roster, seat) });
  }
  return participants;
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getUndercoverUserSeat(state: UndercoverState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}
