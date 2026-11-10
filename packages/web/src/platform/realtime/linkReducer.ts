/**
 * linkReducer — pure connection state machine for one room socket.
 *
 * Six statuses: idle | connecting | syncing | live | waiting | closed. Environment changes,
 * timers and manual retries all funnel through one gate: an attempt is made only while the app
 * is visible and online; going offline drops an open socket at once. Reconnection is unbounded;
 * only terminal close codes stop it.
 *
 * Effects are data; `LinkRuntime` executes them. No I/O, no timers, no Date here.
 */
import { readTerminalCloseReason } from '@game-judge/game-engine/platform/realtime/closeCodes';

import type { LinkStatus } from './types';

// ─── Tunables (sources in docs/realtime-link-redesign.md §4) ────────────────

/** First retry is immediate; later retries use full-jitter exponential backoff. */
const BACKOFF_BASE_MS = 1_000;
/** PartySocket default maxReconnectionDelay. */
export const BACKOFF_CAP_MS = 10_000;
/** PartySocket default minUptime: the attempt counter resets only after this much live time. */
export const MIN_UPTIME_MS = 5_000;
export const SOCKET_OPEN_TIMEOUT_MS = 8_000;
export const SYNC_TIMEOUT_MS = 5_000;
export const PING_INTERVAL_MS = 25_000;
export const PONG_TIMEOUT_MS = 10_000;
/** Hidden for less than this → resync on the existing socket; longer → open a new one. */
export const FAST_RESUME_MAX_HIDDEN_MS = 20_000;

// ─── Context ────────────────────────────────────────────────────────────────

export interface LinkContext {
  readonly status: LinkStatus;
  readonly online: boolean;
  readonly visible: boolean;
  /** Timestamp the app was last hidden; null while visible. */
  readonly hiddenSinceMs: number | null;
  /** Consecutive failed attempts since the last stable live period. */
  readonly attempt: number;
  /** Timestamp the current live period started; null when not live. */
  readonly liveSinceMs: number | null;
  readonly knownRevision: number | null;
  /** Increments on every OPEN_SOCKET; stale socket events carry an older generation. */
  readonly socketGeneration: number;
  readonly pendingSyncRequestId: string | null;
}

export type TimerKind = 'open' | 'sync' | 'retry' | 'ping' | 'pong';

export type LinkEvent =
  | { readonly type: 'CONNECT' }
  | { readonly type: 'SOCKET_OPEN'; readonly generation: number }
  | {
      readonly type: 'SOCKET_CLOSED';
      readonly generation: number;
      readonly code: number;
    }
  | { readonly type: 'SYNC_RESULT'; readonly generation: number; readonly requestId: string }
  | { readonly type: 'STATE_UPDATE'; readonly generation: number }
  | { readonly type: 'PONG'; readonly generation: number }
  | { readonly type: 'TIMER'; readonly kind: TimerKind }
  | { readonly type: 'ENV'; readonly online: boolean; readonly visible: boolean }
  | { readonly type: 'REVISION'; readonly revision: number }
  | { readonly type: 'RETRY_NOW' }
  | { readonly type: 'PROTOCOL_ERROR' }
  | { readonly type: 'CLOSE' };

export type LinkEffect =
  | { readonly type: 'OPEN_SOCKET'; readonly generation: number }
  | { readonly type: 'CLOSE_SOCKET'; readonly generation: number; readonly code: number }
  | {
      readonly type: 'SEND_SYNC';
      readonly generation: number;
      readonly requestId: string;
      readonly knownRevision: number | null;
    }
  | { readonly type: 'SEND_PING'; readonly generation: number }
  | { readonly type: 'ARM_TIMER'; readonly kind: TimerKind; readonly atMs: number }
  | { readonly type: 'DISARM_TIMER'; readonly kind: TimerKind };

export interface ReducerInput {
  readonly nowMs: number;
  /** Uniform random in [0, 1); injected for deterministic tests. */
  readonly random: () => number;
  readonly newRequestId: () => string;
}

export interface Transition {
  readonly context: LinkContext;
  readonly effects: readonly LinkEffect[];
}

