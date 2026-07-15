/** Typed authoritative snapshot reads owned by one active game session. */

import type { RoomLocator } from '@game-judge/game-engine/platform/protocol/roomLocator';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

export interface IRoomStateService<TState extends BaseGameState<string>> {
  getStateRevision(room: RoomLocator): Promise<number | null>;
  getGameState(room: RoomLocator): Promise<RoomSnapshot<TState> | null>;
}
