/** Typed factory contract for creating the single shared room-session implementation. */

import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomSessionClient } from './types';

export interface GameSessionDefinition<TState extends BaseGameState<string>> {
  readonly stateCodec: GameStateCodec<TState>;
}

export interface GameSessionFactory {
  create<TState extends BaseGameState<string>, TCommand extends object>(
    definition: GameSessionDefinition<TState>,
  ): RoomSessionClient<TState, TCommand>;
}
