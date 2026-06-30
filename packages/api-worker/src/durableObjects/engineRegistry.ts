/**
 * ENGINE_REGISTRY — the Registry that maps gameType → GameEngine (Strategy selection).
 *
 * Adding a new game is one line here. The DO and processEngineAction never change.
 */

import type { GameEngine } from '@werewolf/game-engine/engine/registry/types';
import { fibEngine } from '@werewolf/game-engine/fibking/engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry holds heterogeneous engines; selection narrows per gameType
export const ENGINE_REGISTRY: Record<string, GameEngine<any, any, any>> = {
  [fibEngine.gameType]: fibEngine,
  // pictionary: drawEngine,   // ★ a future game registers here; DO stays unchanged
};
