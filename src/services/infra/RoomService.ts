/**
 * RoomService - Supabase 房间记录的最小存储服务
 *
 * 职责：
 * - 创建/查询/删除 Supabase rooms 表记录
 * - 生成唯一 4 位房间号
 *
 * ✅ 允许：Supabase rooms 表的 CRUD 操作
 * ❌ 禁止：存储/校验任何游戏状态（游戏状态由 GameFacade 在内存中管理）
 *
 * Supabase rooms table schema (simplified):
 * - id: uuid (primary key)
 * - code: text (unique, 4-digit room code)
 * - host_id: text
 * - created_at: timestamptz
 * - updated_at: timestamptz
 */

import { isSupabaseConfigured,supabase } from '@/config/supabase';
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
  private static instance: RoomService;

  private constructor() {}

  static getInstance(): RoomService {
    if (!RoomService.instance) {
      RoomService.instance = new RoomService();
    }
    return RoomService.instance;
  }

  private isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured');
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
  ): Promise<RoomRecord> {
    this.ensureConfigured();

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const roomNumber = attempt === 1 && initialRoomNumber ? initialRoomNumber : generateRoomCode();

      const { error } = await supabase!.from('rooms').insert({
        code: roomNumber,
        host_id: hostUid,
      });

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
      return null;
    }

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
    }
  }
}
