/**
 * ConnectionManager — connection lifecycle management (imperative shell).
 *
 * Responsibilities:
 * - Owns ConnectionFSM and drives all state transitions
 * - Prefetch: on OPEN_WS, fire HTTP fetch in parallel (wakes DO + preloads state)
 * - Ping/pong keepalive + timeout detection
 * - Retry timer (exponential backoff + jitter)
 * - Revision poll (5s polls DB revision to detect missed broadcasts)
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

import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { IRealtimeTransport, SettleResultMessage } from '@/services/types/IRealtimeTransport';
import { handleError } from '@/utils/errorPipeline';
import { connectionLog } from '@/utils/logger';

import { createInitialContext, transition } from './ConnectionFSM';
import {
  type ConnectionEvent,
  ConnectionState,
  type FSMContext,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  PREFETCH_GRACE_MS,
  REVISION_POLL_BASE_MS,
  REVISION_POLL_MAX_MS,
  type SideEffect,
  SupersededError,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionStateListener = (state: ConnectionState) => void;

/** ConnectionManager dependency injection interface. */
export interface ConnectionManagerDeps {
  /** WebSocket transport layer (IRealtimeTransport) */
  transport: IRealtimeTransport;
  /** Fetch full game state from DB (used by both Host and Player) */
  fetchStateFromDB: (roomCode: string) => Promise<{ state: GameState; revision: number } | null>;
  /** Lightweight revision comparison: read state_revision from DB */
  getStateRevision: (roomCode: string) => Promise<number | null>;
  /** Callback when WS broadcast receives STATE_UPDATE */
  onStateUpdate: (state: GameState, revision: number, lastAction?: string) => void;
  /** Callback after fetch or WS broadcast yields new state (used for store.applySnapshot) */
  onFetchedState: (state: GameState, revision: number) => void;
  /** Settle-result unicast callback (optional) */
  onSettleResult?: (result: SettleResultMessage) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ConnectionManager — connection lifecycle management (imperative shell).
 *
 * Drives ConnectionFSM state transitions and executes all side effects:
 * WS open/close, ping/pong, retry timer, revision poll, platform event listeners.
 *
 * @remarks prefetch grace race: after WS connects, Promise.race(prefetch, PREFETCH_GRACE_MS=3s).
 *   If prefetch has not settled within the grace window, abandon prefetch and do a fresh fetch
 *   (by then the DO has been woken by the WS upgrade, so a fresh request completes in ~2-3s).
 *   ping/pong keepalive: sends ping every PING_INTERVAL_MS; missing pong within PONG_TIMEOUT_MS is treated as disconnect.
 *   revision poll: polls DB revision every REVISION_POLL_BASE_MS~MAX_MS to detect missed WS broadcasts.
 */
export class ConnectionManager {
  #ctx: FSMContext;
  readonly #deps: ConnectionManagerDeps;
  readonly #stateListeners = new Set<ConnectionStateListener>();

  // Timers
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #pingInterval: ReturnType<typeof setInterval> | null = null;
  #pongTimeout: ReturnType<typeof setTimeout> | null = null;
  #revisionPollTimer: ReturnType<typeof setTimeout> | null = null;
  #revisionPollCurrentMs: number = REVISION_POLL_BASE_MS;

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

  // Prefetch: fire HTTP fetch in parallel with WS handshake to avoid serial bottleneck.
  // The HTTP call also wakes the DO, so subsequent WS handshake hits a warm DO.
  #prefetchPromise: Promise<{ state: GameState; revision: number } | null> | null = null;
  #prefetchGeneration = 0;

  constructor(deps: ConnectionManagerDeps) {
    this.#deps = deps;
    this.#ctx = createInitialContext();

    // Wire transport events → FSM events
    deps.transport.setEventHandlers({
      onOpen: () => this.#dispatch({ type: 'WS_OPEN' }),
      onClose: (code, reason) => this.#dispatch({ type: 'WS_CLOSE', code, reason }),
      onError: (error) => this.#dispatch({ type: 'WS_ERROR', error }),
      onStateUpdate: (state, revision, lastAction) => {
        deps.onStateUpdate(state, revision, lastAction);
        this.#dispatch({ type: 'STATE_UPDATE', revision });
        // Activity detected — reset revision poll to fast interval
        this.#resetRevisionPollInterval();
      },
      onPong: () => this.#handlePong(),
      onSettleResult: (result) => deps.onSettleResult?.(result),
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
    // If already connected to this room, re-fetch state (store may have been reset)
    // but skip the full WS reconnect cycle.
    if (this.#ctx.state === ConnectionState.Connected && this.#ctx.roomCode === roomCode) {
      connectionLog.debug('Already connected, re-fetching state', { roomCode });
      await this.#fetchState(roomCode);
      return;
    }

    // Disposed — no recovery possible, reject immediately
    if (this.#ctx.state === ConnectionState.Disposed) {
      throw new Error('Cannot connect: ConnectionManager is disposed');
    }

    connectionLog.info('connectAndWait', { roomCode, userId });

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
    connectionLog.info('disconnect');
    this.#cancelPrefetch();
    this.#settleConnectWait(new Error('Connection disconnected'));
    this.#dispatch({ type: 'DISCONNECT' });
  }

  /** Dispose — clean up all resources, stop all timers, ignore all future events */
  dispose(): void {
    connectionLog.info('dispose');
    this.#cancelPrefetch();
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
        this.#startPrefetch(effect.roomCode);
        this.#deps.transport.connect(effect.roomCode, effect.userId);
        break;
      case 'CLOSE_WS':
        this.#cancelPrefetch();
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

  // ─── Prefetch (parallel with WS handshake) ────────────────────────────────

  #startPrefetch(roomCode: string): void {
    this.#cancelPrefetch();
    const generation = ++this.#prefetchGeneration;
    connectionLog.debug('Starting prefetch', { roomCode });
    this.#prefetchPromise = this.#deps.fetchStateFromDB(roomCode).catch((e: unknown) => {
      // Prefetch failure is non-fatal — #fetchState will retry via normal path
      if (generation === this.#prefetchGeneration) {
        connectionLog.debug('Prefetch failed (will retry in FETCH_STATE)', { error: e });
      }
      return null;
    });
  }

