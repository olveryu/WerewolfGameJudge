/**
 * CFRoomService — Cloudflare Workers room service.
 *
 * Responsibilities:
 * - Implements IRoomService interface
 * - Calls Workers /room/* endpoints via HTTP
 * - Handles roomCode conflict retry on room creation
 *
 * Not responsible for:
 * - Game logic validation
 * - Realtime transport (handled by CFRealtimeService)
 *
 * Boundary constraints:
 * - Semantically compatible with Supabase RoomService behavior
 * - Depends on cfPost for token injection and error interception
 */

import {
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { IRoomService, RoomRecord } from '@/services/types/IRoomService';
import { roomLog } from '@/utils/logger';
import { generateRoomCode } from '@/utils/roomCode';

import { cfPost } from './cfFetch';

/**
 * CFRoomService — operates on room records via Cloudflare Workers API.
 *
 * Responsibilities: create/query/delete rooms (optimistic insert + conflict retry).
 */
export class CFRoomService implements IRoomService {
  readonly #stateCodec: GameStateCodec<GameState>;

  constructor(stateCodec: GameStateCodec<GameState>) {
    this.#stateCodec = stateCodec;
  }

  async createRoom(
    hostUserId: string,
    initialRoomNumber?: string,
    maxRetries: number = 5,
    buildInitialState?: (roomCode: string) => GameState,
  ): Promise<RoomRecord> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const roomCode = attempt === 1 && initialRoomNumber ? initialRoomNumber : generateRoomCode();

      try {
        const data = await cfPost<{
          room: { roomCode: string; hostUserId: string; createdAt: string };
        }>('/room/create', {
          roomCode: roomCode,
          initialState: buildInitialState ? buildInitialState(roomCode) : undefined,
        });

        if (attempt > 1) {
          roomLog.info('Room created after retry', { attempt, roomCode });
        }

        return {
          roomCode: data.room.roomCode,
          hostUserId: data.room.hostUserId,
          createdAt: new Date(data.room.createdAt),
        };
      } catch (err) {
        const errObj = err as { status?: number; reason?: string };
        const isConflict = errObj.status === 409;

        if (isConflict && attempt < maxRetries) {
          roomLog.debug('Room code conflict, retrying', { roomCode, attempt });
          continue;
        }

        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error('Failed to create room after max retries');
  }

  async getRoom(roomCode: string): Promise<RoomRecord | null> {
    const data = await cfPost<{
      room: { roomCode: string; hostUserId: string; createdAt: string } | null;
    }>('/room/get', { roomCode: roomCode });

    if (!data.room) return null;

    return {
      roomCode: data.room.roomCode,
      hostUserId: data.room.hostUserId,
      createdAt: new Date(data.room.createdAt),
    };
  }

  async roomExists(roomCode: string): Promise<boolean> {
    const room = await this.getRoom(roomCode);
    return room !== null;
  }

  async deleteRoom(roomCode: string): Promise<void> {
    roomLog.info('deleteRoom', { roomCode });
    await cfPost('/room/delete', { roomCode: roomCode });
  }

  async getStateRevision(roomCode: string): Promise<number | null> {
    roomLog.debug('getStateRevision', { roomCode });
    const data = await cfPost<{ revision: number | null }>('/room/revision', {
      roomCode,
    });
    return data.revision;
  }

  async getGameState(roomCode: string): Promise<RoomSnapshot<GameState> | null> {
    roomLog.debug('getGameState', { roomCode });
    const data: unknown = await cfPost<unknown>('/room/state', { roomCode });

    if (!isRecord(data) || Object.keys(data).length !== 1 || !('snapshot' in data)) {
      throw new Error('Invalid /room/state response envelope');
    }
    if (data.snapshot === null) return null;

    return parseRoomSnapshot(data.snapshot, this.#stateCodec);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
