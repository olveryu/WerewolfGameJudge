/**
 * ConnectionManager — 连接生命周期管理（imperative shell）
 *
 * 持有 ConnectionFSM，驱动所有状态转换。通过 IRealtimeTransport 接口
 * 操作 WebSocket（不直接创建 WS）。管理：
 * - Ping/pong keepalive + timeout 检测
 * - Retry timer（指数退避 + jitter）
 * - Revision poll（5s 轮询 DB revision 检测丢广播）
 * - 平台事件监听（online/offline、visibilitychange）
 * - connectAndWait()：带 Promise 语义的初始连接
 *
 * 遵循 functional core / imperative shell 模式：
 * - ConnectionFSM（functional core）是纯函数
 * - ConnectionManager（imperative shell）执行 side effects
 *
 * 不包含游戏逻辑，不持久化状态。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { IRealtimeTransport } from '@/services/types/IRealtimeTransport';
import { connectionLog } from '@/utils/logger';

import { createInitialContext, transition } from './ConnectionFSM';
import {
  type ConnectionEvent,
  ConnectionState,
  type FSMContext,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  REVISION_POLL_INTERVAL_MS,
  type SideEffect,
  SupersededError,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionStateListener = (state: ConnectionState) => void;

export interface ConnectionManagerDeps {
  /** WebSocket 传输层（IRealtimeTransport） */
  transport: IRealtimeTransport;
  /** 从 DB 拉取完整 game state（Host + Player 通用） */
  fetchStateFromDB: (roomCode: string) => Promise<{ state: GameState; revision: number } | null>;
  /** 轻量 revision 比对：从 DB 读 state_revision */
  getStateRevision: (roomCode: string) => Promise<number | null>;
  /** WS 广播收到 STATE_UPDATE 时的回调 */
  onStateUpdate: (state: GameState, revision: number) => void;
  /** fetch 或 WS 广播获得新 state 后的回调（用于 store.applySnapshot） */
  onFetchedState: (state: GameState, revision: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager
// ─────────────────────────────────────────────────────────────────────────────

export class ConnectionManager {
  #ctx: FSMContext;
  readonly #deps: ConnectionManagerDeps;
  readonly #stateListeners = new Set<ConnectionStateListener>();

  // Timers
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #pingInterval: ReturnType<typeof setInterval> | null = null;
  #pongTimeout: ReturnType<typeof setTimeout> | null = null;
  #revisionPollInterval: ReturnType<typeof setInterval> | null = null;

  // Platform listeners
  #onlineHandler: (() => void) | null = null;
  #offlineHandler: (() => void) | null = null;
  #visibilityHandler: (() => void) | null = null;

  // connectAndWait() pending promise resolution
  #connectWaitResolve: (() => void) | null = null;
  #connectWaitReject: ((err: Error) => void) | null = null;
  #connectWaitTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: ConnectionManagerDeps) {
    this.#deps = deps;
    this.#ctx = createInitialContext();

    // Wire transport events → FSM events
    deps.transport.setEventHandlers({
      onOpen: () => this.#dispatch({ type: 'WS_OPEN' }),
      onClose: (code, reason) => this.#dispatch({ type: 'WS_CLOSE', code, reason }),
      onError: (error) => this.#dispatch({ type: 'WS_ERROR', error }),
      onStateUpdate: (state, revision) => {
        deps.onStateUpdate(state, revision);
        this.#dispatch({ type: 'STATE_UPDATE', revision });
      },
      onPong: () => this.#handlePong(),
    });

    this.#registerPlatformListeners();
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /** Subscribe to connection state changes. Called immediately with current state. */
  addStateListener(listener: ConnectionStateListener): () => void {
    this.#stateListeners.add(listener);
    listener(this.#ctx.state);
    return () => this.#stateListeners.delete(listener);
  }

  /** Current FSM state */
  getState(): ConnectionState {
    return this.#ctx.state;
  }

  /** Current FSM context (for observability / testing) */
  getContext(): Readonly<FSMContext> {
    return this.#ctx;
  }

  /**
   * Connect and wait until Connected state (or timeout/failure).
   *
   * Used by GameFacade.createRoom / joinRoom to synchronously wait for
   * WS connection + initial DB fetch before proceeding with game logic.
   *
   * @param roomCode - Room to connect to
   * @param userId - Current user ID
   * @param timeoutMs - Connection + sync timeout (default 15s)
   * @throws Error if connection fails or times out
   */
  async connectAndWait(roomCode: string, userId: string, timeoutMs = 15_000): Promise<void> {
    // If already connected to this room, just return
    if (this.#ctx.state === ConnectionState.Connected && this.#ctx.roomCode === roomCode) {
      return;
    }

    // Disposed — no recovery possible, reject immediately
    if (this.#ctx.state === ConnectionState.Disposed) {
      throw new Error('Cannot connect: ConnectionManager is disposed');
    }

    return new Promise<void>((resolve, reject) => {
      // Settle any pending connectAndWait before creating a new one (P2)
      this.#settleConnectWait(new SupersededError());

      this.#connectWaitResolve = resolve;
      this.#connectWaitReject = reject;

      this.#connectWaitTimeout = setTimeout(() => {
        this.#settleConnectWait(new Error(`connectAndWait timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Dispatch CONNECT → triggers OPEN_WS side effect.
      // FSM handles CONNECT as a global transition from any non-Disposed state.
      this.#dispatch({ type: 'CONNECT', roomCode, userId });
    });
  }

  /** Fire-and-forget connect (for cases where caller doesn't need to await) */
  connect(roomCode: string, userId: string): void {
    this.#dispatch({ type: 'CONNECT', roomCode, userId });
  }

  /** Manual reconnect (user clicked "reconnect" button) */
  manualReconnect(): void {
    this.#dispatch({ type: 'MANUAL_RECONNECT' });
  }

  /** Disconnect — clean up connection, return to Idle. Can reconnect later. */
  disconnect(): void {
    this.#settleConnectWait(new Error('Connection disconnected'));
    this.#dispatch({ type: 'DISCONNECT' });
  }

  /** Dispose — clean up all resources, stop all timers, ignore all future events */
  dispose(): void {
    this.#settleConnectWait(new Error('Connection disposed'));
    this.#dispatch({ type: 'DISPOSE' });
    this.#unregisterPlatformListeners();
    this.#stateListeners.clear();
  }

  /** Update lastRevision from external source (e.g., store applySnapshot) */
  updateRevision(revision: number): void {
    if (revision > this.#ctx.lastRevision) {
      this.#ctx = { ...this.#ctx, lastRevision: revision };
    }
  }

  // =========================================================================
  // FSM Dispatch
  // =========================================================================

  #dispatch(event: ConnectionEvent): void {
    const prev = this.#ctx.state;
    const result = transition(this.#ctx, event);
    this.#ctx = result.ctx;

    // Execute side effects
    for (const effect of result.effects) {
      this.#executeSideEffect(effect);
    }

    // Notify listeners on state change
    if (prev !== this.#ctx.state) {
      this.#notifyStateListeners();

      // Settle connectAndWait promise on terminal states
      if (this.#ctx.state === ConnectionState.Connected) {
        this.#settleConnectWait(null);
      } else if (
        this.#ctx.state === ConnectionState.Failed ||
        this.#ctx.state === ConnectionState.Disposed
      ) {
        this.#settleConnectWait(new Error(`Connection ${this.#ctx.state}`));
      }
    }
  }

  // =========================================================================
  // Side Effect Execution
  // =========================================================================

  #executeSideEffect(effect: SideEffect): void {
    switch (effect.type) {
      case 'OPEN_WS':
        this.#deps.transport.connect(effect.roomCode, effect.userId);
        break;
      case 'CLOSE_WS':
        this.#deps.transport.disconnect();
        break;
      case 'FETCH_STATE':
        void this.#fetchState(effect.roomCode);
        break;
      case 'SCHEDULE_RETRY':
        this.#scheduleRetry(effect.delayMs);
        break;
      case 'CANCEL_RETRY':
        this.#cancelRetry();
        break;
      case 'START_PING':
        this.#startPing();
        break;
      case 'STOP_PING':
        this.#stopPing();
        break;
      case 'START_REVISION_POLL':
        this.#startRevisionPoll();
        break;
      case 'STOP_REVISION_POLL':
        this.#stopRevisionPoll();
        break;
      case 'LOG':
        this.#executeLog(effect);
        break;
    }
  }

  // ─── connectAndWait settlement ────────────────────────────────────────────

  #settleConnectWait(error: Error | null): void {
    if (this.#connectWaitTimeout) {
      clearTimeout(this.#connectWaitTimeout);
      this.#connectWaitTimeout = null;
    }
    if (error) {
      this.#connectWaitReject?.(error);
    } else {
      this.#connectWaitResolve?.();
    }
    this.#connectWaitResolve = null;
    this.#connectWaitReject = null;
  }

  // ─── Ping / Pong ──────────────────────────────────────────────────────────

  #startPing(): void {
    this.#stopPing();
    this.#pingInterval = setInterval(() => {
      this.#deps.transport.send(JSON.stringify({ type: 'ping' }));
      this.#startPongTimeout();
    }, PING_INTERVAL_MS);
  }

  #stopPing(): void {
    if (this.#pingInterval) {
      clearInterval(this.#pingInterval);
      this.#pingInterval = null;
    }
    this.#cancelPongTimeout();
  }

  #startPongTimeout(): void {
    this.#cancelPongTimeout();
    this.#pongTimeout = setTimeout(() => {
      connectionLog.warn('Pong timeout — treating connection as dead');
      this.#dispatch({ type: 'PING_TIMEOUT' });
    }, PONG_TIMEOUT_MS);
  }

  #cancelPongTimeout(): void {
    if (this.#pongTimeout) {
      clearTimeout(this.#pongTimeout);
      this.#pongTimeout = null;
    }
  }

  #handlePong(): void {
    this.#cancelPongTimeout();
  }

  // ─── Retry Timer ──────────────────────────────────────────────────────────

  #scheduleRetry(delayMs: number): void {
    this.#cancelRetry();
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      this.#dispatch({ type: 'RETRY_TIMER_FIRED' });
    }, delayMs);
  }

  #cancelRetry(): void {
    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }
  }

  // ─── Fetch State ──────────────────────────────────────────────────────────

  async #fetchState(roomCode: string): Promise<void> {
    try {
      const result = await this.#deps.fetchStateFromDB(roomCode);
      if (result) {
        this.#deps.onFetchedState(result.state, result.revision);
        this.#dispatch({ type: 'FETCH_SUCCESS', revision: result.revision });
      } else {
        this.#dispatch({ type: 'FETCH_FAILURE', error: new Error('No state returned') });
      }
    } catch (e) {
      this.#dispatch({ type: 'FETCH_FAILURE', error: e });
    }
  }

  // ─── Revision Poll ────────────────────────────────────────────────────────

  #startRevisionPoll(): void {
    this.#stopRevisionPoll();
    this.#revisionPollInterval = setInterval(() => {
      // Only poll when visible
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void this.#checkRevision();
    }, REVISION_POLL_INTERVAL_MS);
  }

  #stopRevisionPoll(): void {
    if (this.#revisionPollInterval) {
      clearInterval(this.#revisionPollInterval);
      this.#revisionPollInterval = null;
    }
  }

  async #checkRevision(): Promise<void> {
    const roomCode = this.#ctx.roomCode;
    if (!roomCode) return;

    try {
      const dbRevision = await this.#deps.getStateRevision(roomCode);
      if (dbRevision == null) return;
      if (dbRevision > this.#ctx.lastRevision) {
        this.#dispatch({ type: 'REVISION_DRIFT', dbRevision });
      }
    } catch {
      connectionLog.warn('Revision poll failed');
    }
  }

  // ─── Platform Event Listeners ─────────────────────────────────────────────

  #registerPlatformListeners(): void {
    // Browser online/offline
    if (typeof globalThis.window?.addEventListener === 'function') {
      this.#onlineHandler = () => this.#dispatch({ type: 'NETWORK_ONLINE' });
      this.#offlineHandler = () => this.#dispatch({ type: 'NETWORK_OFFLINE' });
      globalThis.window.addEventListener('online', this.#onlineHandler);
      globalThis.window.addEventListener('offline', this.#offlineHandler);
    }

    // Visibility change
    if (typeof document !== 'undefined') {
      this.#visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          this.#dispatch({ type: 'VISIBILITY_VISIBLE' });
        } else {
          this.#dispatch({ type: 'VISIBILITY_HIDDEN' });
        }
      };
      document.addEventListener('visibilitychange', this.#visibilityHandler);
    }
  }

  #unregisterPlatformListeners(): void {
    if (typeof globalThis.window?.removeEventListener === 'function') {
      if (this.#onlineHandler) {
        globalThis.window.removeEventListener('online', this.#onlineHandler);
        this.#onlineHandler = null;
      }
      if (this.#offlineHandler) {
        globalThis.window.removeEventListener('offline', this.#offlineHandler);
        this.#offlineHandler = null;
      }
    }
    if (typeof document !== 'undefined' && this.#visibilityHandler) {
      document.removeEventListener('visibilitychange', this.#visibilityHandler);
      this.#visibilityHandler = null;
    }
  }

  // ─── Notification ─────────────────────────────────────────────────────────

  #notifyStateListeners(): void {
    const state = this.#ctx.state;
    this.#stateListeners.forEach((listener) => listener(state));
  }

  // ─── Logging ──────────────────────────────────────────────────────────────

  #executeLog(effect: Extract<SideEffect, { type: 'LOG' }>): void {
    const { level, message, data } = effect;
    if (data) {
      connectionLog[level](message, data);
    } else {
      connectionLog[level](message);
    }
  }
}
