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

import type { RoomLocator } from '@game-judge/game-engine/platform/protocol/roomLocator';
import type {
  BaseGameState,
  StateUpdateMessage,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers (transport → ConnectionManager)
// ─────────────────────────────────────────────────────────────────────────────

export interface RealtimeUserEvent {
  readonly eventId: string;
}

export interface RealtimeUserEventCodec<TEvent extends RealtimeUserEvent> {
  parse(value: unknown): TEvent;
}

/** Transport-layer event callbacks (transport -> ConnectionManager). */
export interface TransportEventHandlers<
  TState extends BaseGameState<string>,
  TEvent extends RealtimeUserEvent = RealtimeUserEvent,
> {
  onOpen(): void;
  onClose(code: number, reason: string): void;
  onError(error: unknown): void;
  onStateUpdate(message: StateUpdateMessage<TState>): void;
  onUserEvent(event: TEvent): void;
  onPong(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

/** WebSocket transport layer interface — atomic operation contract, no reconnect logic. */
export interface IRealtimeTransport<
  TState extends BaseGameState<string>,
  TEvent extends RealtimeUserEvent = RealtimeUserEvent,
> {
  /**
   * Establish WebSocket connection.
   * Built-in 8s connect timeout. Timeout/failure is signaled via handlers.onClose / handlers.onError.
   * Contains no reconnect logic.
   */
  connect(room: RoomLocator): Promise<void>;

  /**
   * Close the current WebSocket.
   * Handlers are not triggered after close (caller knows this is an active close).
   */
  disconnect(): void;

  /**
   * Send a text message to the WebSocket.
   * @returns true only when the message was handed to an open socket.
   */
  send(data: string): boolean;

  /**
   * Register event handlers (transport translates WS events to typed callbacks).
   * Must be called before connect().
   */
  setEventHandlers(handlers: TransportEventHandlers<TState, TEvent>): void;
}
