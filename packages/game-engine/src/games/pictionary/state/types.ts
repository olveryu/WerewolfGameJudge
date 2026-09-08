/** Authoritative compact state for Pictionary relay rooms. */

import type { PictionaryGameType } from '../../../platform/protocol/gameTypes';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { SeatOccupant } from '../../../platform/room/seating';

export const PICTIONARY_MIN_PLAYERS = 4;
export const PICTIONARY_DEFAULT_PLAYERS = 6;
export const PICTIONARY_MAX_PLAYERS = 20;
export const PICTIONARY_TEXT_MAX_LENGTH = 80;
export const PICTIONARY_UPLOAD_GRACE_SECONDS = 15;
export const PICTIONARY_DRAWING_WIDTH = 1024;
export const PICTIONARY_DRAWING_HEIGHT = 768;
export const PICTIONARY_DRAWING_MAX_BYTES = 2 * 1024 * 1024;

export const PICTIONARY_DRAWING_DURATIONS = [60, 90, 120, 180, 300, null] as const;
export const PICTIONARY_GUESS_DURATIONS = [15, 30, 45, 60, null] as const;
export const PICTIONARY_TRANSITION_DURATIONS = [0, 3, 5, 10, 15] as const;
export const PICTIONARY_GALLERY_ITEM_DURATIONS = [3, 5, 8, 10, null] as const;

export type PictionaryDrawingDuration = (typeof PICTIONARY_DRAWING_DURATIONS)[number];
export type PictionaryGuessDuration = (typeof PICTIONARY_GUESS_DURATIONS)[number];
export type PictionaryTransitionDuration = (typeof PICTIONARY_TRANSITION_DURATIONS)[number];
export type PictionaryGalleryItemDuration = (typeof PICTIONARY_GALLERY_ITEM_DURATIONS)[number];
export type PictionaryPhase =
  | 'lobby'
  | 'answering'
  | 'settling'
  | 'transition'
  | 'gallery'
  | 'ended';
export type PictionaryExpectedEntryKind = 'text' | 'drawing';

export interface PictionaryConfig {
  readonly numberOfPlayers: number;
  readonly drawingDurationSeconds: PictionaryDrawingDuration;
  readonly guessDurationSeconds: PictionaryGuessDuration;
  readonly transitionDurationSeconds: PictionaryTransitionDuration;
  readonly galleryItemDurationSeconds: PictionaryGalleryItemDuration;
}

export const DEFAULT_PICTIONARY_CONFIG: PictionaryConfig = {
  numberOfPlayers: PICTIONARY_DEFAULT_PLAYERS,
  drawingDurationSeconds: 120,
  guessDurationSeconds: 15,
  transitionDurationSeconds: 5,
  galleryItemDurationSeconds: 3,
};

export type PictionarySeatProfile = RoomSeatProfile;
export type PictionaryProfileUpdate = RoomProfileUpdate;

export interface PictionaryHumanSeat extends SeatOccupant {
  readonly profile: PictionarySeatProfile;
}

export interface PictionaryMedia {
  readonly objectKey: string;
  readonly contentType: 'image/png';
  readonly width: typeof PICTIONARY_DRAWING_WIDTH;
  readonly height: typeof PICTIONARY_DRAWING_HEIGHT;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface PictionaryTextEntry {
  readonly kind: 'text';
  readonly id: string;
  readonly authorSeat: number;
  readonly text: string;
  readonly submittedAt: number;
}

export interface PictionaryDrawingEntry {
  readonly kind: 'drawing';
  readonly id: string;
  readonly authorSeat: number;
  readonly media: PictionaryMedia;
  readonly submittedAt: number;
}

export interface PictionaryMissedEntry {
  readonly kind: 'missed';
  readonly id: string;
  readonly authorSeat: number;
  readonly expectedKind: PictionaryExpectedEntryKind;
}

export type PictionaryEntry = PictionaryTextEntry | PictionaryDrawingEntry | PictionaryMissedEntry;

export interface PictionaryChain {
  readonly id: string;
  readonly originSeat: number;
  readonly entries: readonly PictionaryEntry[];
}

export interface PictionaryDrawingReservation {
  readonly submissionId: string;
  readonly entryId: string;
  readonly chainId: string;
  readonly authorSeat: number;
  readonly reservedAt: number;
  readonly uploadDeadlineAt: number;
}

export interface PictionaryGalleryState {
  readonly chainIndex: number;
  readonly entryIndex: number;
  readonly isPlaying: boolean;
}

export interface PictionaryState extends BaseGameState<PictionaryGameType> {
  readonly phase: PictionaryPhase;
  readonly phaseRevision: number;
  readonly config: PictionaryConfig;
  readonly realSeats: Readonly<Record<number, PictionaryHumanSeat | undefined>>;
  readonly fillEmptySeatsWithBots: boolean;
  /** Sparse seats where the host explicitly removed an otherwise implicit bot. */
  readonly excludedBotSeats: readonly number[];
  readonly roundNumber: number;
  readonly roundId: string | null;
  readonly seatOrder: readonly number[];
  readonly stepIndex: number;
  readonly deadlineAt: number | null;
  readonly reservations: readonly PictionaryDrawingReservation[];
  readonly chains: readonly PictionaryChain[];
  readonly gallery: PictionaryGalleryState | null;
}

export interface PictionaryTask {
  readonly chainIndex: number;
  readonly chain: PictionaryChain;
  readonly expectedKind: PictionaryExpectedEntryKind;
  readonly previousEntry: PictionaryEntry | null;
}

const PICTIONARY_GRAPHEME_SEGMENTER = new Intl.Segmenter('zh-CN', {
  granularity: 'grapheme',
});
const C0_CONTROL_CHARACTER_END = 0x1f;
const DELETE_CONTROL_CHARACTER = 0x7f;
const C1_CONTROL_CHARACTER_END = 0x9f;

export function isValidPictionaryPlayerCount(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= PICTIONARY_MIN_PLAYERS &&
    value <= PICTIONARY_MAX_PLAYERS
  );
}

