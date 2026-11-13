/** Exhaustive Worker game catalog and game-owned HTTP route projection. */

import { GAME_ENGINE_CATALOG } from '@game-judge/game-engine/games/catalog';
import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { Hono } from 'hono';

import type { AppEnv } from '../env';
import type { RuntimeWorkerGameModule } from '../platform/gameModules/runtimeGameModule';
import {
  defineWorkerGameCatalog,
  registerWorkerGameModule,
} from '../platform/gameModules/workerModule';
import type { WordSubmissionAdapter } from '../platform/wordSupply/submissionAdapter';
import { avalonWorkerModule } from './avalon/module';
import { demoWorkerModule } from './demo/module';
import { drawGuessWorkerModule } from './drawguess/module';
import { drawGuessSubmissionAdapter } from './drawguess/wordSubmissions';
import { cleanupFibWordAudit } from './fibking/maintenance';
import { fibWorkerModule } from './fibking/module';
import { fibSubmissionAdapter } from './fibking/wordSubmissions';
import { pictionaryWorkerModule } from './pictionary/module';
import { storyRelayWorkerModule } from './storyrelay/module';
import { undercoverWorkerModule } from './undercover/module';
import { undercoverSubmissionAdapter } from './undercover/wordSubmissions';
import { aggregateWerewolfCampStats } from './werewolf/campAggregation';
import { werewolfWorkerModule } from './werewolf/module';

/** External editorial adapters are composed only here, never by another concrete game. */
export const WORKER_WORD_SUBMISSION_ADAPTERS = {
  fibking: fibSubmissionAdapter,
  undercover: undercoverSubmissionAdapter,
  drawguess: drawGuessSubmissionAdapter,
} as const satisfies Record<
  import('@game-judge/game-engine/product/wordSupply').GameWordGame,
  WordSubmissionAdapter
>;

/** Owner-local game maintenance composed at the same boundary as game modules. */
export const WORKER_GAME_MAINTENANCE_TASKS = [
  { cron: '0 3 * * *', name: 'Fib audit cleanup', run: cleanupFibWordAudit },
  { cron: '*/5 * * * *', name: 'Werewolf camp aggregation', run: aggregateWerewolfCampStats },
] as const;

export const WORKER_GAME_CATALOG = defineWorkerGameCatalog(GAME_ENGINE_CATALOG, {
  werewolf: registerWorkerGameModule(werewolfWorkerModule),
  avalon: registerWorkerGameModule(avalonWorkerModule),
  drawguess: registerWorkerGameModule(drawGuessWorkerModule),
  fibking: registerWorkerGameModule(fibWorkerModule),
  pictionary: registerWorkerGameModule(pictionaryWorkerModule),
  undercover: registerWorkerGameModule(undercoverWorkerModule),
  storyrelay: registerWorkerGameModule(storyRelayWorkerModule),
  demo: registerWorkerGameModule(demoWorkerModule),
});

export type WorkerGameCatalog = typeof WORKER_GAME_CATALOG;

export interface RegisteredWorkerGameHttpRoute {
  readonly gameType: GameType;
  readonly path: `/api/games/${GameType}/${string}`;
  readonly router: Hono<AppEnv>;
}

function collectWorkerGameHttpRoutes(): readonly RegisteredWorkerGameHttpRoute[] {
  const registrations: RegisteredWorkerGameHttpRoute[] = [];
  const registeredPaths = new Set<string>();

  for (const gameType of GAME_TYPES) {
    const module = WORKER_GAME_CATALOG[gameType];
    for (const route of module.httpRoutes) {
      if (registeredPaths.has(route.path)) {
        throw new Error(`[FAIL-FAST] Duplicate Worker game HTTP route ${route.path}`);
      }
      registeredPaths.add(route.path);
      registrations.push({ gameType, ...route });
    }
  }

  return registrations;
}

export const WORKER_GAME_HTTP_ROUTES = collectWorkerGameHttpRoutes();

export function getWorkerGameModule(gameType: GameType): RuntimeWorkerGameModule {
  return WORKER_GAME_CATALOG[gameType];
}
