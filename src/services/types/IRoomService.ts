/** Room directory and authoritative snapshot service contract. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { RoomLocator } from '@werewolf/game-engine/platform/protocol/roomLocator';
import type { RoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

export interface RoomIdentity extends RoomLocator {
  gameType: GameType;
  hostUserId: string;
}

/** Active room metadata resolved before selecting a game UI module. */
export interface RoomRecord extends RoomIdentity {
  createdAt: Date;
}

export interface CreateRoomRequest {
  readonly expectedHostUserId: string;
  readonly gameType: GameType;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface CreatedRoom extends RoomRecord {
  readonly creationId: string;
  readonly snapshot: RoomSnapshot<GameState>;
}

/** Room directory CRUD plus authoritative state reads. */
export interface IRoomService {
  createRoom(request: CreateRoomRequest): Promise<CreatedRoom>;
  acknowledgeRoomCreation(creationId: string): void;
  getRoom(roomCode: string): Promise<RoomRecord | null>;
  deleteRoom(room: RoomLocator): Promise<void>;
  getStateRevision(room: RoomLocator): Promise<number | null>;
  getGameState(room: RoomLocator): Promise<RoomSnapshot<GameState> | null>;
}

/** A newer server game ID that this client cannot render. */
export class UnsupportedRoomGameTypeError extends Error {
  readonly gameType: string;

  constructor(gameType: string) {
    super(`Unsupported room game type: ${gameType}`);
    this.name = 'UnsupportedRoomGameTypeError';
    this.gameType = gameType;
  }
}
