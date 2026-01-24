/**
 * SimplifiedRoomService - Minimal Supabase room storage
 *
 * This service ONLY handles basic room record in Supabase.
 * All game state is managed by V2GameFacade (in-memory on Host).
 *
 * Supabase rooms table schema (simplified):
 * - id: uuid (primary key)
 * - code: text (unique, 4-digit room code)
 * - host_id: text
 * - created_at: timestamptz
 * - updated_at: timestamptz
 */

import { supabase, isSupabaseConfigured } from '../../config/supabase';
import { roomLog } from '../../utils/logger';

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

export class SimplifiedRoomService {
  private static instance: SimplifiedRoomService;

  private constructor() {}

  static getInstance(): SimplifiedRoomService {
    if (!SimplifiedRoomService.instance) {
      SimplifiedRoomService.instance = new SimplifiedRoomService();
    }
    return SimplifiedRoomService.instance;
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
   * Generate a unique 4-digit room number
   */
  async generateRoomNumber(): Promise<string> {
    this.ensureConfigured();

    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const roomNumber = Math.floor(1000 + Math.random() * 9000).toString();

      // Check if room exists (use maybeSingle to avoid 406 on no match)
      const { data, error } = await supabase!
        .from('rooms')
        .select('code')
        .eq('code', roomNumber)
        .maybeSingle();

      if (error) {
        roomLog.error(' Error checking room:', error);
        continue;
      }

      if (!data) {
        // Room doesn't exist, we can use this number
        return roomNumber;
      }
    }

    throw new Error('Failed to generate unique room number');
  }

  /**
   * Create a new room record with retry on conflict (HTTP 409).
   *
   * MITIGATION for room code race condition:
   * If another client creates a room with the same code between our
   * generateRoomNumber() check and insert, Supabase returns 409 (conflict).
   * We retry with a new room number up to maxRetries times.
   *
   * @param roomNumber - Initial room number to try
   * @param hostUid - Host user ID
   * @param maxRetries - Max retry attempts on 409 conflict (default: 3)
   */
  async createRoom(
    roomNumber: string,
    hostUid: string,
    maxRetries: number = 3,
  ): Promise<RoomRecord> {
    this.ensureConfigured();

    let currentRoomNumber = roomNumber;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { error } = await supabase!.from('rooms').insert({
        code: currentRoomNumber,
        host_id: hostUid,
      });

      if (!error) {
        if (attempt > 1) {
          roomLog.info(` Room created on attempt ${attempt} with code ${currentRoomNumber}`);
        }
        return {
          roomNumber: currentRoomNumber,
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
        roomLog.info(
          ` HTTP 409 conflict on attempt ${attempt}, room ${currentRoomNumber} already exists`,
        );
        roomLog.debug(`  Error: ${error.message}`);
        roomLog.debug(`  Generating new room number...`);

        // Generate a new room number for retry
        currentRoomNumber = await this.generateRoomNumber();
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

export default SimplifiedRoomService;
