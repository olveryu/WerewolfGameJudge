/**
 * ENGINE_REGISTRY — the Registry that maps gameType → GameEngine (Strategy selection).
 *
 * Registering a game engine happens here. New games still add their create config
 * and HTTP route boundary; the DO and processEngineAction stay unchanged.
 */

import type { GameEngine } from '@werewolf/game-engine/engine/registry/types';
import { fibEngine } from '@werewolf/game-engine/fibking/engine';
import { werewolfEngine } from '@werewolf/game-engine/werewolf/engine';

export type RegisteredGameEngine = GameEngine<unknown, unknown, unknown>;

const ENGINE_REGISTRY: Record<string, RegisteredGameEngine> = {
  [werewolfEngine.gameType]: werewolfEngine,
  [fibEngine.gameType]: fibEngine,
  // pictionary: drawEngine,   // future games register their engine here
};

export function getRegisteredEngine(gameType: string): RegisteredGameEngine | undefined {
  return ENGINE_REGISTRY[gameType];
}
