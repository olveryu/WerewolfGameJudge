/**
 * ENGINE_REGISTRY — the Registry that maps gameType → GameEngine (Strategy selection).
 *
 * Adding a new game is one line here. The DO and processEngineAction never change.
 */

import type { GameEngine } from '@werewolf/game-engine/engine/registry/types';
import { fibEngine } from '@werewolf/game-engine/fibking/engine';

export type RegisteredGameEngine = GameEngine<unknown, unknown, unknown>;

const ENGINE_REGISTRY: Record<string, RegisteredGameEngine> = {
  [fibEngine.gameType]: fibEngine,
  // pictionary: drawEngine,   // ★ a future game registers here; DO stays unchanged
};

export function getRegisteredEngine(gameType: string): RegisteredGameEngine | undefined {
  return ENGINE_REGISTRY[gameType];
}
