/**
 * fibEngine — the fibking GameEngine (Strategy) registered into ENGINE_REGISTRY.
 *
 * Assembles the pure pieces: Factory (createInitialState), Command (dispatch),
 * Strategy (reduce + normalize). Defines no settlement hook → fib can never touch
 * werewolf XP/gacha (structural zero-coupling).
 */

import type { GameEngine } from '../engine/registry/types';
import { FIB_GAME_TYPE } from '../protocol/gameTypes';
import { buildInitialFibState } from './buildInitialFibState';
import { dispatchFib } from './dispatch';
import { normalizeFibState } from './normalizeFibState';
import { fibReducer } from './reducer';
import type { FibAction, FibConfig, FibState } from './types';

export const fibEngine: GameEngine<FibState, FibAction, FibConfig> = {
  gameType: FIB_GAME_TYPE,
  createInitialState: buildInitialFibState,
  dispatch: (state, revision, action) => dispatchFib(state, revision, action),
  reduce: fibReducer,
  normalize: normalizeFibState,
};
