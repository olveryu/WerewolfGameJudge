/** E2E Durable Object composition with deterministic recoverable Fib effects and socket injection. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { getWorkerGameModule } from '../games/catalog';
import type { RuntimeWorkerGameModule } from '../platform/gameModules/runtimeGameModule';
import { GameRoomRuntime } from '../platform/room/GameRoomRuntime';
import { e2eFibWorkerModule } from './fibRecoveryModule';

/** DO-internal path the E2E Worker uses to drop every room socket (deploy / edge restart simulation). */
export const E2E_CLOSE_SOCKETS_PATH = '/e2e/close-sockets';

export class GameRoom extends GameRoomRuntime {
  protected resolveGameModule(gameType: GameType): RuntimeWorkerGameModule {
    return gameType === 'fibking' ? e2eFibWorkerModule : getWorkerGameModule(gameType);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== E2E_CLOSE_SOCKETS_PATH) return super.fetch(request);
    const code = Number(url.searchParams.get('code'));
    const reason = url.searchParams.get('reason');
    if (!Number.isInteger(code) || reason === null || reason.length === 0) {
      return new Response('code and reason required', { status: 400 });
    }
    const sockets = this.ctx.getWebSockets();
    for (const socket of sockets) socket.close(code, reason);
    return Response.json({ closed: sockets.length });
  }
}