export function getPictionaryTextGraphemeCount(value: string): number {
  return Array.from(PICTIONARY_GRAPHEME_SEGMENTER.segment(value)).length;
}

export function hasPictionaryForbiddenControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      throw new Error('[FAIL-FAST] Iterated Pictionary character has no code point');
    }
    if (
      codePoint <= C0_CONTROL_CHARACTER_END ||
      (codePoint >= DELETE_CONTROL_CHARACTER && codePoint <= C1_CONTROL_CHARACTER_END)
    ) {
      return true;
    }
  }
  return false;
}

export function isValidPictionaryText(value: string): boolean {
  const graphemeCount = getPictionaryTextGraphemeCount(value);
  return (
    value.trim() === value &&
    graphemeCount > 0 &&
    graphemeCount <= PICTIONARY_TEXT_MAX_LENGTH &&
    !hasPictionaryForbiddenControlCharacter(value)
  );
}

export function isValidPictionaryConfig(config: PictionaryConfig): boolean {
  return (
    isValidPictionaryPlayerCount(config.numberOfPlayers) &&
    PICTIONARY_DRAWING_DURATIONS.includes(config.drawingDurationSeconds) &&
    PICTIONARY_GUESS_DURATIONS.includes(config.guessDurationSeconds) &&
    PICTIONARY_TRANSITION_DURATIONS.includes(config.transitionDurationSeconds) &&
    PICTIONARY_GALLERY_ITEM_DURATIONS.includes(config.galleryItemDurationSeconds)
  );
}

export function getPictionaryExpectedKind(stepIndex: number): PictionaryExpectedEntryKind {
  return stepIndex % 2 === 0 ? 'text' : 'drawing';
}

export function getPictionaryOccupiedSeatCount(state: PictionaryState): number {
  if (!state.fillEmptySeatsWithBots) return Object.keys(state.realSeats).length;
  const excludedEmptySeatCount = state.excludedBotSeats.reduce(
    (count, seat) => count + (state.realSeats[seat] === undefined ? 1 : 0),
    0,
  );
  return state.config.numberOfPlayers - excludedEmptySeatCount;
}

export function isPictionaryRoomFull(state: PictionaryState): boolean {
  return getPictionaryOccupiedSeatCount(state) === state.config.numberOfPlayers;
}

export function getPictionaryBotUserId(roomCode: string, seat: number): string {
  return `pictionary-bot:${roomCode}:${seat}`;
}

export function getPictionaryBotDisplayName(seat: number): string {
  return `机器人${seat + 1}号`;
}

export function isPictionaryImplicitBotSeat(state: PictionaryState, seat: number): boolean {
  return (
    state.fillEmptySeatsWithBots &&
    Number.isSafeInteger(seat) &&
    seat >= 0 &&
    seat < state.config.numberOfPlayers &&
    state.realSeats[seat] === undefined &&
    !state.excludedBotSeats.includes(seat)
  );
}

export function getPictionaryTaskForSeat(
  state: PictionaryState,
  seat: number,
): PictionaryTask | null {
  if (state.roundId === null || state.stepIndex < 0) return null;
  const seatIndex = state.seatOrder.indexOf(seat);
  if (seatIndex < 0) return null;
  const chainIndex =
    (seatIndex - state.stepIndex + state.config.numberOfPlayers) % state.config.numberOfPlayers;
  const chain = state.chains[chainIndex];
  if (chain === undefined) return null;
  return {
    chainIndex,
    chain,
    expectedKind: getPictionaryExpectedKind(state.stepIndex),
    previousEntry: state.stepIndex === 0 ? null : (chain.entries[state.stepIndex - 1] ?? null),
  };
}
