/** Cloudflare adapter for game-neutral room directory operations. */

import { type GameType, isGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import {
  parseRoomId,
  parseRoomLocator,
  type RoomLocator,
} from '@game-judge/game-engine/platform/protocol/roomLocator';

import type {
  RoomCreationTransportRequest,
  RoomDirectory,
  RoomRecord,
} from '@/features/room/model/RoomDirectory';
import { UnsupportedRoomGameTypeError } from '@/features/room/model/RoomDirectory';
import { roomLog } from '@/utils/logger';

import { cfPost } from './cfFetch';
import { assertExactRoomResponseKeys, isRoomResponseRecord } from './roomResponseValidation';

function parseCreatedAt(value: unknown): Date {
  if (typeof value !== 'string') throw new Error('Room createdAt must be a string');
  const createdAt = new Date(value);
  if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== value) {
    throw new Error('Room createdAt must be a canonical ISO timestamp');
  }
  return createdAt;
}

function parseRoomRecord(value: unknown, expectedGameType?: GameType): RoomRecord {
  if (!isRoomResponseRecord(value)) throw new Error('Room response must contain an object');
  assertExactRoomResponseKeys(
    value,
    ['roomCode', 'roomId', 'gameType', 'hostUserId', 'createdAt'],
    'Room response',
  );
  const roomCode = parseRoomCode(value.roomCode);
  const roomId = parseRoomId(value.roomId);
  if (typeof value.gameType !== 'string') throw new Error('Room gameType must be a string');
  if (!isGameType(value.gameType)) throw new UnsupportedRoomGameTypeError(value.gameType);
  if (expectedGameType !== undefined && value.gameType !== expectedGameType) {
    throw new Error('Created room gameType does not match its request');
  }
  if (typeof value.hostUserId !== 'string' || value.hostUserId.length === 0) {
    throw new Error('Room hostUserId must be non-empty');
  }
  return {
    roomCode,
    roomId,
    gameType: value.gameType,
    hostUserId: value.hostUserId,
    createdAt: parseCreatedAt(value.createdAt),
  };
}

/** Operates only on room-directory endpoints and exact directory envelopes. */
export class CFRoomDirectoryService implements RoomDirectory {
  async createRoom(request: RoomCreationTransportRequest): Promise<RoomRecord> {
    if (request.expectedHostUserId.length === 0) {
      throw new Error('createRoom.expectedHostUserId must be non-empty');
    }
    if (request.creationId.length === 0 || request.creationId.length > 128) {
      throw new Error('createRoom.creationId must contain 1..128 characters');
    }
    const value: unknown = await cfPost<unknown>('/room/create', {
      gameType: request.gameType,
      config: request.config,
      creationId: request.creationId,
    });
    return this.#parseCreatedRoom(value, request);
  }

  #parseCreatedRoom(value: unknown, request: RoomCreationTransportRequest): RoomRecord {
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/create response envelope');
    assertExactRoomResponseKeys(value, ['room'], '/room/create response');
    const room = parseRoomRecord(value.room, request.gameType);
    if (room.hostUserId !== request.expectedHostUserId) {
      throw new Error('/room/create identity does not match the authenticated request');
    }
    return room;
  }

  async getRoom(roomCode: string): Promise<RoomRecord | null> {
    parseRoomCode(roomCode);
    const value: unknown = await cfPost<unknown>('/room/get', { roomCode });
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/get response envelope');
    assertExactRoomResponseKeys(value, ['room'], '/room/get response');
    if (value.room === null) return null;
    const room = parseRoomRecord(value.room);
    if (room.roomCode !== roomCode) throw new Error('/room/get returned another room code');
    return room;
  }

  async deleteRoom(room: RoomLocator): Promise<void> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    roomLog.info('deleteRoom', locator);
    const value: unknown = await cfPost<unknown>('/room/delete', { ...locator });
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/delete response envelope');
    assertExactRoomResponseKeys(value, ['success', 'pending'], '/room/delete response');
    if (value.success !== true || typeof value.pending !== 'boolean') {
      throw new Error('/room/delete returned an invalid result');
    }
  }
}