export function createInitialContext(env: {
  readonly online: boolean;
  readonly visible: boolean;
  readonly nowMs: number;
}): LinkContext {
  return {
    status: { kind: 'idle' },
    online: env.online,
    visible: env.visible,
    hiddenSinceMs: env.visible ? null : env.nowMs,
    attempt: 0,
    liveSinceMs: null,
    knownRevision: null,
    socketGeneration: 0,
    pendingSyncRequestId: null,
  };
}

/** Full-jitter backoff: random in [0, min(cap, base·2^attempt)); attempt 0 is immediate. */
export function computeBackoffMs(attempt: number, random: () => number): number {
  if (attempt === 0) return 0;
  const cap = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  return Math.floor(random() * cap);
}

const DISARM_ALL: readonly LinkEffect[] = (['open', 'sync', 'retry', 'ping', 'pong'] as const).map(
  (kind) => ({ type: 'DISARM_TIMER', kind }),
);

function canAttempt(context: LinkContext): boolean {
  return context.online && context.visible;
}

function waitingCause(context: LinkContext): 'offline' | 'hidden' {
  return context.online ? 'hidden' : 'offline';
}

// ─── Transition ─────────────────────────────────────────────────────────────

export function reduceLink(
  context: LinkContext,
  event: LinkEvent,
  input: ReducerInput,
): Transition {
  if (context.status.kind === 'closed') return { context, effects: [] };

  switch (event.type) {
    case 'CONNECT':
      return connect(context, input);
    case 'CLOSE':
      return close(context, 'released', 1000);
    case 'PROTOCOL_ERROR':
      return close(context, 'protocol', 1002);
    case 'ENV':
      return environment(context, event, input);
    case 'REVISION':
      return { context: { ...context, knownRevision: event.revision }, effects: [] };
    case 'RETRY_NOW':
      return retryNow(context, input);
    case 'TIMER':
      return timer(context, event.kind, input);
    case 'SOCKET_OPEN':
    case 'SOCKET_CLOSED':
    case 'SYNC_RESULT':
    case 'STATE_UPDATE':
    case 'PONG':
      if (event.generation !== context.socketGeneration) return { context, effects: [] };
      return socketEvent(context, event, input);
  }
}

function connect(context: LinkContext, input: ReducerInput): Transition {
  if (context.status.kind !== 'idle') {
    throw new Error(`[FAIL-FAST] CONNECT requires idle, received ${context.status.kind}`);
  }
  return attemptOrWait({ ...context, attempt: 0 }, input);
}

function close(context: LinkContext, reason: 'released' | 'protocol', code: number): Transition {
  const effects: LinkEffect[] = [...DISARM_ALL];
  if (context.status.kind !== 'idle' && context.status.kind !== 'waiting') {
    effects.push({ type: 'CLOSE_SOCKET', generation: context.socketGeneration, code });
  }
  return {
    context: {
      ...context,
      status: { kind: 'closed', reason },
      liveSinceMs: null,
      pendingSyncRequestId: null,
    },
    effects,
  };
}

function attemptOrWait(context: LinkContext, input: ReducerInput): Transition {
  if (!canAttempt(context)) {
    return {
      context: {
        ...context,
        status: {
          kind: 'waiting',
          cause: waitingCause(context),
          attempt: context.attempt,
          nextRetryAtMs: null,
        },
      },
      effects: [{ type: 'DISARM_TIMER', kind: 'retry' }],
    };
  }
  const delayMs = computeBackoffMs(context.attempt, input.random);
  if (delayMs === 0) return openSocket(context, input);
  const nextRetryAtMs = input.nowMs + delayMs;
  return {
    context: {
      ...context,
      status: { kind: 'waiting', cause: 'backoff', attempt: context.attempt, nextRetryAtMs },
    },
    effects: [{ type: 'ARM_TIMER', kind: 'retry', atMs: nextRetryAtMs }],
  };
}

function openSocket(context: LinkContext, input: ReducerInput): Transition {
  const generation = context.socketGeneration + 1;
  return {
    context: {
      ...context,
      status: { kind: 'connecting', attempt: context.attempt },
      socketGeneration: generation,
      pendingSyncRequestId: null,
    },
    effects: [
      { type: 'DISARM_TIMER', kind: 'retry' },
      { type: 'OPEN_SOCKET', generation },
      { type: 'ARM_TIMER', kind: 'open', atMs: input.nowMs + SOCKET_OPEN_TIMEOUT_MS },
    ],
  };
}

