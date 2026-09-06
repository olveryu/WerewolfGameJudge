/** Minimal game-agnostic RPC contract exposed by the room Durable Object. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type {
  AuthorizeRoomDeletionCommand,
  AuthorizeRoomDeletionResult,
  DeleteRoomStorageCommand,
  DeleteRoomStorageResult,
  DispatchInternalRoomCommand,
  DispatchRoomResult,
  DispatchUserRoomCommand,
  InitializeRoomCommand,
  InitializeRoomResult,
  ReadRoomCommand,
} from './types';

export interface IGameRoomRPC {
  initializeRoom(command: InitializeRoomCommand): Promise<InitializeRoomResult>;
  dispatchUserCommand(command: DispatchUserRoomCommand): Promise<DispatchRoomResult>;
  /** @pre Caller authenticated and authorized a game-owned HTTP capability. */
  dispatchInternalCommand(command: DispatchInternalRoomCommand): Promise<DispatchRoomResult>;
  getSnapshot(command: ReadRoomCommand): Promise<RoomSnapshot<BaseGameState<GameType>> | null>;
  authorizeRoomDeletion(
    command: AuthorizeRoomDeletionCommand,
  ): Promise<AuthorizeRoomDeletionResult>;
  /** @pre Failed effects may be discarded only for scheduled stale-room deletion. */
  deleteRoomStorage(command: DeleteRoomStorageCommand): Promise<DeleteRoomStorageResult>;
}
