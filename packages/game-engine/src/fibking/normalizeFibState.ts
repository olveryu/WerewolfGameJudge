/**
 * normalizeFibState — phase-discriminated completeness guard (fail-fast).
 *
 * Runs after every action batch (in processEngineAction). Two jobs:
 *  1. Assert phase/round invariants: round fields exist iff phase ∈ {Playing, Revealed}.
 *  2. `satisfies Complete<FibState>` so any newly added FibState field that is forgotten
 *     here becomes a compile error (never silently dropped).
 */

import type { FibState } from './types';

/** Local, game-agnostic completeness helper (mirrors werewolf normalize.ts). */
type Complete<T> = Record<keyof T, unknown>;

function phaseCarriesRound(phase: FibState['phase']): boolean {
  return phase === 'Playing' || phase === 'Revealed';
}

export function normalizeFibState(state: FibState): FibState {
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
