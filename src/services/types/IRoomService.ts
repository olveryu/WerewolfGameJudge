/**
 * IRoomService - Room record + game state persistence interface
 *
 * Defines public API contract for room CRUD and game_state read/write.
 * Does not validate game logic, does not handle realtime transport.
 */

import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';

/** Room record (consumer-facing abstraction) */
export interface RoomRecord {
  roomCode: string;
  hostUserId: string;
  createdAt: Date;
  /** Game type for routing (werewolf | fibking | …). */
  gameType: string;
}

export interface CreateRoomParams<TConfig = unknown> {
  gameType: string;
  initialRoomNumber?: string;
  maxRetries?: number;
  config: TConfig;
}

/** Room CRUD + game_state read/write interface. */
export interface IRoomService {
  /** Create room (optimistic insert + conflict retry). */
  createRoom<TConfig = unknown>(params: CreateRoomParams<TConfig>): Promise<RoomRecord>;

  /** Query room record, returns null if not found */
  getRoom(roomCode: string): Promise<RoomRecord | null>;

  /** Check whether room exists */
  roomExists(roomCode: string): Promise<boolean>;

  /** Delete room */
  deleteRoom(roomCode: string): Promise<void>;

  /** Read state_revision (lightweight polling) */
  getStateRevision(roomCode: string): Promise<number | null>;

  /** Read full room state + revision. Callers choose the state type at their adapter boundary. */
  getGameState<TState = WerewolfState>(
    roomCode: string,
  ): Promise<{ state: TState; revision: number } | null>;
}
