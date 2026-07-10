/** Room directory and authoritative snapshot service contract. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { RoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

/** Room directory record consumed by the current Werewolf room flow. */
export interface RoomRecord {
  roomCode: string;
  hostUserId: string;
  createdAt: Date;
}

export interface CreateRoomRequest {
  readonly expectedHostUserId: string;
  readonly gameType: GameType;
  readonly config: Readonly<Record<string, unknown>>;
  readonly initialRoomCode?: string;
  readonly maxAttempts?: number;
}

export interface CreatedRoom extends RoomRecord {
  readonly gameType: GameType;
  readonly snapshot: RoomSnapshot<GameState>;
}

/** Room directory CRUD plus authoritative state reads. */
export interface IRoomService {
  createRoom(request: CreateRoomRequest): Promise<CreatedRoom>;
  getRoom(roomCode: string): Promise<RoomRecord | null>;
  roomExists(roomCode: string): Promise<boolean>;
  deleteRoom(roomCode: string): Promise<void>;
  getStateRevision(roomCode: string): Promise<number | null>;
  getGameState(roomCode: string): Promise<RoomSnapshot<GameState> | null>;
}
