/**
 * ConnectionFSM — pure-function connection state machine
 *
 * Input: (context, event) → Output: { ctx, effects }.
 * Zero dependencies (no React / WebSocket / Timer / platform API).
 * All state transitions are verifiable via exhaustive tests.
 *
 * Side effects are executed by ConnectionManager; the FSM itself produces no IO.
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

/**
 * Creates the initial FSM context.
 *
 * @param overrides - optionally override maxAttempts
 */
export function createInitialContext(
  overrides?: Partial<Pick<FSMContext, 'maxAttempts'>>,
): FSMContext {
  return {
    state: ConnectionState.Idle,
    roomCode: null,
    roomId: null,
    attempt: 0,
    maxAttempts: overrides?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    networkOnline: true,
    visible: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition (pure function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure-function state transition.
 *
 * @param ctx - Current FSM context
 * @param event - Incoming event
 * @returns New context + side effects to execute
 */
export function transition(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  if (event.type === 'PROTOCOL_FAILURE') {
    if (ctx.state === ConnectionState.Idle || ctx.state === ConnectionState.Disposed) {
      return noop(ctx);
    }
    return {
      ctx: { ...ctx, state: ConnectionState.Failed },
      effects: [
        log('error', `${ctx.state} → Failed (protocol failure)`, { error: event.error }),
        { type: 'CLOSE_WS' },
        { type: 'CANCEL_RETRY' },
        { type: 'STOP_PING' },
        { type: 'CANCEL_STATE_SYNC' },
      ],
    };
  }

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
      roomId: event.roomId,
      attempt: 0,
    };
    return {
      ctx: next,
      effects: [
        log('info', `Idle → Connecting`, { roomCode: event.roomCode }),
        openWebSocket(next),
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
          { type: 'REQUEST_STATE_SYNC' },
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
    case 'STATE_SYNC_SUCCESS': {
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Connected,
        attempt: 0,
      };
      return {
        ctx: next,
        effects: [
          log('info', `Syncing → Connected`, { revision: event.revision }),
          { type: 'CANCEL_STATE_SYNC' },
          { type: 'CANCEL_RETRY' },
        ],
      };
    }
    case 'STATE_UPDATE': {
      return {
        ctx,
        effects: [
          log('debug', 'STATE_UPDATE while awaiting sync response', {
            revision: event.revision,
          }),
        ],
      };
    }
    case 'STATE_SYNC_TIMEOUT': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Disconnected };
      const delay = calculateBackoff(ctx.attempt);
      return {
        ctx: next,
        effects: [
          log('warn', `Syncing → Disconnected (STATE_SYNC_TIMEOUT)`),
          { type: 'CLOSE_WS' },
          { type: 'STOP_PING' },
          { type: 'CANCEL_STATE_SYNC' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
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
          { type: 'CANCEL_STATE_SYNC' },
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
          { type: 'CANCEL_STATE_SYNC' },
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'VISIBILITY_HIDDEN': {
      const next: FSMContext = {
        ...ctx,
        state: ConnectionState.Disconnected,
        visible: false,
      };
      return {
        ctx: next,
        effects: [
          log('info', 'Syncing → Disconnected (background)'),
          { type: 'CLOSE_WS' },
          { type: 'STOP_PING' },
          { type: 'CANCEL_STATE_SYNC' },
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

function handleConnected(ctx: FSMContext, event: ConnectionEvent): TransitionResult {
  switch (event.type) {
    case 'STATE_UPDATE': {
      return { ctx, effects: [log('debug', 'STATE_UPDATE', { revision: event.revision })] };
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
          { type: 'SCHEDULE_RETRY', delayMs: delay },
        ],
      };
    }
    case 'VISIBILITY_VISIBLE': {
      const next: FSMContext = { ...ctx, state: ConnectionState.Syncing, visible: true };
      return {
        ctx: next,
        effects: [
          log('info', 'Connected → Syncing (foreground)'),
          { type: 'REQUEST_STATE_SYNC' },
          { type: 'START_PING' },
        ],
      };
    }
    case 'VISIBILITY_HIDDEN': {
      const next: FSMContext = { ...ctx, visible: false };
      return {
        ctx: next,
        effects: [log('info', 'Background: pausing ping'), { type: 'STOP_PING' }],
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
          openWebSocket(next),
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
          openWebSocket(next),
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
          openWebSocket(next),
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
          openWebSocket(next),
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
      // Preserve attempt until the correlated sync response transitions to Connected.
      const next: FSMContext = { ...ctx, state: ConnectionState.Syncing };
      return {
        ctx: next,
        effects: [
          log('info', `Reconnecting → Syncing`, { attempt: ctx.attempt }),
          { type: 'START_PING' },
          { type: 'REQUEST_STATE_SYNC' },
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
        effects: [log('info', `Failed → Reconnecting (manual)`), openWebSocket(next)],
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
        effects: [log('info', `Failed → Reconnecting (NETWORK_ONLINE)`), openWebSocket(next)],
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
        effects: [log('info', `Failed → Reconnecting (foreground)`), openWebSocket(next)],
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

function requireRoomIdentity(ctx: FSMContext): { roomCode: string; roomId: string } {
  if (
    ctx.roomCode === null ||
    ctx.roomCode.length === 0 ||
    ctx.roomId === null ||
    ctx.roomId.length === 0
  ) {
    throw new Error(`Connection state ${ctx.state} requires a room identity`);
  }
  return { roomCode: ctx.roomCode, roomId: ctx.roomId };
}

function openWebSocket(ctx: FSMContext): SideEffect {
  return { type: 'OPEN_WS', ...requireRoomIdentity(ctx) };
}

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
    { type: 'CANCEL_STATE_SYNC' },
  ];
  return { ctx: next, effects };
}

function toDisposed(ctx: FSMContext): TransitionResult {
  const effects: SideEffect[] = [
    log('info', `${ctx.state} → Disposed`),
    { type: 'CLOSE_WS' },
    { type: 'CANCEL_RETRY' },
    { type: 'STOP_PING' },
    { type: 'CANCEL_STATE_SYNC' },
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
    roomId: event.roomId,
    attempt: 0,
  };
  return {
    ctx: next,
    effects: [
      log('info', `${ctx.state} → Connecting (CONNECT)`, { roomCode: event.roomCode }),
      { type: 'CLOSE_WS' },
      { type: 'CANCEL_RETRY' },
      { type: 'STOP_PING' },
      { type: 'CANCEL_STATE_SYNC' },
      openWebSocket(next),
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
