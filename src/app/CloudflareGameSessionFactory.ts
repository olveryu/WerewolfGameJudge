/** Production room-session factory bound to Cloudflare realtime and command adapters. */

import { newRequestId } from '@game-judge/game-engine/platform/identifiers';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { RoomCommandRecoveryStore } from '@/features/room/services/RoomCommandRecoveryStore';
import { ActiveRoomSessionOwner } from '@/features/room/session/ActiveRoomSessionOwner';
import type {
  GameSessionDefinition,
  GameSessionFactory,
} from '@/features/room/session/GameSessionFactory';
import { LazyRoomSession } from '@/features/room/session/LazyRoomSession';
import { RoomSession } from '@/features/room/session/RoomSession';
import type { RoomSessionClient } from '@/features/room/session/types';
import { CFRealtimeService } from '@/services/cloudflare/CFRealtimeService';
import type { RealtimeUserEvent } from '@/services/types/IRealtimeTransport';

export class CloudflareGameSessionFactory implements GameSessionFactory {
  readonly #commandRecovery = new RoomCommandRecoveryStore();
  readonly #owner = new ActiveRoomSessionOwner();

  create<
    TState extends BaseGameState<string>,
    TCommand extends object,
    TEvent extends RealtimeUserEvent,
  >(
    definition: GameSessionDefinition<TState, TEvent>,
  ): RoomSessionClient<TState, TCommand, TEvent> {
    return new LazyRoomSession(
      this.#owner,
      (initialEpoch) =>
        new RoomSession<TState, TCommand, TEvent>({
          codec: definition.stateCodec,
          transport: new CFRealtimeService(definition.stateCodec, definition.userEventCodec),
          createCommandId: newRequestId,
          commandRecovery: this.#commandRecovery,
          initialEpoch,
        }),
    );
  }
}
