/**
 * Connection FSM 类型定义
 *
 * 定义连接状态机的所有状态、事件、副作用和上下文。
 * 纯类型文件，零运行时依赖。
 */

// ─────────────────────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────────────────────

/** FSM 内部连接状态（8 种，比 UI 展示更细粒度） */
export enum ConnectionState {
  /** 初始 / 已离开房间。无活跃连接。 */
  Idle = 'Idle',
  /** 正在建立 WebSocket 连接 */
  Connecting = 'Connecting',
  /** WS 已连接，正在从 DB 同步初始状态 */
  Syncing = 'Syncing',
  /** 连接正常，状态已同步 */
  Connected = 'Connected',
  /** 连接断开，等待重连 */
  Disconnected = 'Disconnected',
  /** 正在重连（WS + fetch） */
  Reconnecting = 'Reconnecting',
  /** 重连次数耗尽，等待手动干预或网络恢复 */
  Failed = 'Failed',
  /** 已销毁，不再接受任何事件 */
  Disposed = 'Disposed',
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

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

export interface FSMContext {
  readonly state: ConnectionState;
  readonly roomCode: string | null;
  readonly userId: string | null;
  readonly attempt: number;
  readonly maxAttempts: number;
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
 * Thrown when a pending connectAndWait() is cancelled by a newer call.
 * Catch with `instanceof SupersededError` — not a real failure, just cancellation.
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

/** Revision poll interval in milliseconds */
export const REVISION_POLL_INTERVAL_MS = 5_000;
