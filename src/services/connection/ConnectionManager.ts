/**
 * ConnectionManager — connection lifecycle management (imperative shell).
 *
 * Responsibilities:
 * - Owns ConnectionFSM and drives all state transitions
 * - Requests and correlates authoritative snapshots over the active WebSocket
 * - Ping/pong keepalive + timeout detection
 * - Retry timer (exponential backoff + jitter)
 * - Platform event listeners (online/offline, visibilitychange)
 * - connectAndWait(): initial connection with Promise semantics
 *
 * Not responsible for:
 * - Game logic
 * - State persistence
 * - Directly creating WebSocket (operates via IRealtimeTransport interface)
 *
 * Boundary constraints:
 * - Follows functional core / imperative shell pattern
 * - ConnectionFSM (functional core) is pure functions
 * - ConnectionManager (imperative shell) executes side effects
 */

import { newRequestId } from '@game-judge/game-engine/platform/identifiers';
import {
  parseRoomLocator,
  type RoomLocator,
} from '@game-judge/game-engine/platform/protocol/roomLocator';
import type {
  BaseGameState,
  RoomSnapshot,
  StateSyncResponseMessage,
  StateUpdateMessage,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { createStateSyncRequestMessage } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { createUserEventAckMessage } from '@game-judge/game-engine/platform/protocol/userEvents';

import type { IRealtimeTransport, RealtimeUserEvent } from '@/services/types/IRealtimeTransport';
import { handleError } from '@/utils/errorPipeline';
import { NetworkTimeoutError } from '@/utils/errorUtils';
import { connectionLog } from '@/utils/logger';

import { createInitialContext, transition } from './ConnectionFSM';
import {
  type ConnectionEvent,
  ConnectionState,
  type FSMContext,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  type SideEffect,
  STATE_SYNC_TIMEOUT_MS,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionStateListener = (state: ConnectionState) => void;

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** ConnectionManager dependency injection interface. */
export interface ConnectionManagerDeps<
  TState extends BaseGameState<string>,
  TEvent extends RealtimeUserEvent = RealtimeUserEvent,
> {
  /** WebSocket transport layer (IRealtimeTransport) */
  transport: IRealtimeTransport<TState, TEvent>;
  /** Callback when WS broadcast receives STATE_UPDATE */
  onStateUpdate: (message: StateUpdateMessage<TState>) => void;
  /** Callback after a correlated socket sync yields an authoritative snapshot. */
  onStateSync: (snapshot: RoomSnapshot<TState>) => void;
  /** Durable user-event callback. */
  onUserEvent: (event: TEvent) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ConnectionManager — connection lifecycle management (imperative shell).
 *
 * Drives ConnectionFSM state transitions and executes all side effects:
 * WS open/close, ping/pong, retry timer, correlated state recovery, platform event listeners.
 *
 * @remarks State synchronization has an explicit request ID and deadline. Missing or mismatched
 *   responses never mark the connection live. Ping/pong independently detects dead connections.
 */
export class ConnectionManager<
  TState extends BaseGameState<string>,
  TEvent extends RealtimeUserEvent = RealtimeUserEvent,
> {
  #ctx: FSMContext;
  readonly #deps: ConnectionManagerDeps<TState, TEvent>;
  readonly #stateListeners = new Set<ConnectionStateListener>();

  // Timers
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #pingInterval: ReturnType<typeof setInterval> | null = null;
  #pongTimeout: ReturnType<typeof setTimeout> | null = null;
  #stateSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  #pendingStateSyncRequestId: string | null = null;
  #transportGeneration = 0;

  // Platform listeners
  #onlineHandler: (() => void) | null = null;
  #offlineHandler: (() => void) | null = null;
  #visibilityHandler: (() => void) | null = null;
  #pageshowHandler: ((e: PageTransitionEvent) => void) | null = null;
  #focusHandler: (() => void) | null = null;

  // connectAndWait() pending promise resolution
  #connectWaitResolve: (() => void) | null = null;
  #connectWaitReject: ((err: Error) => void) | null = null;
  #connectWaitTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: ConnectionManagerDeps<TState, TEvent>) {
    this.#deps = deps;
    this.#ctx = createInitialContext();

    // Wire transport events → FSM events
    deps.transport.setEventHandlers({
      onOpen: () => this.#dispatch({ type: 'WS_OPEN' }),
      onClose: (code, reason) => {
        if (code === 1002) {
          this.#failProtocol(new Error(`Realtime protocol closed: ${reason || 'unknown'}`));
          return;
        }
        this.#dispatch({ type: 'WS_CLOSE', code, reason });
      },
      onError: (error) => this.#dispatch({ type: 'WS_ERROR', error }),
      onStateUpdate: (message) => {
        try {
          deps.onStateUpdate(message);
        } catch (error) {
          this.#failProtocol(error);
          return;
        }
        this.#dispatch({ type: 'STATE_UPDATE', revision: message.revision });
      },
      onStateSyncResponse: (message) => this.#handleStateSyncResponse(message),
      onPong: () => this.#handlePong(),
      onUserEvent: (event) => {
        try {
          deps.onUserEvent(event);
        } catch (error) {
          this.#failProtocol(error);
        }
      },
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

  /** Send a durable user-event acknowledgement on the active socket. */
  sendUserEventAcknowledgement(eventId: string): boolean {
    return this.#deps.transport.send(JSON.stringify(createUserEventAckMessage(eventId)));
  }

  /**
   * Connect and wait until Connected state (or timeout/failure).
   *
   * Used by RoomSession to wait for WS connection and the initial authoritative snapshot.
   *
   * @param roomCode - Room to connect to
   * @param timeoutMs - Connection + sync timeout (default 15s)
   * @throws {NetworkTimeoutError} When the connection does not become live before the deadline.
   * @throws {Error} When called outside the Idle state or the connection fails.
   */
  async connectAndWait(room: RoomLocator, timeoutMs = 15_000): Promise<void> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    const { roomCode, roomId } = locator;
    if (this.#ctx.state !== ConnectionState.Idle) {
      throw new Error(
        `ConnectionManager.connectAndWait requires Idle, received ${this.#ctx.state}`,
      );
    }
    this.#assertNoPendingWait();

    connectionLog.info('connectAndWait', { roomCode });

    return new Promise<void>((resolve, reject) => {
      this.#connectWaitResolve = resolve;
      this.#connectWaitReject = reject;

      this.#connectWaitTimeout = setTimeout(() => {
        this.#settleConnectWait(new NetworkTimeoutError('connectAndWait', timeoutMs));
      }, timeoutMs);

      // Dispatch CONNECT → triggers OPEN_WS side effect.
      // FSM handles CONNECT as a global transition from any non-Disposed state.
      this.#dispatch({ type: 'CONNECT', roomCode, roomId });
    });
  }

  /**
   * Reconnect an existing room binding and wait for a fresh snapshot/update.
   *
   * @throws {NetworkTimeoutError} When the connection does not become live before the deadline.
   * @throws {Error} When called outside the Disconnected or Failed state.
   */
  reconnectAndWait(timeoutMs = 15_000): Promise<void> {
    if (
      this.#ctx.state !== ConnectionState.Disconnected &&
      this.#ctx.state !== ConnectionState.Failed
    ) {
      throw new Error(
        `ConnectionManager.reconnectAndWait requires Disconnected or Failed, received ${this.#ctx.state}`,
      );
    }
    this.#assertNoPendingWait();

    return new Promise<void>((resolve, reject) => {
      this.#connectWaitResolve = resolve;
      this.#connectWaitReject = reject;
      this.#connectWaitTimeout = setTimeout(() => {
        this.#settleConnectWait(new NetworkTimeoutError('reconnectAndWait', timeoutMs));
      }, timeoutMs);
      this.#dispatch({ type: 'MANUAL_RECONNECT' });
    });
  }

  /** Disconnect — clean up connection, return to Idle. Can reconnect later. */
  disconnect(): void {
    connectionLog.info('disconnect');
    this.#settleConnectWait(new Error('Connection disconnected'));
    this.#dispatch({ type: 'DISCONNECT' });
  }

  /** Dispose — clean up all resources, stop all timers, ignore all future events */
  dispose(): void {
    connectionLog.info('dispose');
    this.#settleConnectWait(new Error('Connection disposed'));
    this.#dispatch({ type: 'DISPOSE' });
    this.#unregisterPlatformListeners();
    this.#stateListeners.clear();
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
      connectionLog.info('State transition', {
        from: prev,
        to: this.#ctx.state,
        event: event.type,
      });
      this.#notifyStateListeners();

      // Settle connectAndWait promise on terminal states
      if (this.#ctx.state === ConnectionState.Connected) {
        this.#settleConnectWait(null);
      } else if (
        this.#ctx.state === ConnectionState.Failed ||
        this.#ctx.state === ConnectionState.Disposed
      ) {
        const failure =
          event.type === 'PROTOCOL_FAILURE'
            ? toError(event.error)
            : new Error(`Connection ${this.#ctx.state}`);
        this.#settleConnectWait(failure);
      }
    }
  }

  // =========================================================================
  // Side Effect Execution
  // =========================================================================

  #executeSideEffect(effect: SideEffect): void {
    switch (effect.type) {
      case 'OPEN_WS':
        void this.#openTransport({ roomCode: effect.roomCode, roomId: effect.roomId });
        break;
      case 'CLOSE_WS':
        this.#cancelStateSync();
        this.#transportGeneration += 1;
        this.#deps.transport.disconnect();
        break;
      case 'REQUEST_STATE_SYNC':
        this.#requestStateSync();
        break;
      case 'CANCEL_STATE_SYNC':
        this.#cancelStateSync();
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
      case 'LOG':
        this.#executeLog(effect);
        break;
    }
  }

  // ─── connectAndWait settlement ────────────────────────────────────────────

  #assertNoPendingWait(): void {
    if (this.#connectWaitResolve !== null || this.#connectWaitReject !== null) {
      throw new Error('ConnectionManager already has a pending connection wait');
    }
  }

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

  #failProtocol(error: unknown): void {
    handleError(error, {
      label: '实时协议',
      logger: connectionLog,
      feedback: false,
    });
    this.#dispatch({ type: 'PROTOCOL_FAILURE', error });
  }

  async #openTransport(room: RoomLocator): Promise<void> {
    const transportGeneration = ++this.#transportGeneration;
    try {
      await this.#deps.transport.connect(room);
    } catch (error) {
      if (transportGeneration !== this.#transportGeneration) return;
      handleError(error, {
        label: '实时连接',
        logger: connectionLog,
        feedback: false,
      });
      this.#dispatch({ type: 'WS_ERROR', error });
      this.#dispatch({ type: 'WS_CLOSE', code: 4001, reason: 'transport_connect_failed' });
    }
  }

  // ─── Ping / Pong ──────────────────────────────────────────────────────────

  #startPing(): void {
    this.#stopPing();
    this.#pingInterval = setInterval(() => {
      // Literal 'ping' matches the DO's setWebSocketAutoResponse('ping' → 'pong'),
      // so the keepalive is answered at the edge without waking the DO.
      this.#deps.transport.send('ping');
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

  // ─── Authoritative State Sync ────────────────────────────────────────────

  #requestStateSync(): void {
    this.#cancelStateSync();
    const requestId = newRequestId();
    this.#pendingStateSyncRequestId = requestId;
    this.#stateSyncTimeout = setTimeout(() => {
      if (this.#pendingStateSyncRequestId !== requestId) return;
      this.#pendingStateSyncRequestId = null;
      this.#stateSyncTimeout = null;
      this.#dispatch({ type: 'STATE_SYNC_TIMEOUT' });
    }, STATE_SYNC_TIMEOUT_MS);

    if (!this.#deps.transport.send(JSON.stringify(createStateSyncRequestMessage(requestId)))) {
      this.#cancelStateSync();
      connectionLog.warn('State sync request could not be sent');
      this.#transportGeneration += 1;
      this.#deps.transport.disconnect();
      this.#dispatch({ type: 'WS_CLOSE', code: 1006, reason: 'state_sync_send_failed' });
    }
  }

  #cancelStateSync(): void {
    if (this.#stateSyncTimeout !== null) {
      clearTimeout(this.#stateSyncTimeout);
      this.#stateSyncTimeout = null;
    }
    this.#pendingStateSyncRequestId = null;
  }

  #handleStateSyncResponse(message: StateSyncResponseMessage<TState>): void {
    if (this.#pendingStateSyncRequestId === null) {
      this.#failProtocol(new Error(`Unexpected state sync response ${message.requestId}`));
      return;
    }
    if (message.requestId !== this.#pendingStateSyncRequestId) {
      this.#failProtocol(
        new Error(
          `State sync response ${message.requestId} does not match ${this.#pendingStateSyncRequestId}`,
        ),
      );
      return;
    }

    this.#cancelStateSync();
    const snapshot: RoomSnapshot<TState> = {
      gameType: message.gameType,
      stateVersion: message.stateVersion,
      revision: message.revision,
      state: message.state,
    };
    try {
      this.#deps.onStateSync(snapshot);
    } catch (error) {
      this.#failProtocol(error);
      return;
    }
    this.#dispatch({ type: 'STATE_SYNC_SUCCESS', revision: snapshot.revision });
  }

  // ─── Retry Timer ──────────────────────────────────────────────────────────

  #scheduleRetry(delayMs: number): void {
    connectionLog.debug('Scheduling retry', { delayMs });
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

    // Fallback: pageshow (fires on BFCache restore & WKWebView resume where
    // visibilitychange may not fire reliably)
    if (typeof globalThis.window?.addEventListener === 'function') {
      this.#pageshowHandler = (e: PageTransitionEvent) => {
        // Only act if FSM thinks we're hidden but the page is actually visible
        if (e.persisted && !this.#ctx.visible && document.visibilityState === 'visible') {
          connectionLog.debug('pageshow fallback → VISIBILITY_VISIBLE');
          this.#dispatch({ type: 'VISIBILITY_VISIBLE' });
        }
      };
      globalThis.window.addEventListener('pageshow', this.#pageshowHandler);
    }

    // Fallback: focus (Android WebView sometimes fires focus before visibilitychange
    // on resume from background; WKWebView may only fire focus without visibilitychange)
    if (typeof globalThis.window?.addEventListener === 'function') {
      this.#focusHandler = () => {
        if (!this.#ctx.visible && document.visibilityState === 'visible') {
          connectionLog.debug('focus fallback → VISIBILITY_VISIBLE');
          this.#dispatch({ type: 'VISIBILITY_VISIBLE' });
        }
      };
      globalThis.window.addEventListener('focus', this.#focusHandler);
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
      if (this.#pageshowHandler) {
        globalThis.window.removeEventListener('pageshow', this.#pageshowHandler);
        this.#pageshowHandler = null;
      }
      if (this.#focusHandler) {
        globalThis.window.removeEventListener('focus', this.#focusHandler);
        this.#focusHandler = null;
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
