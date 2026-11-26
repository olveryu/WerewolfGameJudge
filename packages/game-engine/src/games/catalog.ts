/** Exhaustive pure-engine catalog for every registered game type. */

import { defineGameEngineCatalog } from '../platform/engine';
import { avalonEngine } from './avalon/engine';
import { drawGuessEngine } from './drawguess/engine';
import { fibEngine } from './fibking/engine';
import { pictionaryEngine } from './pictionary/engine';
import { secrethitlerEngine } from './secrethitler/engine';
import { spotmatchEngine } from './spotmatch/engine';
import { storyRelayEngine } from './storyrelay/engine';
import { toolboxEngine } from './toolbox/engine';
import { undercoverEngine } from './undercover/engine';
import { werewolfEngine } from './werewolf/engine';

export const GAME_ENGINE_CATALOG = defineGameEngineCatalog({
  werewolf: werewolfEngine,
  avalon: avalonEngine,
  drawguess: drawGuessEngine,
  fibking: fibEngine,
  pictionary: pictionaryEngine,
  undercover: undercoverEngine,
  storyrelay: storyRelayEngine,
  spotmatch: spotmatchEngine,
  secrethitler: secrethitlerEngine,
  toolbox: toolboxEngine,
});

export type GameEngineCatalog = typeof GAME_ENGINE_CATALOG;