  #cancelPrefetch(): void {
    this.#prefetchGeneration++;
    this.#prefetchPromise = null;
  }

  // ─── Fetch State ──────────────────────────────────────────────────────────

  async #fetchState(roomCode: string): Promise<void> {
    try {
      // Consume prefetch result if available (same generation = not cancelled).
      // Race against a grace timer: if prefetch hasn't settled within PREFETCH_GRACE_MS
      // after WS opens, abandon it and fetch fresh (DO is warm from WS upgrade).
      const prefetch = this.#prefetchPromise;
      this.#prefetchPromise = null;

      let result: { state: GameState; revision: number } | null = null;

      if (prefetch) {
        result = await Promise.race([
          prefetch,
          new Promise<null>((r) => setTimeout(r, PREFETCH_GRACE_MS)),
        ]);
        if (!result) {
          connectionLog.debug('Prefetch did not settle within grace window, fetching fresh');
        }
      }

      if (!result) {
        result = await this.#deps.fetchStateFromDB(roomCode);
      }

      if (result) {
        this.#deps.onFetchedState(result.state, result.revision);
        this.#dispatch({ type: 'FETCH_SUCCESS', revision: result.revision });
      } else {
        this.#dispatch({ type: 'FETCH_FAILURE', error: new Error('No state returned') });
      }
    } catch (e) {
      handleError(e, {
        label: '状态恢复',
        logger: connectionLog,
        feedback: false,
      });
      this.#dispatch({ type: 'FETCH_FAILURE', error: e });
    }
  }

  // ─── Revision Poll (adaptive backoff) ───────────────────────────────────

  /** Generation counter: incremented on start/stop/reset to cancel stale async chains */
  #revisionPollGeneration = 0;

  #startRevisionPoll(): void {
    this.#stopRevisionPoll();
    this.#revisionPollCurrentMs = REVISION_POLL_BASE_MS;
    this.#scheduleNextRevisionPoll();
  }

  #stopRevisionPoll(): void {
    this.#revisionPollGeneration++;
    if (this.#revisionPollTimer) {
      clearTimeout(this.#revisionPollTimer);
      this.#revisionPollTimer = null;
    }
  }

  /** Reset poll interval to base (called on STATE_UPDATE activity) */
  #resetRevisionPollInterval(): void {
    this.#revisionPollCurrentMs = REVISION_POLL_BASE_MS;
    // Cancel current chain (including in-flight check) and start fresh
    this.#stopRevisionPoll();
    this.#scheduleNextRevisionPoll();
  }

  #scheduleNextRevisionPoll(): void {
    const gen = this.#revisionPollGeneration;
    this.#revisionPollTimer = setTimeout(() => {
      this.#revisionPollTimer = null;
      if (gen !== this.#revisionPollGeneration) return; // stale chain
      // Only poll when visible
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        this.#scheduleNextRevisionPoll();
        return;
      }
      void this.#checkRevisionAndReschedule(gen);
    }, this.#revisionPollCurrentMs);
  }

  async #checkRevisionAndReschedule(generation: number): Promise<void> {
    const roomCode = this.#ctx.roomCode;
    if (!roomCode) {
      if (generation === this.#revisionPollGeneration) this.#scheduleNextRevisionPoll();
      return;
    }

    let hadDrift = false;
    try {
      const dbRevision = await this.#deps.getStateRevision(roomCode);
      if (dbRevision != null && dbRevision > this.#ctx.lastRevision) {
        hadDrift = true;
        this.#dispatch({ type: 'REVISION_DRIFT', dbRevision });
      }
    } catch (e) {
      handleError(e, {
        label: 'revision poll',
        logger: connectionLog,
        feedback: false,
      });
    }

    // If generation changed during async check, this chain is cancelled
    if (generation !== this.#revisionPollGeneration) return;

    if (hadDrift) {
      // Activity: reset to fast polling
      this.#revisionPollCurrentMs = REVISION_POLL_BASE_MS;
    } else {
      // No activity: back off (double interval, capped at max)
      this.#revisionPollCurrentMs = Math.min(this.#revisionPollCurrentMs * 2, REVISION_POLL_MAX_MS);
    }
    this.#scheduleNextRevisionPoll();
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
