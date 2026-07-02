/**
 * IGameRoomRPC — GameRoom Durable Object public RPC method contract.
 *
 * GameRoom class must `implements IGameRoomRPC`, ensuring:
 * - Methods called by handlers exist at compile time
 * - Parameter/return types are consistent
 * - Refactoring safety (renaming/deleting methods triggers compile errors)
 *
 * @remarks All methods run in DO single-threaded context, no concurrency races. Game-specific
 *   commands go through `engineAction`; the room object does not grow per-game RPC methods.
 */

import type { DispatchResult } from './processEngineAction';

export interface IGameRoomRPC extends Rpc.DurableObjectBranded {
  // ── Read-only ───────────────────────────────────────────────────────────

  /**
   * Read current room state + revision. The state blob is game-typed by the room's
   * stored game_type; callers must interpret it at their boundary.
   */
  getState(): Promise<{ state: unknown; revision: number } | null>;

  /** Read current revision number only (for lightweight polling). Returns null if room not initialized. */
  getRevision(): Promise<number | null>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Initialize a room for a gameType: store the server-built state blob
   * + record game_type for routing. Generic, does not grow per game.
   */
  initState(gameType: string, blob: unknown): Promise<void>;

  /**
   * Dispatch an action to the room's engine (read-compute-write-broadcast).
   * Generic Command entry; the engine is resolved by stored game_type.
   */
  engineAction(actionType: string, payload: unknown): Promise<DispatchResult>;

  /**
   * Clear all DO persistent storage (deleteAll).
   * @pre Called only in room/delete handler. DO instance unusable after this call.
   */
  cleanup(): Promise<void>;
}
