/** Authoritative compact state for FibKing rooms. */

import type { FibKingGameType } from '../../../platform/protocol/gameTypes';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { SeatOccupant } from '../../../platform/room/seating';

export const FIB_MIN_PLAYERS = 4;
export const FIB_DEFAULT_PLAYERS = 8;
export const FIB_USED_WORD_LIMIT = 50;
export const FIB_WORD_MIN_LENGTH = 2;
export const FIB_WORD_MAX_LENGTH = 12;
export const FIB_DEFINITION_MIN_LENGTH = 8;
export const FIB_DEFINITION_MAX_LENGTH = 120;
export const FIB_WORD_SOURCES = ['gemini', 'workers-ai', 'local'] as const;
export const FIB_PREPARATION_PROGRESS = {
  queued: 25,
  generating: 50,
  ready: 75,
  complete: 100,
} as const;

export type FibPhase = 'lobby' | 'preparing' | 'ongoing' | 'ended';
export type FibRole = 'guesser' | 'honest' | 'fibber';
export type FibWordSource = (typeof FIB_WORD_SOURCES)[number];
export type FibPreparingProgressPercent =
  | typeof FIB_PREPARATION_PROGRESS.queued
  | typeof FIB_PREPARATION_PROGRESS.generating
  | typeof FIB_PREPARATION_PROGRESS.ready;

export function isFibWordSource(value: unknown): value is FibWordSource {
  return FIB_WORD_SOURCES.some((source) => source === value);
}

export function isFibPreparingProgressPercent(
  value: unknown,
): value is FibPreparingProgressPercent {
  return (
    value === FIB_PREPARATION_PROGRESS.queued ||
    value === FIB_PREPARATION_PROGRESS.generating ||
    value === FIB_PREPARATION_PROGRESS.ready
  );
}

export function isValidFibPlayerCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= FIB_MIN_PLAYERS;
}

export type FibSeatProfile = RoomSeatProfile;

export type FibProfileUpdate = RoomProfileUpdate;

export interface FibHumanSeat extends SeatOccupant {
  readonly profile: FibSeatProfile;
}

export interface FibRoleAssignment {
  readonly guesserSeat: number;
  readonly honestSeat: number;
}

export interface PendingFibRound {
  readonly roundId: string;
  readonly requestedAt: number;
  readonly progressPercent: FibPreparingProgressPercent;
}

export interface FibRound {
  readonly roundId: string;
  readonly word: string;
  readonly definition: string;
  readonly source: FibWordSource;
  readonly roles: FibRoleAssignment;
}

interface FibStateBase extends BaseGameState<FibKingGameType> {
  readonly numberOfPlayers: number;
  readonly realSeats: Readonly<Record<number, FibHumanSeat | undefined>>;
  readonly fillEmptySeatsWithBots: boolean;
  /** Sparse seats where a host explicitly removed an otherwise implicit bot. */
  readonly excludedBotSeats: readonly number[];
  readonly usedWords: readonly string[];
}

export interface FibLobbyState extends FibStateBase {
  readonly phase: 'lobby';
  readonly pendingRound: null;
  readonly round: null;
}

export interface FibPreparingState extends FibStateBase {
  readonly phase: 'preparing';
  readonly pendingRound: PendingFibRound;
  readonly round: null;
}

export interface FibOngoingState extends FibStateBase {
  readonly phase: 'ongoing';
  readonly pendingRound: null;
  readonly round: FibRound;
}

export interface FibEndedState extends FibStateBase {
  readonly phase: 'ended';
  readonly pendingRound: null;
  readonly round: FibRound;
}

export type FibState = FibLobbyState | FibPreparingState | FibOngoingState | FibEndedState;

export interface FibConfig {
  readonly numberOfPlayers: number;
}

export function getFibRole(roles: FibRoleAssignment, seat: number): FibRole {
  if (seat === roles.guesserSeat) return 'guesser';
  if (seat === roles.honestSeat) return 'honest';
  return 'fibber';
}

export function getFibPreparationProgressPercent(state: FibState): number {
  switch (state.phase) {
    case 'lobby':
      return 0;
    case 'preparing':
      return state.pendingRound.progressPercent;
    case 'ongoing':
    case 'ended':
      return FIB_PREPARATION_PROGRESS.complete;
  }
  const exhaustive: never = state;
  return exhaustive;
}

export function getFibBotUserId(roomCode: string, seat: number): string {
  return `fib-bot:${roomCode}:${seat}`;
}

export function getFibBotDisplayName(seat: number): string {
  return `机器人${seat + 1}号`;
}

export function isFibImplicitBotSeat(state: FibState, seat: number): boolean {
  return (
    state.fillEmptySeatsWithBots &&
    Number.isSafeInteger(seat) &&
    seat >= 0 &&
    seat < state.numberOfPlayers &&
    state.realSeats[seat] === undefined &&
    !state.excludedBotSeats.includes(seat)
  );
}

export function getFibOccupiedSeatCount(state: FibState): number {
  if (!state.fillEmptySeatsWithBots) return Object.keys(state.realSeats).length;
  const excludedEmptySeatCount = state.excludedBotSeats.reduce(
    (count, seat) => count + (state.realSeats[seat] === undefined ? 1 : 0),
    0,
  );
  return state.numberOfPlayers - excludedEmptySeatCount;
}

export function isFibRoomFull(state: FibState): boolean {
  return getFibOccupiedSeatCount(state) === state.numberOfPlayers;
}
