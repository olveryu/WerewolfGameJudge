/** Production room-session factory bound to Cloudflare state and realtime adapters. */

import { newRequestId } from '@game-judge/game-engine/platform/identifiers';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type {
  GameSessionDefinition,
  GameSessionFactory,
} from '@/features/room/session/GameSessionFactory';
import { RoomSession } from '@/features/room/session/RoomSession';
import type { RoomSessionClient } from '@/features/room/session/types';
import { CFRealtimeService } from '@/services/cloudflare/CFRealtimeService';
import { CFRoomStateService } from '@/services/cloudflare/CFRoomStateService';
import type { RealtimeUserEvent } from '@/services/types/IRealtimeTransport';

export class CloudflareGameSessionFactory implements GameSessionFactory {
  create<
    TState extends BaseGameState<GameType>,
    TCommand extends object,
    TEvent extends RealtimeUserEvent,
  >(
    definition: GameSessionDefinition<TState, TEvent>,
  ): RoomSessionClient<TState, TCommand, TEvent> {
    return new RoomSession<TState, TCommand, TEvent>({
      codec: definition.stateCodec,
      stateService: new CFRoomStateService(definition.stateCodec),
      transport: new CFRealtimeService(definition.stateCodec, definition.userEventCodec),
      createCommandId: newRequestId,
    });
  }
}
