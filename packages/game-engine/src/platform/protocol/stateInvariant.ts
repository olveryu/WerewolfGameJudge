/**
 * Shared state-invariant helpers for game normalize functions.
 *
 * A normalize function validates authoritative state and fails fast
 * with `Invalid <Game> state: <aspect>` errors. Games whose normalize
 * is an assertion list over that format build their local `invariant`
 * with createStateInvariant and open with assertStateIdentity; games
 * with richer per-field assert styles (fibking, pictionary) and the
 * werewolf reducer-state guard keep their own helpers by design.
 */

import type { GameStateIdentity } from './roomSnapshot';

/** An assertion over authoritative state; failure throws the game's invariant error. */
export type StateInvariant = (condition: boolean, message: string) => asserts condition;

/** Builds an assertion function that fails with the game's invariant error format. */
export function createStateInvariant(label: string): StateInvariant {
  return (condition: boolean, message: string): asserts condition => {
    if (!condition) throw new Error(`Invalid ${label} state: ${message}`);
  };
}

/** The opening check of every normalize: the state carries this game's identity. */
export function assertStateIdentity(
  state: { readonly gameType: string; readonly stateVersion: number },
  identity: GameStateIdentity,
  label: string,
): void {
  if (state.gameType !== identity.gameType || state.stateVersion !== identity.stateVersion) {
    throw new Error(`Invalid ${label} state: identity`);
  }
}
