/**
 * normalizeFibState — phase-discriminated completeness guard (fail-fast).
 *
 * Runs after every action batch (in processEngineAction). Two jobs:
 *  1. Assert phase/round invariants: round fields exist iff phase ∈ {Playing, Revealed}.
 *  2. `satisfies Complete<FibState>` so any newly added FibState field that is forgotten
 *     here becomes a compile error (never silently dropped).
 */

import type { FibState } from './types';
import { FIB_GAME_TYPE, FIB_MIN_PLAYERS } from './types';

/** Local, game-agnostic completeness helper (mirrors werewolf normalize.ts). */
type Complete<T> = Record<keyof T, unknown>;

function phaseCarriesRound(phase: FibState['phase']): boolean {
  return phase === 'Playing' || phase === 'Revealed';
}

function assertValidSeatIndex(label: string, rawSeat: string, numberOfPlayers: number): number {
  const seat = Number(rawSeat);
  if (!Number.isInteger(seat) || String(seat) !== rawSeat || seat < 0 || seat >= numberOfPlayers) {
    throw new Error(
      `normalizeFibState: ${label} seat '${rawSeat}' outside 0..${numberOfPlayers - 1}`,
    );
  }
  return seat;
}

export function normalizeFibState(state: FibState): FibState {
  if (state.gameType !== FIB_GAME_TYPE) {
    throw new Error(`normalizeFibState: gameType must be '${FIB_GAME_TYPE}'`);
  }
  if (!Number.isInteger(state.numberOfPlayers) || state.numberOfPlayers < FIB_MIN_PLAYERS) {
    throw new Error(`normalizeFibState: numberOfPlayers must be >= ${FIB_MIN_PLAYERS}`);
  }

  for (const [rawSeat, occupant] of Object.entries(state.seats)) {
    const seat = assertValidSeatIndex('occupied', rawSeat, state.numberOfPlayers);
    if (occupant === null || occupant === undefined) {
      throw new Error(`normalizeFibState: occupied seat '${rawSeat}' must not be empty`);
    }
    if (occupant.seat !== seat) {
      throw new Error(`normalizeFibState: occupant seat mismatch at '${rawSeat}'`);
    }
    if (typeof occupant.userId !== 'string' || occupant.userId.length === 0) {
      throw new Error(`normalizeFibState: occupant at '${rawSeat}' requires userId`);
    }
  }

  const hasRoundFields =
    state.word !== undefined ||
    state.definition !== undefined ||
    state.roleBySeat !== undefined ||
    state.wordSource !== undefined;

  if (phaseCarriesRound(state.phase)) {
    if (
      state.word === undefined ||
      state.definition === undefined ||
      state.roleBySeat === undefined ||
      state.wordSource === undefined
    ) {
      throw new Error(
        `normalizeFibState: phase '${state.phase}' requires word/definition/roleBySeat/wordSource`,
      );
    }
    for (const rawSeat of Object.keys(state.roleBySeat)) {
      assertValidSeatIndex('roleBySeat', rawSeat, state.numberOfPlayers);
    }
  } else if (hasRoundFields) {
    throw new Error(`normalizeFibState: phase '${state.phase}' must not carry round fields`);
  }

  return {
    gameType: state.gameType,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    phase: state.phase,
    numberOfPlayers: state.numberOfPlayers,
    seats: state.seats,
    roster: state.roster,
    word: state.word,
    definition: state.definition,
    roleBySeat: state.roleBySeat,
    wordSource: state.wordSource,
    usedWords: state.usedWords,
  } satisfies Complete<FibState>;
}
