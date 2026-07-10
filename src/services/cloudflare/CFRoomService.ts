/** Cloudflare room directory and authoritative snapshot client. */

import { newRequestId } from '@werewolf/game-engine';
import {
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type {
  CreatedRoom,
  CreateRoomRequest,
  IRoomService,
  RoomRecord,
} from '@/services/types/IRoomService';
import { roomLog } from '@/utils/logger';
import { generateRoomCode } from '@/utils/roomCode';

import { cfPost } from './cfFetch';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => actualKeys.includes(key))
  ) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function isHttpConflict(value: unknown): boolean {
  return isRecord(value) && value.status === 409;
}

function parseCreatedAt(value: unknown): Date {
  if (typeof value !== 'string') throw new Error('Room createdAt must be a string');
  const createdAt = new Date(value);
  if (!Number.isFinite(createdAt.getTime())) throw new Error('Room createdAt is invalid');
  return createdAt;
}

/** Operates on generic room endpoints and validates every response envelope. */
export class CFRoomService implements IRoomService {
  readonly #stateCodec: GameStateCodec<GameState>;

  constructor(stateCodec: GameStateCodec<GameState>) {
    this.#stateCodec = stateCodec;
  }

  async createRoom(request: CreateRoomRequest): Promise<CreatedRoom> {
    const maxAttempts = request.maxAttempts ?? 5;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
      throw new Error('createRoom.maxAttempts must be a positive integer');
    }
    const creationId = newRequestId();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const roomCode =
        attempt === 1 && request.initialRoomCode !== undefined
          ? request.initialRoomCode
          : generateRoomCode();

      try {
        const value: unknown = await cfPost<unknown>('/room/create', {
          roomCode,
          gameType: request.gameType,
          config: request.config,
          creationId,
        });
        const created = this.#parseCreatedRoom(value, request, roomCode);
        if (attempt > 1) {
          roomLog.info('Room created after code conflict', { attempt, roomCode });
        }
        return created;
      } catch (error) {
        if (isHttpConflict(error) && attempt < maxAttempts) {
          roomLog.debug('Room code conflict, retrying', { roomCode, attempt });
          continue;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        break;
      }
    }

    if (lastError === null) {
      throw new Error('createRoom exhausted attempts without recording an error');
    }
    throw lastError;
  }

  #parseCreatedRoom(
    value: unknown,
    request: CreateRoomRequest,
    expectedRoomCode: string,
  ): CreatedRoom {
    if (!isRecord(value)) throw new Error('Invalid /room/create response envelope');
    assertExactKeys(value, ['room', 'snapshot'], '/room/create response');
    if (!isRecord(value.room)) throw new Error('/room/create room must be an object');
    assertExactKeys(
      value.room,
      ['roomCode', 'gameType', 'hostUserId', 'createdAt'],
      '/room/create room',
    );
    if (
      value.room.roomCode !== expectedRoomCode ||
      value.room.gameType !== request.gameType ||
      value.room.hostUserId !== request.expectedHostUserId
    ) {
      throw new Error('/room/create identity does not match the authenticated request');
    }
    const snapshot = parseRoomSnapshot(value.snapshot, this.#stateCodec);
    if (
      snapshot.gameType !== request.gameType ||
      snapshot.state.roomCode !== expectedRoomCode ||
      snapshot.state.hostUserId !== request.expectedHostUserId
    ) {
      throw new Error('/room/create snapshot identity does not match its room');
    }

    return {
      roomCode: expectedRoomCode,
      gameType: request.gameType,
      hostUserId: request.expectedHostUserId,
      createdAt: parseCreatedAt(value.room.createdAt),
      snapshot,
    };
  }

  async getRoom(roomCode: string): Promise<RoomRecord | null> {
    const value: unknown = await cfPost<unknown>('/room/get', { roomCode });
    if (!isRecord(value)) throw new Error('Invalid /room/get response envelope');
    assertExactKeys(value, ['room'], '/room/get response');
    if (value.room === null) return null;
    if (!isRecord(value.room)) throw new Error('/room/get room must be an object');
    assertExactKeys(value.room, ['roomCode', 'hostUserId', 'createdAt'], '/room/get room');
    if (
      value.room.roomCode !== roomCode ||
      typeof value.room.hostUserId !== 'string' ||
      value.room.hostUserId.length === 0
    ) {
      throw new Error('/room/get returned invalid room identity');
    }
    return {
      roomCode,
      hostUserId: value.room.hostUserId,
      createdAt: parseCreatedAt(value.room.createdAt),
    };
  }

  async roomExists(roomCode: string): Promise<boolean> {
    return (await this.getRoom(roomCode)) !== null;
  }

  async deleteRoom(roomCode: string): Promise<void> {
    roomLog.info('deleteRoom', { roomCode });
    await cfPost('/room/delete', { roomCode });
  }

  async getStateRevision(roomCode: string): Promise<number | null> {
    roomLog.debug('getStateRevision', { roomCode });
    const value: unknown = await cfPost<unknown>('/room/revision', { roomCode });
    if (!isRecord(value)) throw new Error('Invalid /room/revision response envelope');
    assertExactKeys(value, ['revision'], '/room/revision response');
    if (
      value.revision !== null &&
      (typeof value.revision !== 'number' ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < 1)
    ) {
      throw new Error('/room/revision returned an invalid revision');
    }
    return value.revision;
  }

  async getGameState(roomCode: string): Promise<RoomSnapshot<GameState> | null> {
    roomLog.debug('getGameState', { roomCode });
    const value: unknown = await cfPost<unknown>('/room/state', { roomCode });
    if (!isRecord(value)) throw new Error('Invalid /room/state response envelope');
    assertExactKeys(value, ['snapshot'], '/room/state response');
    if (value.snapshot === null) return null;
    return parseRoomSnapshot(value.snapshot, this.#stateCodec);
  }
}
