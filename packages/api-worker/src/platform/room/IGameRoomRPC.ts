/** Minimal game-agnostic RPC contract exposed by the room Durable Object. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import type {
  DeleteRoomResult,
  DispatchRoomResult,
  DispatchUserRoomCommand,
  InitializeRoomCommand,
  InitializeRoomResult,
} from './types';

export interface IGameRoomRPC {
  initializeRoom(command: InitializeRoomCommand): Promise<InitializeRoomResult>;
  dispatchUserCommand(command: DispatchUserRoomCommand): Promise<DispatchRoomResult>;
  getSnapshot(): Promise<RoomSnapshot<BaseGameState<GameType>> | null>;
  getRevision(): Promise<number | null>;
  deleteRoom(actorUserId: string): Promise<DeleteRoomResult>;
}
