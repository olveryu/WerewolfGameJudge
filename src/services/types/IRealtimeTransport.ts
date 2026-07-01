/**
 * IRealtimeTransport — WebSocket transport layer interface
 *
 * Defines the public contract for WebSocket atomic operations. ConnectionManager
 * operates WebSocket through this interface without depending on the concrete
 * implementation (CFRealtimeService) directly.
 *
 * Responsibility boundaries:
 * - Does: URL construction, WebSocket create/destroy, message parsing, connect timeout
 * - Does NOT: reconnect, backoff, ping/pong timer, state management, platform event listeners
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers (transport → ConnectionManager)
// ─────────────────────────────────────────────────────────────────────────────

/** Game settle result unicast message. */
export interface SettleResultMessage {
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number;
  goldenDrawsEarned: number;
}

/** Transport-layer event callbacks (transport -> ConnectionManager). */
export interface TransportEventHandlers<TState = GameState> {
  onOpen(): void;
  onClose(code: number, reason: string): void;
  onError(error: unknown): void;
  onStateUpdate(state: TState, revision: number, lastAction?: string): void;
  onSettleResult(result: SettleResultMessage): void;
  onPong(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

/** WebSocket transport layer interface — atomic operation contract, no reconnect logic. */
export interface IRealtimeTransport<TState = GameState> {
  /**
   * Establish WebSocket connection.
   * Built-in 8s connect timeout. Timeout/failure is signaled via handlers.onClose / handlers.onError.
   * Contains no reconnect logic.
   */
  connect(roomCode: string, userId: string): void;

  /**
   * Close the current WebSocket.
   * Handlers are not triggered after close (caller knows this is an active close).
   */
  disconnect(): void;

  /**
   * Send a text message to the WebSocket.
   * Only sends when WS readyState === OPEN; otherwise silently ignored.
   */
  send(data: string): void;

  /**
   * Register event handlers (transport translates WS events to typed callbacks).
   * Must be called before connect().
   */
  setEventHandlers(handlers: TransportEventHandlers<TState>): void;
}
