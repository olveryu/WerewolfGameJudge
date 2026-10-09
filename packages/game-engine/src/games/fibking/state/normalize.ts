/** Fail-fast FibKing state invariant enforcement. */

import { FIBKING_GAME_TYPE } from '../../../platform/protocol/gameTypes';
import { isBotOccupant } from '../../../platform/room/seating';
import {
  FIB_MAX_PLAYERS,
  FIB_MIN_PLAYERS,
  FIB_USED_WORD_LIMIT,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibState,
  isFibPreparationFailureCode,
  isFibPreparationStage,
  isFibRoomFull,
  isValidFibDefinitionField,
  isValidFibPlayerCount,
  isValidFibWord,
} from './types';
import { FIB_STATE_VERSION } from './version';

function assertNonEmpty(value: string, label: string): void {
  if (value.length === 0) throw new Error(`${label} must be non-empty`);
}

function assertCanonicalLength(
  value: string,
  minLength: number,
  maxLength: number,
  label: string,
): void {
  if (value.trim() !== value || value.length < minLength || value.length > maxLength) {
    throw new Error(`${label} must be trimmed and contain ${minLength}-${maxLength} characters`);
  }
}

function assertSeatInRange(seat: number, numberOfPlayers: number, label: string): void {
  if (!Number.isSafeInteger(seat) || seat < 0 || seat >= numberOfPlayers) {
    throw new Error(`${label} must be within the configured Fib seat range`);
  }
}

function assertRoster(state: FibState): void {
  const userIds = new Set<string>();
  for (const [rawSeat, occupant] of Object.entries(state.roster)) {
    const seat = Number(rawSeat);
    if (String(seat) !== rawSeat) {
      throw new Error(`Fib roster-seat key ${rawSeat} is not canonical`);
    }
    assertSeatInRange(seat, state.numberOfPlayers, `Fib roster seat ${rawSeat}`);
    if (occupant == null) {
      throw new Error(`Fib roster seat ${seat} cannot store undefined`);
    }
    if (occupant.seat !== seat) {
      throw new Error(`Fib roster seat ${seat} stores mismatched seat ${occupant.seat}`);
    }
    if (isBotOccupant(occupant)) continue;
    assertNonEmpty(occupant.userId, `Fib roster seat ${seat} userId`);
    assertNonEmpty(occupant.profile.displayName, `Fib roster seat ${seat} displayName`);
    if (userIds.has(occupant.userId)) {
      throw new Error(`Fib user ${occupant.userId} occupies multiple seats`);
    }
    userIds.add(occupant.userId);
  }
}

function assertUsedWords(state: FibState): void {
  if (state.usedWords.length > FIB_USED_WORD_LIMIT) {
    throw new Error(`Fib usedWords exceeds ${FIB_USED_WORD_LIMIT}`);
  }
  const words = new Set<string>();
  for (const word of state.usedWords) {
    assertCanonicalLength(word, FIB_WORD_MIN_LENGTH, FIB_WORD_MAX_LENGTH, 'Fib used word');
    if (words.has(word)) throw new Error(`Fib usedWords contains duplicate word ${word}`);
    words.add(word);
  }
}

function assertRound(
  state: Exclude<FibState, { readonly phase: 'lobby' | 'preparing' | 'preparationFailed' }>,
): void {
  const { round } = state;
  assertNonEmpty(round.roundId, 'Fib roundId');
  if (!isValidFibWord(round.word)) throw new Error('Fib round word is invalid');
  if (!isValidFibDefinitionField(round.definition.coreMeaning)) {
    throw new Error('Fib round coreMeaning is invalid');
  }
  if (!isValidFibDefinitionField(round.definition.usageNote)) {
    throw new Error('Fib round usageNote is invalid');
  }
  assertSeatInRange(round.roles.guesserSeat, state.numberOfPlayers, 'Fib guesser seat');
  assertSeatInRange(round.roles.honestSeat, state.numberOfPlayers, 'Fib honest seat');
  if (round.roles.guesserSeat === round.roles.honestSeat) {
    throw new Error('Fib guesser and honest seats must differ');
  }
  for (const seat of round.viewedSeats) {
    assertSeatInRange(seat, state.numberOfPlayers, 'Fib viewed seat');
  }
  if (new Set(round.viewedSeats).size !== round.viewedSeats.length) {
    throw new Error('Fib viewed seats must be unique');
  }
  if (!state.usedWords.includes(round.word)) {
    throw new Error('Fib active word must be present in usedWords');
  }
}

