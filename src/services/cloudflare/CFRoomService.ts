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

import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { CreateRoomParams, IRoomService, RoomRecord } from '@/services/types/IRoomService';
import { roomLog } from '@/utils/logger';
import { generateRoomCode } from '@/utils/roomCode';

import { cfPost } from './cfFetch';

/**
 * CFRoomService — operates on room records via Cloudflare Workers API.
 *
 * Responsibilities: create/query/delete rooms (optimistic insert + conflict retry).
 */
export class CFRoomService implements IRoomService {
  async createRoom<TConfig = unknown>({
    gameType,
    initialRoomNumber,
    maxRetries,
    config,
  }: CreateRoomParams<TConfig>): Promise<RoomRecord> {
    let lastError: Error | undefined;
    const retryLimit = maxRetries ?? 5;

    for (let attempt = 1; attempt <= retryLimit; attempt++) {
      const roomCode = attempt === 1 && initialRoomNumber ? initialRoomNumber : generateRoomCode();

      try {
        const data = await cfPost<{
          room: { roomCode: string; hostUserId: string; createdAt: string; gameType: string };
        }>('/room/create', {
          roomCode: roomCode,
          gameType,
          config,
        });

        if (attempt > 1) {
          roomLog.info('Room created after retry', { attempt, roomCode });
        }

        return {
          roomCode: data.room.roomCode,
          hostUserId: data.room.hostUserId,
          createdAt: new Date(data.room.createdAt),
          gameType: data.room.gameType,
        };
      } catch (err) {
        const errObj = err as { status?: number; reason?: string };
        const isConflict = errObj.status === 409;

        if (isConflict && attempt < retryLimit) {
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
      room: { roomCode: string; hostUserId: string; createdAt: string; gameType: string } | null;
    }>('/room/get', { roomCode: roomCode });

    if (!data.room) return null;

    return {
      roomCode: data.room.roomCode,
      hostUserId: data.room.hostUserId,
      createdAt: new Date(data.room.createdAt),
      gameType: data.room.gameType,
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

  async getGameState<TState = GameState>(
    roomCode: string,
  ): Promise<{ state: TState; revision: number } | null> {
    roomLog.debug('getGameState', { roomCode });
    const data = await cfPost<{
      state: TState | null;
      revision?: number;
    }>('/room/state', { roomCode });

    if (!data.state) return null;

    return {
      state: data.state,
      revision: data.revision ?? 0,
    };
  }
}