/** Drop the current socket (if any) and schedule the next attempt with one more failure counted. */
function failAttempt(context: LinkContext, input: ReducerInput, closeCode: number): Transition {
  const effects: LinkEffect[] = [...DISARM_ALL];
  if (hasOpenSocket(context)) {
    effects.push({ type: 'CLOSE_SOCKET', generation: context.socketGeneration, code: closeCode });
  }
  const next = attemptOrWait(
    {
      ...context,
      attempt: nextAttempt(context, input.nowMs),
      liveSinceMs: null,
      pendingSyncRequestId: null,
    },
    input,
  );
  return { context: next.context, effects: [...effects, ...next.effects] };
}

/** Replace the current socket right away (user-visible resume); the failure counter restarts. */
function reopenNow(context: LinkContext, input: ReducerInput): Transition {
  const effects: LinkEffect[] = [...DISARM_ALL];
  if (hasOpenSocket(context)) {
    effects.push({ type: 'CLOSE_SOCKET', generation: context.socketGeneration, code: 1000 });
  }
  const next = openSocket(
    { ...context, attempt: 0, liveSinceMs: null, pendingSyncRequestId: null },
    input,
  );
  return { context: next.context, effects: [...effects, ...next.effects] };
}

function hasOpenSocket(context: LinkContext): boolean {
  const { kind } = context.status;
  return kind === 'connecting' || kind === 'syncing' || kind === 'live';
}

/** After a stable live period the counter restarts at 1; otherwise it keeps growing. */
function nextAttempt(context: LinkContext, nowMs: number): number {
  const wasStable = context.liveSinceMs !== null && nowMs - context.liveSinceMs >= MIN_UPTIME_MS;
  return wasStable ? 1 : context.attempt + 1;
}

function startSync(context: LinkContext, input: ReducerInput): Transition {
  const requestId = input.newRequestId();
  return {
    context: { ...context, status: { kind: 'syncing' }, pendingSyncRequestId: requestId },
    effects: [
      { type: 'DISARM_TIMER', kind: 'open' },
      { type: 'DISARM_TIMER', kind: 'ping' },
      { type: 'DISARM_TIMER', kind: 'pong' },
      {
        type: 'SEND_SYNC',
        generation: context.socketGeneration,
        requestId,
        knownRevision: context.knownRevision,
      },
      { type: 'ARM_TIMER', kind: 'sync', atMs: input.nowMs + SYNC_TIMEOUT_MS },
    ],
  };
}

function armPing(context: LinkContext, nowMs: number): readonly LinkEffect[] {
  if (!context.visible)
    return [
      { type: 'DISARM_TIMER', kind: 'ping' },
      { type: 'DISARM_TIMER', kind: 'pong' },
    ];
  return [
    { type: 'DISARM_TIMER', kind: 'pong' },
    { type: 'ARM_TIMER', kind: 'ping', atMs: nowMs + PING_INTERVAL_MS },
  ];
}

function socketEvent(
  context: LinkContext,
  event: Extract<LinkEvent, { readonly generation: number }>,
  input: ReducerInput,
): Transition {
  const { status } = context;
  switch (event.type) {
    case 'SOCKET_OPEN':
      if (status.kind !== 'connecting') {
        throw new Error(`[FAIL-FAST] SOCKET_OPEN while ${status.kind}`);
      }
      return startSync(context, input);

    case 'SOCKET_CLOSED': {
      const terminal = readTerminalCloseReason(event.code);
      if (terminal !== null) {
        return {
          context: {
            ...context,
            status: { kind: 'closed', reason: terminal },
            liveSinceMs: null,
            pendingSyncRequestId: null,
          },
          effects: [...DISARM_ALL],
        };
      }
      if (status.kind === 'waiting' || status.kind === 'idle') return { context, effects: [] };
      // The socket is already gone; count the failure without issuing CLOSE_SOCKET.
      const next = attemptOrWait(
        {
          ...context,
          attempt: nextAttempt(context, input.nowMs),
          liveSinceMs: null,
          pendingSyncRequestId: null,
        },
        input,
      );
      return { context: next.context, effects: [...DISARM_ALL, ...next.effects] };
    }

    case 'SYNC_RESULT': {
      if (status.kind !== 'syncing') {
        throw new Error(`[FAIL-FAST] SYNC_RESULT while ${status.kind}`);
      }
      if (event.requestId !== context.pendingSyncRequestId) {
        return close(context, 'protocol', 1002);
      }
      return {
        context: {
          ...context,
          status: { kind: 'live' },
          liveSinceMs: input.nowMs,
          pendingSyncRequestId: null,
        },
        effects: [{ type: 'DISARM_TIMER', kind: 'sync' }, ...armPing(context, input.nowMs)],
      };
    }

    case 'STATE_UPDATE':
      // Inbound traffic proves liveness; a sync barrier is not crossed by broadcasts.
      if (status.kind !== 'live') return { context, effects: [] };
      return { context, effects: armPing(context, input.nowMs) };

    case 'PONG':
      if (status.kind !== 'live') return { context, effects: [] };
      return { context, effects: armPing(context, input.nowMs) };
  }
}

