/**
 * ConnectionFSM — 纯函数连接状态机
 *
 * 输入 (context, event) → 输出 { ctx, effects }。
 * 零依赖（不依赖 React / WebSocket / Timer / 平台 API）。
 * 所有状态转换可通过穷举测试验证。
 *
 * Side effects 由 ConnectionManager 执行，FSM 本身不产生任何 IO。
 */

import { calculateBackoff } from './backoff';
import {
  type ConnectionEvent,
  ConnectionState,
  DEFAULT_MAX_ATTEMPTS,
  type FSMContext,
  type SideEffect,
  type TransitionResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Initial Context
// ─────────────────────────────────────────────────────────────────────────────

export function createInitialContext(
  overrides?: Partial<Pick<FSMContext, 'maxAttempts'>>,
): FSMContext {
  return {
    state: ConnectionState.Idle,
    roomCode: null,
    userId: null,
    attempt: 0,
    maxAttempts: overrides?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    lastRevision: 0,
    networkOnline: true,
    visible: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition (pure function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 纯函数状态转换。
 *
 * @param ctx - Current FSM context
 * @param event - Incoming event
 * @returns New context + side effects to execute
 */
export function transition(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (ctx.state) {
    case ConnectionState.Idle:
      return handleIdle(ctx, event);
    case ConnectionState.Connecting:
      return handleConnecting(ctx, event);
    case ConnectionState.Syncing:
      return handleSyncing(ctx, event);
    case ConnectionState.Connected:
      return handleConnected(ctx, event);
    case ConnectionState.Disconnected:
      return handleDisconnected(ctx, event);
    case ConnectionState.Reconnecting:
      return handleReconnecting(ctx, event);
    case ConnectionState.Failed:
      return handleFailed(ctx, event);
    case ConnectionState.Disposed:
      return noop(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State Handlers
// ─────────────────────────────────────────────────────────────────────────────

function handleIdle(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  if (event.type === 'CONNECT') {
    const next: FSMContext = {
      ...ctx,
      state: ConnectionState.Connecting,
      roomCode: event.roomCode,
      userId: event.userId,
      attempt: 0,
      lastRevision: 0,
    };
    return {
      ctx: next,
      effects: [
        log('info', `Idle → Connecting`, { roomCode: event.roomCode }),
        { type: 'OPEN_WS', roomCode: event.roomCode, userId: event.userId },
      ],
    };
  }
  if (event.type === 'DISCONNECT') {
    return noop(ctx); // Already Idle
  }
  if (event.type === 'DISPOSE') {
    return toDisposed(ctx);
  }
  return noop(ctx);
}

function handleConnecting(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (event.type) {
    case 'CONNECT':
      return toConnecting(ctx, event);
    case 'WS_OPEN': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Syncing };
      return {
        ctx: next,
        effects: [
          log('info', `Connecting → Syncing`),
          { type: 'START_PING' },
          { type: 'FETCH_STATE', roomCode: ctx.roomCode! },
        ],
      };
    }
    case 'WS_CLOSE': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Disconnected };
      const delay = calculateBackoff(ctx.attempt);
      return {
        ctx: next,
        effects: [
          log('warn', `Connecting → Disconnected (WS_CLOSE)`, {
            code: event.code,
            reason: event.reason,
          }),
          { type: 'STOP_PING' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'WS_ERROR':
      return { ctx, effects: [log('warn', 'WS_ERROR during Connecting (waiting for WS_CLOSE)')] };
    case 'DISCONNECT':
      return toIdle(ctx);
    case 'DISPOSE':
      return toDisposed(ctx);
    default:
      return noop(ctx);
  }
}

function handleSyncing(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (event.type) {
    case 'FETCH_SUCCESS': {
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Connected,
        attempt: 0,
        lastRevision: Math.max(event.revision, ctx.lastRevision),
      };
      return {
        ctx: next,
        effects: [
          log('info', `Syncing → Connected`, { revision: event.revision }),
          { type: 'CANCEL_RETRY' },
          { type: 'START_REVISION_POLL' },
        ],
      };
    }
    case 'STATE_UPDATE': {
      // WS broadcast 先于 fetch 到达 — 也可以进入 Connected
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Connected,
        attempt: 0,
        lastRevision: Math.max(event.revision, ctx.lastRevision),
      };
      return {
        ctx: next,
        effects: [
          log('info', `Syncing → Connected (via STATE_UPDATE)`, { revision: event.revision }),
          { type: 'CANCEL_RETRY' },
          { type: 'START_REVISION_POLL' },
        ],
      };
    }
    case 'FETCH_FAILURE': {
      // WS 仍然存活，仅 DB fetch 失败 — 原地重试 fetch，不关闭 WS
      const nextAttempt = ctx.attempt + 1;
      if (nextAttempt >= ctx.maxAttempts) {
        const next: FSMContext = { ...ctx, state: ConnectionState.Failed, attempt: nextAttempt };
        return {
          ctx: next,
          effects: [
            log('error', `Syncing → Failed (max attempts: ${ctx.maxAttempts})`, {
              attempt: nextAttempt,
            }),
            { type: 'CLOSE_WS' },
            { type: 'STOP_PING' },
          ],
        };
      }
      const next: FSMContext = { ...ctx, attempt: nextAttempt };
      const delay = calculateBackoff(nextAttempt);
      return {
        ctx: next,
        effects: [
          log('warn', `FETCH_FAILURE in Syncing, scheduling retry`, {
            attempt: nextAttempt,
            nextDelay: delay,
          }),
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'RETRY_TIMER_FIRED': {
      // Fetch retry timer fired — re-issue fetch, stay in Syncing
      return {
        ctx,
        effects: [
          log('info', `Syncing: retrying fetch`, { attempt: ctx.attempt }),
          { type: 'FETCH_STATE', roomCode: ctx.roomCode! },
        ],
      };
    }
    case 'WS_CLOSE': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Disconnected };
      const delay = calculateBackoff(ctx.attempt);
      return {
        ctx: next,
        effects: [
          log('warn', `Syncing → Disconnected (WS_CLOSE)`),
          { type: 'STOP_PING' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'PING_TIMEOUT': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Disconnected };
      const delay = calculateBackoff(ctx.attempt);
      return {
        ctx: next,
        effects: [
          log('warn', `Syncing → Disconnected (PING_TIMEOUT)`),
          { type: 'CLOSE_WS' },
          { type: 'STOP_PING' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'CONNECT':
      return toConnecting(ctx, event);
    case 'DISCONNECT':
      return toIdle(ctx);
    case 'DISPOSE':
      return toDisposed(ctx);
    default:
      return noop(ctx);
  }
}

function handleConnected(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (event.type) {
    case 'STATE_UPDATE': {
      const next: FSMContext = {
        ...ctx,
        lastRevision: Math.max(event.revision, ctx.lastRevision),
      };
      return { ctx: next, effects: [log('debug', 'STATE_UPDATE', { revision: event.revision })] };
    }
    case 'WS_CLOSE': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Disconnected };
      const delay = calculateBackoff(ctx.attempt);
      return {
        ctx: next,
        effects: [
          log('warn', `Connected → Disconnected (WS_CLOSE)`, {
            code: event.code,
            reason: event.reason,
          }),
          { type: 'STOP_PING' },
          { type: 'STOP_REVISION_POLL' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'PING_TIMEOUT': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Disconnected };
      const delay = calculateBackoff(ctx.attempt);
      return {
        ctx: next,
        effects: [
          log('warn', `Connected → Disconnected (PING_TIMEOUT)`),
          { type: 'CLOSE_WS' },
          { type: 'STOP_PING' },
          { type: 'STOP_REVISION_POLL' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'VISIBILITY_VISIBLE': {
      const next: FSMContext = { ...ctx, visible: true };
      return {
        ctx: next,
        effects: [
          log('info', 'Foreground: fetching state from DB'),
          { type: 'FETCH_STATE', roomCode: ctx.roomCode! },
          { type: 'START_REVISION_POLL' },
          { type: 'START_PING' },
        ],
      };
    }
    case 'VISIBILITY_HIDDEN': {
      const next: FSMContext = { ...ctx, visible: false };
      return {
        ctx: next,
        effects: [
          log('info', 'Background: pausing revision poll + ping'),
          { type: 'STOP_REVISION_POLL' },
          { type: 'STOP_PING' },
        ],
      };
    }
    case 'NETWORK_OFFLINE': {
      const next: FSMContext = { ...ctx, networkOnline: false };
      return { ctx: next, effects: [log('info', 'Network offline (Connected)')] };
    }
    case 'NETWORK_ONLINE': {
      const next: FSMContext = { ...ctx, networkOnline: true };
      return { ctx: next, effects: [log('info', 'Network online (Connected)')] };
    }
    case 'REVISION_DRIFT': {
      return {
        ctx,
        effects: [
          log('info', 'Revision drift detected, fetching full state', {
            dbRevision: event.dbRevision,
            localRevision: ctx.lastRevision,
          }),
          { type: 'FETCH_STATE', roomCode: ctx.roomCode! },
        ],
      };
    }
    case 'FETCH_SUCCESS': {
      // Revision poll fetch success — just update revision
      const next: FSMContext = {
        ...ctx,
        lastRevision: Math.max(event.revision, ctx.lastRevision),
      };
      return { ctx: next, effects: [] };
    }
    case 'FETCH_FAILURE':
      // Non-critical in Connected state — log and continue
      return { ctx, effects: [log('warn', 'Revision fetch failed (Connected)')] };
    case 'CONNECT':
      return toConnecting(ctx, event);
    case 'DISCONNECT':
      return toIdle(ctx);
    case 'DISPOSE':
      return toDisposed(ctx);
    default:
      return noop(ctx);
  }
}

function handleDisconnected(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (event.type) {
    case 'RETRY_TIMER_FIRED': {
      if (!ctx.visible) {
        // Background: suppress reconnection, wait for VISIBILITY_VISIBLE
        return {
          ctx,
          effects: [
            log('info', 'Disconnected: suppressing retry (background)'),
            { type: 'CANCEL_RETRY' },
          ],
        };
      }
      if (ctx.attempt >= ctx.maxAttempts) {
        // Should not happen (timer should not be scheduled after max), but guard anyway
        const next: FSMContext = { ...ctx, state: ConnectionState.Failed };
        return { ctx: next, effects: [log('error', 'Disconnected → Failed (max attempts)')] };
      }
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Reconnecting,
        attempt: ctx.attempt + 1,
      };
      return {
        ctx: next,
        effects: [
          log('info', `Disconnected → Reconnecting`, {
            attempt: next.attempt,
            maxAttempts: ctx.maxAttempts,
          }),
          { type: 'OPEN_WS', roomCode: ctx.roomCode!, userId: ctx.userId! },
        ],
      };
    }
    case 'NETWORK_ONLINE': {
      if (ctx.attempt >= ctx.maxAttempts) {
        const next: FSMContext = { ...ctx, state: ConnectionState.Failed, networkOnline: true };
        return {
          ctx: next,
          effects: [
            log('error', 'Disconnected → Failed (max attempts on NETWORK_ONLINE)'),
            { type: 'CANCEL_RETRY' },
          ],
        };
      }
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Reconnecting,
        attempt: ctx.attempt + 1,
        networkOnline: true,
      };
      return {
        ctx: next,
        effects: [
          log('info', `Disconnected → Reconnecting (NETWORK_ONLINE)`, {
            attempt: next.attempt,
          }),
          { type: 'CANCEL_RETRY' },
          { type: 'OPEN_WS', roomCode: ctx.roomCode!, userId: ctx.userId! },
        ],
      };
    }
    case 'VISIBILITY_VISIBLE': {
      if (ctx.attempt >= ctx.maxAttempts) {
        const next: FSMContext = { ...ctx, state: ConnectionState.Failed, visible: true };
        return {
          ctx: next,
          effects: [
            log('error', 'Disconnected → Failed (max attempts on VISIBILITY_VISIBLE)'),
            { type: 'CANCEL_RETRY' },
          ],
        };
      }
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Reconnecting,
        attempt: ctx.attempt + 1,
        visible: true,
      };
      return {
        ctx: next,
        effects: [
          log('info', `Disconnected → Reconnecting (foreground)`, {
            attempt: next.attempt,
          }),
          { type: 'CANCEL_RETRY' },
          { type: 'OPEN_WS', roomCode: ctx.roomCode!, userId: ctx.userId! },
        ],
      };
    }
    case 'MANUAL_RECONNECT': {
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Reconnecting,
        attempt: 1,
      };
      return {
        ctx: next,
        effects: [
          log('info', `Disconnected → Reconnecting (manual)`),
          { type: 'CANCEL_RETRY' },
          { type: 'OPEN_WS', roomCode: ctx.roomCode!, userId: ctx.userId! },
        ],
      };
    }
    case 'NETWORK_OFFLINE': {
      const next: FSMContext = { ...ctx, networkOnline: false };
      return {
        ctx: next,
        effects: [
          log('info', 'Network offline (Disconnected), cancelling retry timer'),
          { type: 'CANCEL_RETRY' },
        ],
      };
    }
    case 'VISIBILITY_HIDDEN': {
      const next: FSMContext = { ...ctx, visible: false };
      return {
        ctx: next,
        effects: [
          log('info', 'Background (Disconnected), cancelling retry timer'),
          { type: 'CANCEL_RETRY' },
        ],
      };
    }
    case 'CONNECT':
      return toConnecting(ctx, event);
    case 'DISCONNECT':
      return toIdle(ctx);
    case 'DISPOSE':
      return toDisposed(ctx);
    default:
      return noop(ctx);
  }
}

function handleReconnecting(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (event.type) {
    case 'WS_OPEN': {
      // 保留 attempt — 仅在 FETCH_SUCCESS/STATE_UPDATE 到达 Connected 时才清零
      const next: FSMContext = { ...ctx, state: ConnectionState.Syncing };
      return {
        ctx: next,
        effects: [
          log('info', `Reconnecting → Syncing`, { attempt: ctx.attempt }),
          { type: 'START_PING' },
          { type: 'FETCH_STATE', roomCode: ctx.roomCode! },
        ],
      };
    }
    case 'WS_CLOSE': {
      if (ctx.attempt >= ctx.maxAttempts) {
        const next: FSMContext = { ...ctx, state: ConnectionState.Failed };
        return {
          ctx: next,
          effects: [
            log('error', `Reconnecting → Failed (max attempts: ${ctx.maxAttempts})`, {
              attempt: ctx.attempt,
            }),
            { type: 'STOP_PING' },
          ],
        };
      }
      const next: FSMContext = { ...ctx, state: ConnectionState.Disconnected };
      const delay = calculateBackoff(ctx.attempt);
      return {
        ctx: next,
        effects: [
          log('warn', `Reconnecting → Disconnected (WS_CLOSE)`, {
            attempt: ctx.attempt,
            nextDelay: delay,
          }),
          { type: 'STOP_PING' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'WS_ERROR':
      return { ctx, effects: [log('warn', 'WS_ERROR during Reconnecting')] };
    case 'CONNECT':
      return toConnecting(ctx, event);
    case 'DISCONNECT':
      return toIdle(ctx);
    case 'DISPOSE':
      return toDisposed(ctx);
    default:
      return noop(ctx);
  }
}

function handleFailed(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (event.type) {
    case 'MANUAL_RECONNECT': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Reconnecting, attempt: 1 };
      return {
        ctx: next,
        effects: [
          log('info', `Failed → Reconnecting (manual)`),
          { type: 'OPEN_WS', roomCode: ctx.roomCode!, userId: ctx.userId! },
        ],
      };
    }
    case 'NETWORK_ONLINE': {
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Reconnecting,
        attempt: 1,
        networkOnline: true,
      };
      return {
        ctx: next,
        effects: [
          log('info', `Failed → Reconnecting (NETWORK_ONLINE)`),
          { type: 'OPEN_WS', roomCode: ctx.roomCode!, userId: ctx.userId! },
        ],
      };
    }
    case 'VISIBILITY_VISIBLE': {
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Reconnecting,
        attempt: 1,
        visible: true,
      };
      return {
        ctx: next,
        effects: [
          log('info', `Failed → Reconnecting (foreground)`),
          { type: 'OPEN_WS', roomCode: ctx.roomCode!, userId: ctx.userId! },
        ],
      };
    }
    case 'CONNECT':
      return toConnecting(ctx, event);
    case 'DISCONNECT':
      return toIdle(ctx);
    case 'DISPOSE':
      return toDisposed(ctx);
    default:
      return noop(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function noop(ctx: FSMContext): TransitionResult {
  return { ctx, effects: [] };
}

function toIdle(ctx: FSMContext): TransitionResult {
  const next = createInitialContext({ maxAttempts: ctx.maxAttempts });
  const effects: SideEffect[] = [
    log('info', `${ctx.state} → Idle (disconnect)`),
    { type: 'CLOSE_WS' },
    { type: 'CANCEL_RETRY' },
    { type: 'STOP_PING' },
    { type: 'STOP_REVISION_POLL' },
  ];
  return { ctx: next, effects };
}

function toDisposed(ctx: FSMContext): TransitionResult {
  const effects: SideEffect[] = [
    log('info', `${ctx.state} → Disposed`),
    { type: 'CLOSE_WS' },
    { type: 'CANCEL_RETRY' },
    { type: 'STOP_PING' },
    { type: 'STOP_REVISION_POLL' },
  ];
  return { ctx: { ...ctx, state: ConnectionState.Disposed }, effects };
}

/**
 * Global transition: any non-Disposed state → Connecting.
 * Cleans up current state (WS, timers, polls) and starts a fresh connection.
 * Used when CONNECT is dispatched from a non-Idle state (e.g., retry).
 */
function toConnecting(
  ctx: FSMContext,
  event: Extract<ConnectionEvent, { type: 'CONNECT' }>,
): TransitionResult {
  const next: FSMContext = {
    ...ctx,
    state: ConnectionState.Connecting,
    roomCode: event.roomCode,
    userId: event.userId,
    attempt: 0,
    lastRevision: 0,
  };
  return {
    ctx: next,
    effects: [
      log('info', `${ctx.state} → Connecting (CONNECT)`, { roomCode: event.roomCode }),
      { type: 'CLOSE_WS' },
      { type: 'CANCEL_RETRY' },
      { type: 'STOP_PING' },
      { type: 'STOP_REVISION_POLL' },
      { type: 'OPEN_WS', roomCode: event.roomCode, userId: event.userId },
    ],
  };
}

function log(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: Record<string, unknown>,
): SideEffect {
  return { type: 'LOG', level, message: `[ConnectionFSM] ${message}`, data };
}
