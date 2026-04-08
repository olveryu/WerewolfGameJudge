/**
 * CFRoomService — Cloudflare Workers 房间服务
 *
 * 实现 IRoomService 接口，通过 HTTP 调用 Workers /room/* 端点。
 * 与 Supabase RoomService 行为语义兼容。
 * 不校验游戏逻辑，不涉及 realtime 传输。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { IRoomService, RoomRecord } from '@/services/types/IRoomService';
import { roomLog } from '@/utils/logger';
import { generateRoomCode } from '@/utils/roomCode';

import { cfPost } from './cfFetch';

export class CFRoomService implements IRoomService {
  async createRoom(
    hostUid: string,
    initialRoomNumber?: string,
    maxRetries: number = 5,
    buildInitialState?: (roomCode: string) => GameState,
  ): Promise<RoomRecord> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const roomNumber =
        attempt === 1 && initialRoomNumber ? initialRoomNumber : generateRoomCode();

      try {
        const data = await cfPost<{
          room: { roomNumber: string; hostUid: string; createdAt: string };
        }>('/room/create', {
          roomCode: roomNumber,
          initialState: buildInitialState ? buildInitialState(roomNumber) : undefined,
        });

        if (attempt > 1) {
          roomLog.info(`Room created on attempt ${attempt} with code ${roomNumber}`);
        }

        return {
          roomNumber: data.room.roomNumber,
          hostUid: data.room.hostUid,
          createdAt: new Date(data.room.createdAt),
        };
      } catch (err) {
        const errObj = err as { status?: number; reason?: string };
        const isConflict = errObj.status === 409;

        if (isConflict && attempt < maxRetries) {
          roomLog.debug(`Room code ${roomNumber} already exists (attempt ${attempt}), retrying...`);
          continue;
        }

        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error('Failed to create room after max retries');
  }

  async getRoom(roomNumber: string): Promise<RoomRecord | null> {
    const data = await cfPost<{
      room: { roomNumber: string; hostUid: string; createdAt: string } | null;
    }>('/room/get', { roomCode: roomNumber });

    if (!data.room) return null;

    return {
      roomNumber: data.room.roomNumber,
      hostUid: data.room.hostUid,
      createdAt: new Date(data.room.createdAt),
    };
  }

  async roomExists(roomNumber: string): Promise<boolean> {
    const room = await this.getRoom(roomNumber);
    return room !== null;
  }

  async deleteRoom(roomNumber: string): Promise<void> {
    await cfPost('/room/delete', { roomCode: roomNumber });
  }

  async getStateRevision(roomCode: string): Promise<number | null> {
    const data = await cfPost<{ revision: number | null }>('/room/revision', {
      roomCode,
    });
    return data.revision;
  }

  async getGameState(roomCode: string): Promise<{ state: GameState; revision: number } | null> {
    const data = await cfPost<{
      state: GameState | null;
      revision?: number;
    }>('/room/state', { roomCode });

    if (!data.state) return null;

    return {
      state: data.state,
      revision: data.revision ?? 0,
    };
  }
}
