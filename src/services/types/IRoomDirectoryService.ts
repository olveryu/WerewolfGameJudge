/** Game-neutral room directory contracts used before a game module is selected. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { RoomLocator } from '@werewolf/game-engine/platform/protocol/roomLocator';

export interface RoomIdentity extends RoomLocator {
  readonly gameType: GameType;
  readonly hostUserId: string;
}

/** Active room metadata resolved before selecting a game UI module. */
export interface RoomRecord extends RoomIdentity {
  readonly createdAt: Date;
}

export interface CreateRoomRequest {
  readonly expectedHostUserId: string;
  readonly gameType: GameType;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface CreatedRoom extends RoomRecord {
  readonly creationId: string;
}

export interface IRoomDirectoryService {
  createRoom(request: CreateRoomRequest): Promise<CreatedRoom>;
  acknowledgeRoomCreation(creationId: string): void;
  getRoom(roomCode: string): Promise<RoomRecord | null>;
  deleteRoom(room: RoomLocator): Promise<void>;
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
