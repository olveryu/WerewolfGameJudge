/** Worker composition root for the concrete multi-game Durable Object. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import * as Sentry from '@sentry/cloudflare';

import type { Env } from '../env';
import { GameRoomRuntime } from '../platform/room/GameRoom';
import type { RuntimeWorkerGameModule } from '../platform/room/runtimeGameModule';
import { getWorkerGameModule } from './catalog';

class ComposedGameRoom extends GameRoomRuntime {
  protected resolveGameModule(gameType: GameType): RuntimeWorkerGameModule {
    return getWorkerGameModule(gameType);
  }
}

export const GameRoom = Sentry.instrumentDurableObjectWithSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.2 : 1.0,
    environment: env.ENVIRONMENT,
  }),
  ComposedGameRoom,
);

export type GameRoom = InstanceType<typeof GameRoom>;
