/** Exhaustive Worker runtime catalog. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';

import type { RuntimeWorkerGameModule } from '../platform/room/runtimeGameModule';
import { fibWorkerModule } from './fibking/module';
import { werewolfWorkerModule } from './werewolf/module';
import { defineWorkerGameCatalog } from './workerModule';

export const WORKER_GAME_CATALOG = defineWorkerGameCatalog({
  werewolf: werewolfWorkerModule,
  fibking: fibWorkerModule,
});

export type WorkerGameCatalog = typeof WORKER_GAME_CATALOG;

export function getWorkerGameModule(gameType: GameType): RuntimeWorkerGameModule {
  return WORKER_GAME_CATALOG[gameType];
}
