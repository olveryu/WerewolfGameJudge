/** Game-neutral room directory and creation contracts. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { RoomLocator } from '@game-judge/game-engine/platform/protocol/roomLocator';

export interface RoomIdentity<TGameType extends string = GameType> extends RoomLocator {
  readonly gameType: TGameType;
  readonly hostUserId: string;
}

export interface RoomRecord<TGameType extends string = GameType> extends RoomIdentity<TGameType> {
  readonly createdAt: Date;
}

export interface RoomCreationRequest {
  readonly expectedHostUserId: string;
  readonly gameType: GameType;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface RoomCreationTransportRequest extends RoomCreationRequest {
  readonly creationId: string;
}

export interface RoomDirectory {
  createRoom(request: RoomCreationTransportRequest): Promise<RoomRecord>;
  getRoom(roomCode: string): Promise<RoomRecord | null>;
  deleteRoom(room: RoomLocator): Promise<void>;
}

export interface RoomCreator {
  createRoom(request: RoomCreationRequest): Promise<RoomRecord>;
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
