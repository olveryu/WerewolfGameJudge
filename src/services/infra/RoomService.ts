/**
 * RoomService - Supabase 房间记录 + 游戏状态持久化服务
 *
 * 创建/查询/删除 Supabase rooms 表记录，生成唯一 4 位房间号，
 * 持久化 game_state snapshot（供 Player 通过 postgres_changes 或 SELECT 恢复）。
 * 不校验游戏逻辑（游戏逻辑由 Host 内存 GameStore 管理）。
 *
 * Supabase rooms table schema:
 * - id: uuid (primary key)
 * - code: text (unique, 4-digit room code)
 * - host_id: text
 * - game_state: jsonb (BroadcastGameState snapshot)
 * - state_revision: integer (monotonic revision counter)
 * - created_at: timestamptz
 * - updated_at: timestamptz
 */

import * as Sentry from '@sentry/react-native';
import type { BroadcastGameState } from '@werewolf/game-engine/protocol/types';

import { isSupabaseConfigured, supabase } from '@/config/supabase';
import { roomLog } from '@/utils/logger';
import { generateRoomCode } from '@/utils/roomCode';

// Minimal room record stored in Supabase
export interface RoomRecord {
  roomNumber: string;
  hostUid: string;
  createdAt: Date;
}

// Database row format
interface DbRoomRecord {
  id: string;
  code: string;
  host_id: string;
  created_at: string;
  updated_at: string;
}

export class RoomService {
  constructor() {}

  private isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('服务未配置，请检查网络连接');
    }
  }

  /**
   * Create a new room record via optimistic insert.
   *
   * Strategy: INSERT directly with the given (or randomly generated) room code.
   * If the code collides (HTTP 409 / unique constraint violation),
   * generate a new code and retry. This eliminates the SELECT-then-INSERT
   * race condition that caused spurious 409 errors in the console.
   *
   * @param hostUid - Host user ID
   * @param initialRoomNumber - Optional initial room code to try first
   * @param maxRetries - Max retry attempts on conflict (default: 5)
   */
  async createRoom(
    hostUid: string,
    initialRoomNumber?: string,
    maxRetries: number = 5,
    buildInitialState?: (roomCode: string) => BroadcastGameState,
  ): Promise<RoomRecord> {
    this.ensureConfigured();

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const roomNumber =
        attempt === 1 && initialRoomNumber ? initialRoomNumber : generateRoomCode();

      const row: Record<string, unknown> = {
        code: roomNumber,
        host_id: hostUid,
      };
      if (buildInitialState) {
        row.game_state = buildInitialState(roomNumber);
        row.state_revision = 0;
      }

      const { error } = await supabase!.from('rooms').insert(row);

      if (!error) {
        if (attempt > 1) {
          roomLog.info(` Room created on attempt ${attempt} with code ${roomNumber}`);
        }
        return {
          roomNumber,
          hostUid,
          createdAt: new Date(),
        };
      }

      // Check for conflict (409) - unique constraint violation
      const isConflict =
        error.code === '23505' || // PostgreSQL unique violation
        error.message.includes('duplicate') ||
        error.message.includes('conflict') ||
        error.message.includes('already exists');

      if (isConflict && attempt < maxRetries) {
        roomLog.debug(
          ` Room code ${roomNumber} already exists (attempt ${attempt}), retrying with new code...`,
        );
        continue;
      }

      lastError = new Error(`Failed to create room: ${error.message}`);
    }

    throw lastError || new Error('Failed to create room after max retries');
  }

  /**
   * Check if a room exists and get its host
   */
  async getRoom(roomNumber: string): Promise<RoomRecord | null> {
    this.ensureConfigured();

    const { data, error } = await supabase!
      .from('rooms')
      .select('id, code, host_id, created_at')
      .eq('code', roomNumber)
      .single();

    if (error || !data) {
      if (error) {
        roomLog.error('getRoom DB error for room', roomNumber, ':', error.message);
        Sentry.captureException(error);
      }
      return null;
    }

    // Supabase .single() returns row matching our DB schema (rooms table)
    const dbRoom = data as DbRoomRecord;
    return {
      roomNumber: dbRoom.code,
      hostUid: dbRoom.host_id,
      createdAt: new Date(dbRoom.created_at),
    };
  }

  /**
   * Check if a room exists
   */
  async roomExists(roomNumber: string): Promise<boolean> {
    const room = await this.getRoom(roomNumber);
    return room !== null;
  }

  /**
   * Delete a room (cleanup)
   */
  async deleteRoom(roomNumber: string): Promise<void> {
    this.ensureConfigured();

    const { error } = await supabase!.from('rooms').delete().eq('code', roomNumber);

    if (error) {
      roomLog.error(' Failed to delete room:', error);
      Sentry.captureException(error);
    }
  }

  /**
   * Upsert game state into rooms table.
   * Called by Host after every state mutation (broadcastCurrentState).
   * Fire-and-forget — failure only logs a warning, does not block gameplay.
   */
  async upsertGameState(
    roomCode: string,
    state: BroadcastGameState,
    revision: number,
  ): Promise<void> {
    this.ensureConfigured();

    const { error } = await supabase!
      .from('rooms')
      .update({ game_state: state, state_revision: revision })
      .eq('code', roomCode);

    if (error) {
      roomLog.warn('upsertGameState failed:', error.message);
    }
  }

  /**
   * Read latest game state from DB.
   * Used by Player for initial load and auto-heal fallback.
   */
  async getGameState(
    roomCode: string,
  ): Promise<{ state: BroadcastGameState; revision: number } | null> {
    this.ensureConfigured();

    const { data, error } = await supabase!
      .from('rooms')
      .select('game_state, state_revision')
      .eq('code', roomCode)
      .single();

    if (error || !data?.game_state) return null;

    // Supabase .single() returns row matching our DB schema
    return {
      state: data.game_state as BroadcastGameState,
      revision: data.state_revision as number,
    };
  }
}
