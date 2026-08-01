/** Exhaustive pure-engine catalog for every registered game type. */

import { defineGameEngineCatalog } from '../platform/engine';
import { fibEngine } from './fibking/engine';
import { werewolfEngine } from './werewolf/engine';

export const GAME_ENGINE_CATALOG = defineGameEngineCatalog({
  werewolf: werewolfEngine,
  fibking: fibEngine,
});

export type GameEngineCatalog = typeof GAME_ENGINE_CATALOG;
