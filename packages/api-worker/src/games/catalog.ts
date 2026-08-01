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
import { fibWorkerModule } from './fibking/module';
import { werewolfWorkerModule } from './werewolf/module';

export const WORKER_GAME_CATALOG = defineWorkerGameCatalog(GAME_ENGINE_CATALOG, {
  werewolf: registerWorkerGameModule(werewolfWorkerModule),
  fibking: registerWorkerGameModule(fibWorkerModule),
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
