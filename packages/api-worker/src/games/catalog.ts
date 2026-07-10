/** Exhaustive Worker runtime catalog. */

import { werewolfWorkerModule } from './werewolf/module';
import { defineWorkerGameCatalog } from './workerModule';

export const WORKER_GAME_CATALOG = defineWorkerGameCatalog({
  werewolf: werewolfWorkerModule,
});

export type WorkerGameCatalog = typeof WORKER_GAME_CATALOG;
