/** Typed factory contract for creating the single shared room-session implementation. */

import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type {
  RealtimeUserEvent,
  RealtimeUserEventCodec,
} from '@/services/types/IRealtimeTransport';

import type { RoomSessionClient } from './types';

export interface GameSessionDefinition<
  TState extends BaseGameState<string>,
  TEvent extends RealtimeUserEvent,
> {
  readonly stateCodec: GameStateCodec<TState>;
  readonly userEventCodec: RealtimeUserEventCodec<TEvent>;
}

export interface GameSessionFactory {
  create<
    TState extends BaseGameState<string>,
    TCommand extends object,
    TEvent extends RealtimeUserEvent,
  >(
    definition: GameSessionDefinition<TState, TEvent>,
  ): RoomSessionClient<TState, TCommand, TEvent>;
}
