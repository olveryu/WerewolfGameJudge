/** E2E Durable Object composition with deterministic recoverable Fib effects. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';

import { getWorkerGameModule } from '../games/catalog';
import { GameRoomRuntime } from '../platform/room/GameRoom';
import type { RuntimeWorkerGameModule } from '../platform/room/runtimeGameModule';
import { e2eFibWorkerModule } from './fibRecoveryModule';

export class GameRoom extends GameRoomRuntime {
  protected resolveGameModule(gameType: GameType): RuntimeWorkerGameModule {
    return gameType === 'fibking' ? e2eFibWorkerModule : getWorkerGameModule(gameType);
  }
}
