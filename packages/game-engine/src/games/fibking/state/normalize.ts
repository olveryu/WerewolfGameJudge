/** Fail-fast FibKing state invariant enforcement. */

import { FIBKING_GAME_TYPE } from '../../../platform/protocol/gameTypes';
import {
  FIB_DEFINITION_MAX_LENGTH,
  FIB_DEFINITION_MIN_LENGTH,
  FIB_MIN_PLAYERS,
  FIB_USED_WORD_LIMIT,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibState,
  isFibRoomFull,
  isValidFibPlayerCount,
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

function assertRealSeats(state: FibState): void {
  const userIds = new Set<string>();
  for (const [rawSeat, occupant] of Object.entries(state.realSeats)) {
    const seat = Number(rawSeat);
    if (String(seat) !== rawSeat) {
      throw new Error(`Fib real-seat key ${rawSeat} is not canonical`);
    }
    assertSeatInRange(seat, state.numberOfPlayers, `Fib real seat ${rawSeat}`);
    if (occupant === undefined) {
      throw new Error(`Fib real seat ${seat} cannot store undefined`);
    }
    if (occupant.seat !== seat) {
      throw new Error(`Fib real seat ${seat} stores mismatched seat ${occupant.seat}`);
    }
    assertNonEmpty(occupant.userId, `Fib real seat ${seat} userId`);
    assertNonEmpty(occupant.profile.displayName, `Fib real seat ${seat} displayName`);
    if (userIds.has(occupant.userId)) {
      throw new Error(`Fib user ${occupant.userId} occupies multiple seats`);
    }
    userIds.add(occupant.userId);
  }
}

function assertExcludedBotSeats(state: FibState): void {
  if (!state.fillEmptySeatsWithBots && state.excludedBotSeats.length > 0) {
    throw new Error('Fib excludedBotSeats requires bot fill to be enabled');
  }
  let previousSeat = -1;
  for (const seat of state.excludedBotSeats) {
    assertSeatInRange(seat, state.numberOfPlayers, `Fib excluded bot seat ${seat}`);
    if (seat <= previousSeat) {
      throw new Error('Fib excludedBotSeats must be unique and strictly ascending');
    }
    previousSeat = seat;
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

function assertRound(state: Exclude<FibState, { readonly phase: 'lobby' | 'preparing' }>): void {
  const { round } = state;
  assertNonEmpty(round.roundId, 'Fib roundId');
  assertCanonicalLength(round.word, FIB_WORD_MIN_LENGTH, FIB_WORD_MAX_LENGTH, 'Fib round word');
  assertCanonicalLength(
    round.definition,
    FIB_DEFINITION_MIN_LENGTH,
    FIB_DEFINITION_MAX_LENGTH,
    'Fib round definition',
  );
  assertSeatInRange(round.roles.guesserSeat, state.numberOfPlayers, 'Fib guesser seat');
  assertSeatInRange(round.roles.honestSeat, state.numberOfPlayers, 'Fib honest seat');
  if (round.roles.guesserSeat === round.roles.honestSeat) {
    throw new Error('Fib guesser and honest seats must differ');
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
    throw new Error(`Fib numberOfPlayers must be a safe integer >= ${FIB_MIN_PLAYERS}`);
  }
  assertRealSeats(state);
  assertExcludedBotSeats(state);
  assertUsedWords(state);

  switch (state.phase) {
    case 'lobby':
      if (state.pendingRound !== null || state.round !== null) {
        throw new Error('Fib lobby cannot carry round state');
      }
      return state;
    case 'preparing':
      assertNonEmpty(state.pendingRound.roundId, 'Fib pending roundId');
      if (
        !Number.isSafeInteger(state.pendingRound.requestedAt) ||
        state.pendingRound.requestedAt < 0
      ) {
        throw new Error('Fib pending requestedAt must be a non-negative safe integer');
      }
      if (state.round !== null)
        throw new Error('Fib preparing state cannot carry a completed round');
      if (!isFibRoomFull(state)) throw new Error('Fib preparing state requires a full room');
      return state;
    case 'ongoing':
    case 'ended': {
      const phase = state.phase;
      if (state.pendingRound !== null) {
        throw new Error(`Fib ${phase} state cannot carry a pending round`);
      }
      if (!isFibRoomFull(state)) throw new Error(`Fib ${phase} state requires a full room`);
      assertRound(state);
      return state;
    }
  }
  const exhaustive: never = state;
  return exhaustive;
}
