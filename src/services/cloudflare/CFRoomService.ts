/**
 * CFRoomService — Cloudflare Workers 房间服务
 *
 * 实现 IRoomService 接口，通过 HTTP 调用 Workers /room/* 端点。
 * 与 Supabase RoomService 行为语义兼容。
 * 不校验游戏逻辑，不涉及 realtime 传输。
 */

import type { GameStatePayload } from '@werewolf/game-engine/protocol/types';

import type { IRoomService, RoomRecord } from '@/services/types/IRoomService';
import { roomLog } from '@/utils/logger';
import { generateRoomCode } from '@/utils/roomCode';

import { cfPost } from './cfFetch';

export class CFRoomService implements IRoomService {
  async createRoom(
    hostUserId: string,
    initialRoomNumber?: string,
    maxRetries: number = 5,
    buildInitialState?: (roomCode: string) => GameStatePayload,
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

  async getGameState(
    roomCode: string,
  ): Promise<{ state: GameStatePayload; revision: number } | null> {
    roomLog.debug('getGameState', { roomCode });
    const data = await cfPost<{
      state: GameStatePayload | null;
      revision?: number;
    }>('/room/state', { roomCode });

    if (!data.state) return null;

    return {
      state: data.state,
      revision: data.revision ?? 0,
    };
  }
}
