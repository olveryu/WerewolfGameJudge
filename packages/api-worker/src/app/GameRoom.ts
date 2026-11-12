/** Worker composition root for the concrete multi-game Durable Object. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import * as Sentry from '@sentry/cloudflare';

import type { Env } from '../env';
import { getWorkerGameModule } from '../games/catalog';
import type { RuntimeWorkerGameModule } from '../platform/gameModules/runtimeGameModule';
import { createSentryOptions } from '../platform/observability/sentryOptions';
import { GameRoomRuntime } from '../platform/room/GameRoomRuntime';

class ComposedGameRoom extends GameRoomRuntime {
  protected resolveGameModule(gameType: GameType): RuntimeWorkerGameModule {
    return getWorkerGameModule(gameType);
  }
}

export const GameRoom = Sentry.instrumentDurableObjectWithSentry(
  (env: Env) => createSentryOptions(env),
  ComposedGameRoom,
);

export type GameRoom = InstanceType<typeof GameRoom>;