export function normalizeFibState(state: FibState): FibState {
  if (state.gameType !== FIBKING_GAME_TYPE) {
    throw new Error(`Fib gameType must be ${FIBKING_GAME_TYPE}`);
  }
  if (state.stateVersion !== FIB_STATE_VERSION) {
    throw new Error(`Unsupported Fib state version ${state.stateVersion}`);
  }
  assertNonEmpty(state.roomCode, 'Fib roomCode');
  assertNonEmpty(state.hostUserId, 'Fib hostUserId');
  if (!isValidFibPlayerCount(state.numberOfPlayers)) {
    throw new Error(
      `Fib numberOfPlayers must be an integer between ${FIB_MIN_PLAYERS} and ${FIB_MAX_PLAYERS}`,
    );
  }
  assertRoster(state);
  assertUsedWords(state);

  switch (state.phase) {
    case 'lobby':
      if (
        state.pendingRound !== null ||
        state.preparationFailure !== null ||
        state.round !== null
      ) {
        throw new Error('Fib lobby cannot carry round state');
      }
      return state;
    case 'preparing':
      assertNonEmpty(state.pendingRound.roundId, 'Fib pending roundId');
      if (!isFibPreparationStage(state.pendingRound.stage)) {
        throw new Error('Fib pending stage must be a valid preparation stage');
      }
      if (
        !Number.isSafeInteger(state.pendingRound.requestedAt) ||
        state.pendingRound.requestedAt < 0
      ) {
        throw new Error('Fib pending requestedAt must be a non-negative safe integer');
      }
      if (state.preparationFailure !== null || state.round !== null)
        throw new Error('Fib preparing state cannot carry a completed round');
      if (!isFibRoomFull(state)) throw new Error('Fib preparing state requires a full room');
      return state;
    case 'preparationFailed':
      assertNonEmpty(state.preparationFailure.roundId, 'Fib failed roundId');
      if (
        !Number.isSafeInteger(state.preparationFailure.requestedAt) ||
        state.preparationFailure.requestedAt < 0 ||
        !Number.isSafeInteger(state.preparationFailure.failedAt) ||
        state.preparationFailure.failedAt < state.preparationFailure.requestedAt
      ) {
        throw new Error('Fib preparation failure timestamps are invalid');
      }
      if (!isFibPreparationFailureCode(state.preparationFailure.failureCode)) {
        throw new Error('Fib preparation failure code is invalid');
      }
      if (state.pendingRound !== null || state.round !== null) {
        throw new Error('Fib preparationFailed state cannot carry active round state');
      }
      if (!isFibRoomFull(state)) {
        throw new Error('Fib preparationFailed state requires a full room');
      }
      return state;
    case 'viewing':
    case 'ongoing':
    case 'ended': {
      const phase = state.phase;
      if (state.pendingRound !== null) {
        throw new Error(`Fib ${phase} state cannot carry a pending round`);
      }
      if (state.preparationFailure !== null) {
        throw new Error(`Fib ${phase} state cannot carry a preparation failure`);
      }
      if (!isFibRoomFull(state)) throw new Error(`Fib ${phase} state requires a full room`);
      assertRound(state);
      return state;
    }
  }
  const exhaustive: never = state;
  return exhaustive;
}
