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
export const FIB_DEFINITION_FIELD_MIN_LENGTH = 12;
export const FIB_DEFINITION_FIELD_MAX_LENGTH = 100;
export const FIB_WORD_SOURCES = ['gemini', 'workers-ai', 'local'] as const;
export const FIB_PREPARATION_STAGES = {
  queued: 'queued',
  generating: 'generating',
  finalizing: 'finalizing',
} as const;
export const FIB_PREPARATION_FAILURE_CODES = ['timedOut', 'generationFailed'] as const;

export type FibPhase = 'lobby' | 'preparing' | 'preparationFailed' | 'ongoing' | 'ended';
export type FibRole = 'guesser' | 'honest' | 'fibber';
export type FibWordSource = (typeof FIB_WORD_SOURCES)[number];
export type FibPreparationStage =
  (typeof FIB_PREPARATION_STAGES)[keyof typeof FIB_PREPARATION_STAGES];
export type FibPreparationFailureCode = (typeof FIB_PREPARATION_FAILURE_CODES)[number];

const FIB_WORD_PATTERN = /^\p{Script=Han}+$/u;
const FIB_DEFINITION_PATTERN = /^(?=.*\p{Script=Han})[\p{Script=Han}\p{N}\p{P}\p{Zs}]+$/u;

export function isFibWordSource(value: unknown): value is FibWordSource {
  return FIB_WORD_SOURCES.some((source) => source === value);
}

export function isFibPreparationStage(value: unknown): value is FibPreparationStage {
  return Object.values(FIB_PREPARATION_STAGES).some((stage) => stage === value);
}

export function isFibPreparationFailureCode(value: unknown): value is FibPreparationFailureCode {
  return FIB_PREPARATION_FAILURE_CODES.some((failureCode) => failureCode === value);
}

export function isValidFibWord(value: string): boolean {
  return (
    value.trim() === value &&
    value.length >= FIB_WORD_MIN_LENGTH &&
    value.length <= FIB_WORD_MAX_LENGTH &&
    FIB_WORD_PATTERN.test(value)
  );
}

export function isValidFibDefinitionField(value: string): boolean {
  return (
    value.trim() === value &&
    value.length >= FIB_DEFINITION_FIELD_MIN_LENGTH &&
    value.length <= FIB_DEFINITION_FIELD_MAX_LENGTH &&
    FIB_DEFINITION_PATTERN.test(value)
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
  readonly stage: FibPreparationStage;
}

export interface FibPreparationFailure {
  readonly roundId: string;
  readonly requestedAt: number;
  readonly failedAt: number;
  readonly failureCode: FibPreparationFailureCode;
}

export interface FibWordDefinition {
  readonly coreMeaning: string;
  readonly usageNote: string;
}

export interface FibRound {
  readonly roundId: string;
  readonly word: string;
  readonly definition: FibWordDefinition;
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
  readonly preparationFailure: null;
  readonly round: null;
}

export interface FibPreparingState extends FibStateBase {
  readonly phase: 'preparing';
  readonly pendingRound: PendingFibRound;
  readonly preparationFailure: null;
  readonly round: null;
}

export interface FibPreparationFailedState extends FibStateBase {
  readonly phase: 'preparationFailed';
  readonly pendingRound: null;
  readonly preparationFailure: FibPreparationFailure;
  readonly round: null;
}

export interface FibOngoingState extends FibStateBase {
  readonly phase: 'ongoing';
  readonly pendingRound: null;
  readonly preparationFailure: null;
  readonly round: FibRound;
}

export interface FibEndedState extends FibStateBase {
  readonly phase: 'ended';
  readonly pendingRound: null;
  readonly preparationFailure: null;
  readonly round: FibRound;
}

export type FibState =
  | FibLobbyState
  | FibPreparingState
  | FibPreparationFailedState
  | FibOngoingState
  | FibEndedState;

export interface FibConfig {
  readonly numberOfPlayers: number;
}

export function getFibRole(roles: FibRoleAssignment, seat: number): FibRole {
  if (seat === roles.guesserSeat) return 'guesser';
  if (seat === roles.honestSeat) return 'honest';
  return 'fibber';
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
