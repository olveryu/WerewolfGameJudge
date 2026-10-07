/** Exhaustive pure-engine catalog for every registered game type. */

import { defineGameEngineCatalog } from '../platform/engine';
import { avalonEngine } from './avalon/engine';
import { drawGuessEngine } from './drawguess/engine';
import { fibEngine } from './fibking/engine';
import { pictionaryEngine } from './pictionary/engine';
import { storyRelayEngine } from './storyrelay/engine';
import { undercoverEngine } from './undercover/engine';
import { werewolfEngine } from './werewolf/engine';

export const GAME_ENGINE_CATALOG = defineGameEngineCatalog({
  werewolf: werewolfEngine,
  fibking: fibEngine,
  pictionary: pictionaryEngine,
  undercover: undercoverEngine,
  storyrelay: storyRelayEngine,
  drawguess: drawGuessEngine,
  avalon: avalonEngine,
});

export type GameEngineCatalog = typeof GAME_ENGINE_CATALOG;
