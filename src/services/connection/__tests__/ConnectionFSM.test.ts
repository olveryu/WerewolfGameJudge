import { createInitialContext, transition } from '../ConnectionFSM';
import { ConnectionState, DEFAULT_MAX_ATTEMPTS, type FSMContext } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a context in any state with optional overrides */
function ctx(state: ConnectionState, overrides?: Partial<FSMContext>): FSMContext {
  return {
    ...createInitialContext(),
    state,
    roomCode: 'ROOM1',
    roomId: 'room-id-1',
    ...overrides,
  };
}

/** Extract effect types from a transition result */
function effectTypes(result: ReturnType<typeof transition>): string[] {
  return result.effects.map((e) => e.type);
}

/** Check that no state change occurs and no non-LOG effects are produced */
function expectNoop(result: ReturnType<typeof transition>, originalCtx: FSMContext): void {
  expect(result.ctx).toEqual(originalCtx);
  expect(result.effects.filter((e) => e.type !== 'LOG')).toHaveLength(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// createInitialContext
// ─────────────────────────────────────────────────────────────────────────────

describe('createInitialContext', () => {
  it('starts in Idle with defaults', () => {
    const c = createInitialContext();
    expect(c.state).toBe(ConnectionState.Idle);
    expect(c.roomCode).toBeNull();
    expect(c.roomId).toBeNull();
    expect(c.attempt).toBe(0);
    expect(c.maxAttempts).toBe(DEFAULT_MAX_ATTEMPTS);
    expect(c.networkOnline).toBe(true);
    expect(c.visible).toBe(true);
  });

  it('accepts maxAttempts override', () => {
    const c = createInitialContext({ maxAttempts: 5 });
    expect(c.maxAttempts).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Idle
// ─────────────────────────────────────────────────────────────────────────────

describe('Idle state', () => {
  const idle = ctx(ConnectionState.Idle, { roomCode: null, roomId: null });

  it('CONNECT → Connecting + OPEN_WS', () => {
    const result = transition(idle, {
      type: 'CONNECT',
      roomCode: 'R1',
      roomId: 'room-id-r1',
    });
    expect(result.ctx.state).toBe(ConnectionState.Connecting);
    expect(result.ctx.roomCode).toBe('R1');
    expect(result.ctx.attempt).toBe(0);
    expect(effectTypes(result)).toContain('OPEN_WS');
  });

  it.each([
    { type: 'WS_OPEN' as const },
    { type: 'WS_CLOSE' as const, code: 1000, reason: 'ok' },
    { type: 'RETRY_TIMER_FIRED' as const },
    { type: 'MANUAL_RECONNECT' as const },
    { type: 'NETWORK_ONLINE' as const },
  ])('ignores $type', (event) => {
    expectNoop(transition(idle, event), idle);
  });

  it('DISPOSE → Disposed', () => {
    const result = transition(idle, { type: 'DISPOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disposed);
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Connecting
// ─────────────────────────────────────────────────────────────────────────────

describe('Connecting state', () => {
  const connecting = ctx(ConnectionState.Connecting);

  it('WS_OPEN → Syncing + START_PING + REQUEST_STATE_SYNC', () => {
    const result = transition(connecting, { type: 'WS_OPEN' });
    expect(result.ctx.state).toBe(ConnectionState.Syncing);
    const types = effectTypes(result);
    expect(types).toContain('START_PING');
    expect(types).toContain('REQUEST_STATE_SYNC');
  });

  it('WS_CLOSE → Disconnected + STOP_PING + SCHEDULE_RETRY', () => {
    const result = transition(connecting, { type: 'WS_CLOSE', code: 1006, reason: 'abnormal' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    const types = effectTypes(result);
    expect(types).toContain('STOP_PING');
    expect(types).toContain('SCHEDULE_RETRY');
  });

  it('WS_ERROR → stays Connecting (waits for WS_CLOSE)', () => {
    const result = transition(connecting, { type: 'WS_ERROR', error: new Error('fail') });
    expect(result.ctx.state).toBe(ConnectionState.Connecting);
  });

  it('DISCONNECT → Idle + full cleanup', () => {
    const result = transition(connecting, { type: 'DISCONNECT' });
    expect(result.ctx.state).toBe(ConnectionState.Idle);
    expect(result.ctx.roomCode).toBeNull();
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
  });

  it('DISPOSE → Disposed + cleanup effects', () => {
    const result = transition(connecting, { type: 'DISPOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disposed);
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('CANCEL_RETRY');
    expect(types).toContain('STOP_PING');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Syncing
// ─────────────────────────────────────────────────────────────────────────────

describe('Syncing state', () => {
  const syncing = ctx(ConnectionState.Syncing);

  it('STATE_SYNC_SUCCESS → Connected + sync cleanup', () => {
    const result = transition(syncing, { type: 'STATE_SYNC_SUCCESS', revision: 10 });
    expect(result.ctx.state).toBe(ConnectionState.Connected);
    expect(result.ctx.attempt).toBe(0);
    const types = effectTypes(result);
    expect(types).toContain('CANCEL_RETRY');
    expect(types).toContain('CANCEL_STATE_SYNC');
  });

  it('STATE_UPDATE stays Syncing until the correlated response arrives', () => {
    const result = transition(syncing, { type: 'STATE_UPDATE', revision: 7 });
    expect(result.ctx.state).toBe(ConnectionState.Syncing);
    expect(effectTypes(result)).not.toContain('CANCEL_STATE_SYNC');
  });

  it('STATE_SYNC_TIMEOUT → Disconnected + closes socket + schedules retry', () => {
    const s = ctx(ConnectionState.Syncing, { attempt: 2 });
    const result = transition(s, { type: 'STATE_SYNC_TIMEOUT' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    const types = effectTypes(result);
    expect(types).toContain('SCHEDULE_RETRY');
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
    expect(types).toContain('CANCEL_STATE_SYNC');
  });

  it('WS_CLOSE → Disconnected + SCHEDULE_RETRY', () => {
    const result = transition(syncing, { type: 'WS_CLOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    expect(effectTypes(result)).toContain('SCHEDULE_RETRY');
  });

  it('PING_TIMEOUT → Disconnected + CLOSE_WS', () => {
    const result = transition(syncing, { type: 'PING_TIMEOUT' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
    expect(types).toContain('SCHEDULE_RETRY');
  });

  it('VISIBILITY_HIDDEN closes the syncing socket and waits for foreground recovery', () => {
    const result = transition(syncing, { type: 'VISIBILITY_HIDDEN' });

    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    expect(result.ctx.visible).toBe(false);
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
    expect(types).toContain('CANCEL_STATE_SYNC');
    expect(types).toContain('CANCEL_RETRY');
    expect(types).not.toContain('SCHEDULE_RETRY');
  });

  it('DISPOSE → Disposed', () => {
    const result = transition(syncing, { type: 'DISPOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disposed);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Connected
// ─────────────────────────────────────────────────────────────────────────────

describe('Connected state', () => {
  const connected = ctx(ConnectionState.Connected);

  it('STATE_UPDATE → stays Connected', () => {
    const result = transition(connected, { type: 'STATE_UPDATE', revision: 10 });
    expect(result.ctx.state).toBe(ConnectionState.Connected);
  });

  it('WS_CLOSE → Disconnected + stop ping + schedule retry', () => {
    const result = transition(connected, { type: 'WS_CLOSE', code: 1006, reason: '' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    const types = effectTypes(result);
    expect(types).toContain('STOP_PING');
    expect(types).toContain('SCHEDULE_RETRY');
  });

  it('PING_TIMEOUT → Disconnected + CLOSE_WS', () => {
    const result = transition(connected, { type: 'PING_TIMEOUT' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
    expect(types).toContain('SCHEDULE_RETRY');
  });

  it('VISIBILITY_VISIBLE → Syncing + request snapshot + restart ping', () => {
    const c = ctx(ConnectionState.Connected, { visible: false });
    const result = transition(c, { type: 'VISIBILITY_VISIBLE' });
    expect(result.ctx.visible).toBe(true);
    expect(result.ctx.state).toBe(ConnectionState.Syncing);
    const types = effectTypes(result);
    expect(types).toContain('REQUEST_STATE_SYNC');
    expect(types).toContain('START_PING');
  });

  it('VISIBILITY_HIDDEN → stop ping', () => {
    const result = transition(connected, { type: 'VISIBILITY_HIDDEN' });
    expect(result.ctx.visible).toBe(false);
    const types = effectTypes(result);
    expect(types).toContain('STOP_PING');
  });

  it('NETWORK_OFFLINE → set flag, stay Connected', () => {
    const result = transition(connected, { type: 'NETWORK_OFFLINE' });
    expect(result.ctx.state).toBe(ConnectionState.Connected);
    expect(result.ctx.networkOnline).toBe(false);
  });

  it('NETWORK_ONLINE → set flag, stay Connected', () => {
    const c = ctx(ConnectionState.Connected, { networkOnline: false });
    const result = transition(c, { type: 'NETWORK_ONLINE' });
    expect(result.ctx.networkOnline).toBe(true);
  });

  it('DISCONNECT → Idle + full cleanup', () => {
    const result = transition(connected, { type: 'DISCONNECT' });
    expect(result.ctx.state).toBe(ConnectionState.Idle);
    expect(result.ctx.roomCode).toBeNull();
    expect(result.ctx.attempt).toBe(0);
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
  });

  it('DISPOSE → Disposed + full cleanup', () => {
    const result = transition(connected, { type: 'DISPOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disposed);
    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('STOP_PING');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Disconnected
// ─────────────────────────────────────────────────────────────────────────────

describe('Disconnected state', () => {
  const disconnected = ctx(ConnectionState.Disconnected, { attempt: 2 });

  it('RETRY_TIMER_FIRED → Reconnecting + increment attempt + OPEN_WS', () => {
    const result = transition(disconnected, { type: 'RETRY_TIMER_FIRED' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(result.ctx.attempt).toBe(3);
    expect(effectTypes(result)).toContain('OPEN_WS');
  });

  it('RETRY_TIMER_FIRED while background → suppressed + CANCEL_RETRY', () => {
    const d = ctx(ConnectionState.Disconnected, { attempt: 2, visible: false });
    const result = transition(d, { type: 'RETRY_TIMER_FIRED' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    expect(result.ctx.attempt).toBe(2);
    expect(effectTypes(result)).toContain('CANCEL_RETRY');
    expect(effectTypes(result)).not.toContain('OPEN_WS');
  });

  it('RETRY_TIMER_FIRED at maxAttempts → Failed', () => {
    const d = ctx(ConnectionState.Disconnected, { attempt: DEFAULT_MAX_ATTEMPTS });
    const result = transition(d, { type: 'RETRY_TIMER_FIRED' });
    expect(result.ctx.state).toBe(ConnectionState.Failed);
  });

  it('NETWORK_ONLINE → Reconnecting + cancel retry + OPEN_WS', () => {
    const result = transition(disconnected, { type: 'NETWORK_ONLINE' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(result.ctx.networkOnline).toBe(true);
    const types = effectTypes(result);
    expect(types).toContain('CANCEL_RETRY');
    expect(types).toContain('OPEN_WS');
  });

  it('NETWORK_ONLINE at maxAttempts → Failed', () => {
    const d = ctx(ConnectionState.Disconnected, { attempt: DEFAULT_MAX_ATTEMPTS });
    const result = transition(d, { type: 'NETWORK_ONLINE' });
    expect(result.ctx.state).toBe(ConnectionState.Failed);
    expect(effectTypes(result)).toContain('CANCEL_RETRY');
  });

  it('VISIBILITY_VISIBLE at maxAttempts → Failed', () => {
    const d = ctx(ConnectionState.Disconnected, { attempt: DEFAULT_MAX_ATTEMPTS, visible: false });
    const result = transition(d, { type: 'VISIBILITY_VISIBLE' });
    expect(result.ctx.state).toBe(ConnectionState.Failed);
    expect(effectTypes(result)).toContain('CANCEL_RETRY');
  });

  it('VISIBILITY_VISIBLE → Reconnecting + cancel retry + OPEN_WS', () => {
    const d = ctx(ConnectionState.Disconnected, { visible: false, attempt: 1 });
    const result = transition(d, { type: 'VISIBILITY_VISIBLE' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(result.ctx.visible).toBe(true);
    const types = effectTypes(result);
    expect(types).toContain('CANCEL_RETRY');
    expect(types).toContain('OPEN_WS');
  });

  it('MANUAL_RECONNECT → Reconnecting with attempt=1', () => {
    const d = ctx(ConnectionState.Disconnected, { attempt: 10 });
    const result = transition(d, { type: 'MANUAL_RECONNECT' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(result.ctx.attempt).toBe(1);
    const types = effectTypes(result);
    expect(types).toContain('CANCEL_RETRY');
    expect(types).toContain('OPEN_WS');
  });

  it('NETWORK_OFFLINE → cancel retry, stay Disconnected', () => {
    const result = transition(disconnected, { type: 'NETWORK_OFFLINE' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    expect(result.ctx.networkOnline).toBe(false);
    expect(effectTypes(result)).toContain('CANCEL_RETRY');
  });

  it('VISIBILITY_HIDDEN → cancel retry + visible=false, stay Disconnected', () => {
    const result = transition(disconnected, { type: 'VISIBILITY_HIDDEN' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    expect(result.ctx.visible).toBe(false);
    expect(effectTypes(result)).toContain('CANCEL_RETRY');
  });

  it('DISPOSE → Disposed', () => {
    const result = transition(disconnected, { type: 'DISPOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disposed);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reconnecting
// ─────────────────────────────────────────────────────────────────────────────

describe('Reconnecting state', () => {
  const reconnecting = ctx(ConnectionState.Reconnecting, { attempt: 3 });

  it('WS_OPEN → Syncing + START_PING + REQUEST_STATE_SYNC (preserves attempt)', () => {
    const result = transition(reconnecting, { type: 'WS_OPEN' });
    expect(result.ctx.state).toBe(ConnectionState.Syncing);
    expect(result.ctx.attempt).toBe(3);
    const types = effectTypes(result);
    expect(types).toContain('START_PING');
    expect(types).toContain('REQUEST_STATE_SYNC');
  });

  it('WS_CLOSE under maxAttempts → Disconnected + SCHEDULE_RETRY', () => {
    const result = transition(reconnecting, { type: 'WS_CLOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disconnected);
    const types = effectTypes(result);
    expect(types).toContain('STOP_PING');
    expect(types).toContain('SCHEDULE_RETRY');
  });

  it('WS_CLOSE at maxAttempts → Failed', () => {
    const r = ctx(ConnectionState.Reconnecting, { attempt: DEFAULT_MAX_ATTEMPTS });
    const result = transition(r, { type: 'WS_CLOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Failed);
    expect(effectTypes(result)).toContain('STOP_PING');
  });

  it('WS_ERROR → stays Reconnecting', () => {
    const result = transition(reconnecting, { type: 'WS_ERROR' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
  });

  it('DISPOSE → Disposed', () => {
    const result = transition(reconnecting, { type: 'DISPOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disposed);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Failed
// ─────────────────────────────────────────────────────────────────────────────

describe('Failed state', () => {
  const failed = ctx(ConnectionState.Failed, { attempt: DEFAULT_MAX_ATTEMPTS });

  it('MANUAL_RECONNECT → Reconnecting with attempt=1', () => {
    const result = transition(failed, { type: 'MANUAL_RECONNECT' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(result.ctx.attempt).toBe(1);
    expect(effectTypes(result)).toContain('OPEN_WS');
  });

  it('NETWORK_ONLINE → Reconnecting with attempt=1', () => {
    const result = transition(failed, { type: 'NETWORK_ONLINE' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(result.ctx.attempt).toBe(1);
    expect(result.ctx.networkOnline).toBe(true);
    expect(effectTypes(result)).toContain('OPEN_WS');
  });

  it('VISIBILITY_VISIBLE → Reconnecting with attempt=1', () => {
    const f = ctx(ConnectionState.Failed, { attempt: DEFAULT_MAX_ATTEMPTS, visible: false });
    const result = transition(f, { type: 'VISIBILITY_VISIBLE' });
    expect(result.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(result.ctx.attempt).toBe(1);
    expect(result.ctx.visible).toBe(true);
    expect(effectTypes(result)).toContain('OPEN_WS');
  });

  it('DISPOSE → Disposed', () => {
    const result = transition(failed, { type: 'DISPOSE' });
    expect(result.ctx.state).toBe(ConnectionState.Disposed);
  });

  it.each([
    { type: 'WS_OPEN' as const },
    { type: 'RETRY_TIMER_FIRED' as const },
    { type: 'STATE_UPDATE' as const, revision: 1 },
  ])('ignores $type', (event) => {
    expectNoop(transition(failed, event), failed);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Disposed
// ─────────────────────────────────────────────────────────────────────────────

describe('Disposed state', () => {
  const disposed = ctx(ConnectionState.Disposed);

  it.each([
    { type: 'CONNECT' as const, roomCode: 'R', roomId: 'room-id-r' },
    { type: 'WS_OPEN' as const },
    { type: 'WS_CLOSE' as const },
    { type: 'MANUAL_RECONNECT' as const },
    { type: 'RETRY_TIMER_FIRED' as const },
    { type: 'NETWORK_ONLINE' as const },
    { type: 'DISPOSE' as const },
  ])('ignores $type (all events are no-op)', (event) => {
    expectNoop(transition(disposed, event), disposed);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Transition sequences (multi-step scenarios)
// ─────────────────────────────────────────────────────────────────────────────

describe('transition sequences', () => {
  it('happy path: Idle → Connecting → Syncing → Connected', () => {
    let c = createInitialContext();

    // CONNECT
    const r1 = transition(c, {
      type: 'CONNECT',
      roomCode: 'ROOM',
      roomId: 'room-id',
    });
    expect(r1.ctx.state).toBe(ConnectionState.Connecting);
    c = r1.ctx;

    // WS_OPEN
    const r2 = transition(c, { type: 'WS_OPEN' });
    expect(r2.ctx.state).toBe(ConnectionState.Syncing);
    c = r2.ctx;

    // STATE_SYNC_SUCCESS
    const r3 = transition(c, { type: 'STATE_SYNC_SUCCESS', revision: 1 });
    expect(r3.ctx.state).toBe(ConnectionState.Connected);
  });

  it('disconnect → auto retry → reconnect', () => {
    const connected = ctx(ConnectionState.Connected);

    // WS_CLOSE
    const r1 = transition(connected, { type: 'WS_CLOSE', code: 1006, reason: '' });
    expect(r1.ctx.state).toBe(ConnectionState.Disconnected);

    // RETRY_TIMER_FIRED
    const r2 = transition(r1.ctx, { type: 'RETRY_TIMER_FIRED' });
    expect(r2.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(r2.ctx.attempt).toBe(1);

    // WS_OPEN
    const r3 = transition(r2.ctx, { type: 'WS_OPEN' });
    expect(r3.ctx.state).toBe(ConnectionState.Syncing);

    // STATE_SYNC_SUCCESS
    const r4 = transition(r3.ctx, { type: 'STATE_SYNC_SUCCESS', revision: 10 });
    expect(r4.ctx.state).toBe(ConnectionState.Connected);
    expect(r4.ctx.attempt).toBe(0);
  });

  it('exhaust retries → Failed → manual reconnect', () => {
    const d = ctx(ConnectionState.Disconnected, { attempt: DEFAULT_MAX_ATTEMPTS });

    // At max attempts → Failed
    const r1 = transition(d, { type: 'RETRY_TIMER_FIRED' });
    expect(r1.ctx.state).toBe(ConnectionState.Failed);

    // Manual reconnect resets attempt to 1
    const r2 = transition(r1.ctx, { type: 'MANUAL_RECONNECT' });
    expect(r2.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(r2.ctx.attempt).toBe(1);
  });

  it('background → foreground requests an authoritative snapshot', () => {
    const c = ctx(ConnectionState.Connected, { visible: true });

    // Background
    const r1 = transition(c, { type: 'VISIBILITY_HIDDEN' });
    expect(r1.ctx.visible).toBe(false);
    expect(effectTypes(r1)).toContain('STOP_PING');

    // Foreground
    const r2 = transition(r1.ctx, { type: 'VISIBILITY_VISIBLE' });
    expect(r2.ctx.visible).toBe(true);
    expect(r2.ctx.state).toBe(ConnectionState.Syncing);
    expect(effectTypes(r2)).toContain('REQUEST_STATE_SYNC');
    expect(effectTypes(r2)).toContain('START_PING');
  });

  it('reconnect → WS ok → sync timeout → retry socket → sync succeeds', () => {
    // Start reconnecting at attempt 3
    const r = ctx(ConnectionState.Reconnecting, { attempt: 3 });

    // WS_OPEN → Syncing (attempt preserved)
    const r1 = transition(r, { type: 'WS_OPEN' });
    expect(r1.ctx.state).toBe(ConnectionState.Syncing);
    expect(r1.ctx.attempt).toBe(3);

    // Sync timeout closes the socket and schedules a reconnect.
    const r2 = transition(r1.ctx, { type: 'STATE_SYNC_TIMEOUT' });
    expect(r2.ctx.state).toBe(ConnectionState.Disconnected);
    expect(r2.ctx.attempt).toBe(3);
    expect(effectTypes(r2)).toContain('SCHEDULE_RETRY');

    // RETRY_TIMER_FIRED → reopen socket.
    const r3 = transition(r2.ctx, { type: 'RETRY_TIMER_FIRED' });
    expect(r3.ctx.state).toBe(ConnectionState.Reconnecting);
    expect(effectTypes(r3)).toContain('OPEN_WS');

    const r4 = transition(r3.ctx, { type: 'WS_OPEN' });
    expect(r4.ctx.state).toBe(ConnectionState.Syncing);
    const r5 = transition(r4.ctx, { type: 'STATE_SYNC_SUCCESS', revision: 20 });
    expect(r5.ctx.state).toBe(ConnectionState.Connected);
    expect(r5.ctx.attempt).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONNECT as global transition (from any non-Idle/non-Disposed state)
// ─────────────────────────────────────────────────────────────────────────────

describe('CONNECT from non-Idle states (global transition)', () => {
  const connectEvent = {
    type: 'CONNECT' as const,
    roomCode: 'NEW',
    roomId: 'room-id-new',
  };

  it.each([
    ConnectionState.Connecting,
    ConnectionState.Syncing,
    ConnectionState.Connected,
    ConnectionState.Disconnected,
    ConnectionState.Reconnecting,
    ConnectionState.Failed,
  ])('%s → Connecting + full cleanup + OPEN_WS', (state) => {
    const c = ctx(state, { attempt: 5 });
    const result = transition(c, connectEvent);

    expect(result.ctx.state).toBe(ConnectionState.Connecting);
    expect(result.ctx.roomCode).toBe('NEW');
    expect(result.ctx.attempt).toBe(0);

    const types = effectTypes(result);
    expect(types).toContain('CLOSE_WS');
    expect(types).toContain('CANCEL_RETRY');
    expect(types).toContain('STOP_PING');
    expect(types).toContain('CANCEL_STATE_SYNC');
    expect(types).toContain('OPEN_WS');
  });

  it('Disposed ignores CONNECT', () => {
    const disposed = ctx(ConnectionState.Disposed);
    expectNoop(transition(disposed, connectEvent), disposed);
  });
});

describe('PROTOCOL_FAILURE', () => {
  it.each([
    ConnectionState.Connecting,
    ConnectionState.Syncing,
    ConnectionState.Connected,
    ConnectionState.Disconnected,
    ConnectionState.Reconnecting,
    ConnectionState.Failed,
  ])('%s fails immediately and cancels every connection effect', (state) => {
    const result = transition(ctx(state), {
      type: 'PROTOCOL_FAILURE',
      error: new Error('invalid protocol payload'),
    });

    expect(result.ctx.state).toBe(ConnectionState.Failed);
    expect(effectTypes(result)).toEqual(
      expect.arrayContaining(['CLOSE_WS', 'CANCEL_RETRY', 'STOP_PING']),
    );
  });

  it.each([ConnectionState.Idle, ConnectionState.Disposed])(
    '%s ignores stale failures',
    (state) => {
      const current = ctx(state);
      expectNoop(
        transition(current, { type: 'PROTOCOL_FAILURE', error: new Error('stale') }),
        current,
      );
    },
  );
});
