/**
 * IRoomService - Room record + game state persistence interface
 *
 * Defines public API contract for room CRUD and game_state read/write.
 * Does not validate game logic, does not handle realtime transport.
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

/** Room record (consumer-facing abstraction) */
export interface RoomRecord {
  roomCode: string;
  hostUserId: string;
  createdAt: Date;
  /** Game type for routing (werewolf | fibking | …). Absent/undefined ⇒ werewolf (legacy). */
  gameType?: string;
}

/** Room CRUD + game_state read/write interface. */
export interface IRoomService {
  /**
   * Create room (optimistic insert + conflict retry).
   * @param hostUserId - Host user ID
   * @param initialRoomNumber - Initial room number to try
   * @param maxRetries - Conflict retry limit (default 5)
   * @param buildInitialState - Optional initial state builder
   */
  createRoom(
    hostUserId: string,
    initialRoomNumber?: string,
    maxRetries?: number,
    buildInitialState?: (roomCode: string) => GameState,
  ): Promise<RoomRecord>;

  /** Query room record, returns null if not found */
  getRoom(roomCode: string): Promise<RoomRecord | null>;

  /** Check whether room exists */
  roomExists(roomCode: string): Promise<boolean>;

  /** Delete room */
  deleteRoom(roomCode: string): Promise<void>;

  /** Read state_revision (lightweight polling) */
  getStateRevision(roomCode: string): Promise<number | null>;

  /** Read full game_state + revision */
  getGameState(roomCode: string): Promise<{ state: GameState; revision: number } | null>;
}
