/**
 * Connection FSM type definitions
 *
 * Defines all states, events, side effects, and context for the connection state machine.
 * Pure types file, zero runtime dependencies.
 */

// ─────────────────────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────────────────────

/** FSM internal connection states (8 total, more granular than UI display) */
export enum ConnectionState {
  /** Initial / left room. No active connection. */
  Idle = 'Idle',
  /** Establishing WebSocket connection */
  Connecting = 'Connecting',
  /** WS connected, syncing initial state from DB */
  Syncing = 'Syncing',
  /** Connection healthy, state synced */
  Connected = 'Connected',
  /** Connection lost, awaiting reconnect */
  Disconnected = 'Disconnected',
  /** Reconnecting (WS + fetch) */
  Reconnecting = 'Reconnecting',
  /** Reconnect attempts exhausted, awaiting manual intervention or network recovery */
  Failed = 'Failed',
  /** Disposed, no longer accepting events */
  Disposed = 'Disposed',
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

/** FSM event types (input) — trigger state transitions. */
export type ConnectionEvent =
  | { type: 'CONNECT'; roomCode: string; userId: string }
  | { type: 'WS_OPEN' }
  | { type: 'WS_CLOSE'; code?: number; reason?: string }
  | { type: 'WS_ERROR'; error?: unknown }
  | { type: 'FETCH_SUCCESS'; revision: number }
  | { type: 'FETCH_FAILURE'; error?: unknown }
  | { type: 'STATE_UPDATE'; revision: number }
  | { type: 'PING_TIMEOUT' }
  | { type: 'NETWORK_ONLINE' }
  | { type: 'NETWORK_OFFLINE' }
  | { type: 'VISIBILITY_VISIBLE' }
  | { type: 'VISIBILITY_HIDDEN' }
  | { type: 'RETRY_TIMER_FIRED' }
  | { type: 'MANUAL_RECONNECT' }
  | { type: 'REVISION_DRIFT'; dbRevision: number }
  | { type: 'DISCONNECT' }
  | { type: 'DISPOSE' };

// ─────────────────────────────────────────────────────────────────────────────
// Side Effects
// ─────────────────────────────────────────────────────────────────────────────

/** FSM side effect types (output) — executed by ConnectionManager. */
export type SideEffect =
  | { type: 'OPEN_WS'; roomCode: string; userId: string }
  | { type: 'CLOSE_WS' }
  | { type: 'FETCH_STATE'; roomCode: string }
  | { type: 'SCHEDULE_RETRY'; delayMs: number }
  | { type: 'CANCEL_RETRY' }
  | { type: 'START_PING' }
  | { type: 'STOP_PING' }
  | { type: 'START_REVISION_POLL' }
  | { type: 'STOP_REVISION_POLL' }
  | {
      type: 'LOG';
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      data?: Record<string, unknown>;
    };

// ─────────────────────────────────────────────────────────────────────────────
// FSM Context
// ─────────────────────────────────────────────────────────────────────────────

/** FSM context — all mutable data of the state machine. */
export interface FSMContext {
  readonly state: ConnectionState;
  readonly roomCode: string | null;
  readonly userId: string | null;
  /** Current reconnect attempt count (0-based). Resets to 0 when WS connection succeeds and enters Connected. */
  readonly attempt: number;
  /** Max reconnect attempts. Enters Failed state when exhausted (awaits manual reconnect or network recovery). */
  readonly maxAttempts: number;
  /** Last state revision received from server. Used by revision poll to detect missed broadcasts. */
  readonly lastRevision: number;
  readonly networkOnline: boolean;
  readonly visible: boolean;
}

/** Result of a state transition: new context + side effects to execute */
export interface TransitionResult {
  readonly ctx: FSMContext;
  readonly effects: readonly SideEffect[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SupersededError — thrown when connectAndWait() is cancelled by a newer call.
 *
 * When thrown: when a new connectAndWait() call supersedes a prior unresolved one.
 * How to catch: `instanceof SupersededError` — not a real failure, just a cancellation signal.
 */
export class SupersededError extends Error {
  constructor() {
    super('Superseded by new connectAndWait');
    this.name = 'SupersededError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default maximum reconnect attempts before entering Failed state */
export const DEFAULT_MAX_ATTEMPTS = 15;

/** Ping interval in milliseconds (client → server) */
export const PING_INTERVAL_MS = 25_000;

/** Pong timeout in milliseconds (server → client response deadline) */
export const PONG_TIMEOUT_MS = 10_000;

/** Revision poll base interval in milliseconds (resets to this on activity) */
export const REVISION_POLL_BASE_MS = 5_000;

/** Revision poll maximum interval in milliseconds (cap for backoff) */
export const REVISION_POLL_MAX_MS = 60_000;

/**
 * Max time (ms) to wait for the prefetch promise in #fetchState after WS opens.
 * If prefetch hasn't settled within this window, abandon it and issue a fresh fetch
 * (DO is already warm from WS upgrade, so fresh fetch will be fast).
 */
export const PREFETCH_GRACE_MS = 3_000;