function timer(context: LinkContext, kind: TimerKind, input: ReducerInput): Transition {
  const { status } = context;
  switch (kind) {
    case 'retry':
      if (status.kind !== 'waiting' || status.cause !== 'backoff') return { context, effects: [] };
      return openSocket(context, input);
    case 'open':
      if (status.kind !== 'connecting') return { context, effects: [] };
      return failAttempt(context, input, 1000);
    case 'sync':
      if (status.kind !== 'syncing') return { context, effects: [] };
      return failAttempt(context, input, 1000);
    case 'ping':
      if (status.kind !== 'live' || !context.visible) return { context, effects: [] };
      return {
        context,
        effects: [
          { type: 'SEND_PING', generation: context.socketGeneration },
          { type: 'ARM_TIMER', kind: 'pong', atMs: input.nowMs + PONG_TIMEOUT_MS },
        ],
      };
    case 'pong':
      if (status.kind !== 'live') return { context, effects: [] };
      return failAttempt(context, input, 1000);
  }
}

function retryNow(context: LinkContext, input: ReducerInput): Transition {
  // The button renders only while waiting; a press that lands after the retry timer fired is a race.
  if (context.status.kind !== 'waiting') return { context, effects: [] };
  const reset = { ...context, attempt: 0 };
  if (!canAttempt(reset)) return attemptOrWait(reset, input);
  return openSocket(reset, input);
}

function environment(
  context: LinkContext,
  event: Extract<LinkEvent, { readonly type: 'ENV' }>,
  input: ReducerInput,
): Transition {
  const becameVisible = event.visible && !context.visible;
  const becameHidden = !event.visible && context.visible;
  const next: LinkContext = {
    ...context,
    online: event.online,
    visible: event.visible,
    hiddenSinceMs: becameHidden ? input.nowMs : event.visible ? null : context.hiddenSinceMs,
  };
  const { status } = next;

  if (status.kind === 'idle') return { context: next, effects: [] };

  // The platform says the network is gone: the socket cannot survive it, so drop it now and
  // wait on the environment instead of discovering the loss through the ping/pong timers.
  if (!next.online && hasOpenSocket(next)) return failAttempt(next, input, 1000);

  if (status.kind === 'waiting') {
    if (!canAttempt(next)) {
      return {
        context: {
          ...next,
          status: {
            kind: 'waiting',
            cause: waitingCause(next),
            attempt: next.attempt,
            nextRetryAtMs: null,
          },
        },
        effects: [{ type: 'DISARM_TIMER', kind: 'retry' }],
      };
    }
    if (status.cause === 'backoff') return { context: next, effects: [] };
    // Environment just allowed an attempt: the first one is immediate, later ones back off.
    return attemptOrWait(next, input);
  }

  if (status.kind === 'live') {
    if (becameHidden) {
      return {
        context: next,
        effects: [
          { type: 'DISARM_TIMER', kind: 'ping' },
          { type: 'DISARM_TIMER', kind: 'pong' },
        ],
      };
    }
    if (becameVisible) {
      const hiddenForMs = context.hiddenSinceMs === null ? 0 : input.nowMs - context.hiddenSinceMs;
      if (hiddenForMs < FAST_RESUME_MAX_HIDDEN_MS) return startSync(next, input);
      return reopenNow(next, input);
    }
    return { context: next, effects: [] };
  }

  // connecting / syncing: let the in-flight attempt run to its own timer.
  return { context: next, effects: [] };
}
