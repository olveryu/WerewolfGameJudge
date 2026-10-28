import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';

import {
  BACKOFF_CAP_MS,
  computeBackoffMs,
  createInitialContext,
  FAST_RESUME_MAX_HIDDEN_MS,
  type LinkContext,
  type LinkEffect,
  type LinkEvent,
  MIN_UPTIME_MS,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  reduceLink,
  SOCKET_OPEN_TIMEOUT_MS,
  SYNC_TIMEOUT_MS,
} from '@/platform/realtime/linkReducer';

const T0 = 1_000_000;
let requestCounter = 0;
const input = (nowMs = T0, random = () => 0.5) => ({
  nowMs,
  random,
  newRequestId: () => `req-${++requestCounter}`,
});

function initial(overrides?: Partial<{ online: boolean; visible: boolean }>): LinkContext {
  return createInitialContext({
    online: overrides?.online ?? true,
    visible: overrides?.visible ?? true,
    nowMs: T0,
  });
}

function run(context: LinkContext, events: readonly LinkEvent[], nowMs = T0) {
  let current = context;
  let effects: readonly LinkEffect[] = [];
  for (const event of events) {
    const transition = reduceLink(current, event, input(nowMs));
    current = transition.context;
    effects = transition.effects;
  }
  return { context: current, effects };
}

/** idle → connecting(gen 1) → syncing → live, returning the live context. */
function goLive(context = initial(), nowMs = T0): LinkContext {
  const { context: connecting } = run(context, [{ type: 'CONNECT' }], nowMs);
  const { context: syncing } = run(connecting, [{ type: 'SOCKET_OPEN', generation: 1 }], nowMs);
  const requestId = syncing.pendingSyncRequestId;
  if (requestId === null) throw new Error('expected a pending sync request');
  return run(syncing, [{ type: 'SYNC_RESULT', generation: 1, requestId }], nowMs).context;
}

beforeEach(() => {
  requestCounter = 0;
});

describe('computeBackoffMs', () => {
  it('is immediate for attempt 0 and full-jitter capped afterwards', () => {
    expect(computeBackoffMs(0, () => 0.99)).toBe(0);
    expect(computeBackoffMs(1, () => 0.5)).toBe(500);
    expect(computeBackoffMs(2, () => 0.5)).toBe(1_000);
    expect(computeBackoffMs(10, () => 0.999)).toBeLessThan(BACKOFF_CAP_MS);
    expect(computeBackoffMs(10, () => 0)).toBe(0);
  });
});

describe('linkReducer happy path', () => {
  it('CONNECT opens a socket immediately when visible and online', () => {
    const { context, effects } = run(initial(), [{ type: 'CONNECT' }]);
    expect(context.status).toEqual({ kind: 'connecting', attempt: 0 });
    expect(context.socketGeneration).toBe(1);
    expect(effects).toEqual([
      { type: 'DISARM_TIMER', kind: 'retry' },
      { type: 'OPEN_SOCKET', generation: 1 },
      { type: 'ARM_TIMER', kind: 'open', atMs: T0 + SOCKET_OPEN_TIMEOUT_MS },
    ]);
  });

  it('SOCKET_OPEN sends SYNC with the known revision and arms the sync deadline', () => {
    const connecting = run(initial(), [
      { type: 'CONNECT' },
      { type: 'REVISION', revision: 7 },
    ]).context;
    const { context, effects } = run(connecting, [{ type: 'SOCKET_OPEN', generation: 1 }]);
    expect(context.status).toEqual({ kind: 'syncing' });
    expect(effects).toContainEqual({
      type: 'SEND_SYNC',
      generation: 1,
      requestId: context.pendingSyncRequestId,
      knownRevision: 7,
    });
    expect(effects).toContainEqual({ type: 'ARM_TIMER', kind: 'sync', atMs: T0 + SYNC_TIMEOUT_MS });
  });

  it('a matching SYNC_RESULT goes live and arms ping; a mismatch is a protocol close', () => {
    const live = goLive();
    expect(live.status).toEqual({ kind: 'live' });
    expect(live.liveSinceMs).toBe(T0);

    const syncing = run(initial(), [
      { type: 'CONNECT' },
      { type: 'SOCKET_OPEN', generation: 1 },
    ]).context;
    const { context, effects } = run(syncing, [
      { type: 'SYNC_RESULT', generation: 1, requestId: 'someone-else' },
    ]);
    expect(context.status).toEqual({ kind: 'closed', reason: 'protocol' });
    expect(effects).toContainEqual({ type: 'CLOSE_SOCKET', generation: 1, code: 1002 });
  });

  it('ignores socket events from a superseded generation', () => {
    const live = goLive();
    const { context, effects } = run(live, [{ type: 'SOCKET_CLOSED', generation: 0, code: 1006 }]);
    expect(context).toBe(live);
    expect(effects).toEqual([]);
  });
});

describe('linkReducer keepalive', () => {
  it('ping timer sends ping and arms pong; pong re-arms ping; pong timeout drops the socket', () => {
    const live = goLive();
    const pinged = run(live, [{ type: 'TIMER', kind: 'ping' }], T0 + PING_INTERVAL_MS);
    expect(pinged.effects).toEqual([
      { type: 'SEND_PING', generation: 1 },
      { type: 'ARM_TIMER', kind: 'pong', atMs: T0 + PING_INTERVAL_MS + PONG_TIMEOUT_MS },
    ]);

    const ponged = run(
      pinged.context,
      [{ type: 'PONG', generation: 1 }],
      T0 + PING_INTERVAL_MS + 100,
    );
    expect(ponged.effects).toContainEqual({
      type: 'ARM_TIMER',
      kind: 'ping',
      atMs: T0 + PING_INTERVAL_MS + 100 + PING_INTERVAL_MS,
    });

    const dropped = run(pinged.context, [{ type: 'TIMER', kind: 'pong' }], T0 + 40_000);
    expect(dropped.effects).toContainEqual({ type: 'CLOSE_SOCKET', generation: 1, code: 1000 });
    expect(dropped.context.status.kind).toBe('waiting');
  });

  it('inbound STATE_UPDATE counts as liveness and re-arms ping', () => {
    const live = goLive();
    const { effects } = run(live, [{ type: 'STATE_UPDATE', generation: 1 }], T0 + 5);
    expect(effects).toContainEqual({
      type: 'ARM_TIMER',
      kind: 'ping',
      atMs: T0 + 5 + PING_INTERVAL_MS,
    });
  });
});

describe('linkReducer reconnection', () => {
  it('a drop before stable uptime increments attempt and backs off with jitter', () => {
    const live = goLive();
    const { context, effects } = run(
      live,
      [{ type: 'SOCKET_CLOSED', generation: 1, code: 1006 }],
      T0 + 1_000,
    );
    expect(context.attempt).toBe(1);
    expect(context.status).toEqual({
      kind: 'waiting',
      cause: 'backoff',
      attempt: 1,
      nextRetryAtMs: T0 + 1_000 + 500,
    });
    expect(effects).toContainEqual({ type: 'ARM_TIMER', kind: 'retry', atMs: T0 + 1_000 + 500 });
  });

  it('a drop after MIN_UPTIME restarts the attempt counter at 1', () => {
    let live = goLive();
    for (let i = 0; i < 3; i += 1) {
      const dropped = run(live, [
        { type: 'SOCKET_CLOSED', generation: live.socketGeneration, code: 1006 },
      ]);
      const reopened = run(dropped.context, [{ type: 'TIMER', kind: 'retry' }]);
      const opened = run(reopened.context, [
        { type: 'SOCKET_OPEN', generation: reopened.context.socketGeneration },
      ]);
      const requestId = opened.context.pendingSyncRequestId;
      if (requestId === null) throw new Error('expected sync');
      live = run(opened.context, [
        { type: 'SYNC_RESULT', generation: opened.context.socketGeneration, requestId },
      ]).context;
    }
    expect(live.attempt).toBe(3);

    const afterStable = run(
      live,
      [{ type: 'SOCKET_CLOSED', generation: live.socketGeneration, code: 1006 }],
      T0 + MIN_UPTIME_MS,
    );
    expect(afterStable.context.attempt).toBe(1);
  });

  it('retry timer opens a new socket generation; there is no attempt ceiling', () => {
    let context = goLive();
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      context = run(context, [
        { type: 'SOCKET_CLOSED', generation: context.socketGeneration, code: 1006 },
      ]).context;
      expect(context.status.kind).toBe('waiting');
      context = run(context, [{ type: 'TIMER', kind: 'retry' }]).context;
      expect(context.status).toEqual({ kind: 'connecting', attempt });
    }
    expect(context.socketGeneration).toBe(41);
  });

  it('open and sync deadlines count as failed attempts', () => {
    const connecting = run(initial(), [{ type: 'CONNECT' }]).context;
    const openTimedOut = run(connecting, [{ type: 'TIMER', kind: 'open' }]);
    expect(openTimedOut.effects).toContainEqual({
      type: 'CLOSE_SOCKET',
      generation: 1,
      code: 1000,
    });
    expect(openTimedOut.context.attempt).toBe(1);

    const syncing = run(connecting, [{ type: 'SOCKET_OPEN', generation: 1 }]).context;
    const syncTimedOut = run(syncing, [{ type: 'TIMER', kind: 'sync' }]);
    expect(syncTimedOut.context.attempt).toBe(1);
    expect(syncTimedOut.context.pendingSyncRequestId).toBeNull();
  });

  it('RETRY_NOW resets the attempt counter and opens immediately', () => {
    const waiting = run(goLive(), [{ type: 'SOCKET_CLOSED', generation: 1, code: 1006 }]).context;
    const { context, effects } = run(waiting, [{ type: 'RETRY_NOW' }]);
    expect(context.status).toEqual({ kind: 'connecting', attempt: 0 });
    expect(effects).toContainEqual({ type: 'OPEN_SOCKET', generation: 2 });
    expect(() => run(context, [{ type: 'RETRY_NOW' }])).toThrow('[FAIL-FAST]');
  });
});

describe('linkReducer terminal closes', () => {
  it.each([
    [REALTIME_CLOSE_CODE.ROOM_DELETED, 'roomDeleted'],
    [REALTIME_CLOSE_CODE.ROOM_INSTANCE_MISMATCH, 'instanceMismatch'],
    [REALTIME_CLOSE_CODE.AUTH_REJECTED, 'authRejected'],
    [REALTIME_CLOSE_CODE.STATE_UNAVAILABLE, 'stateUnavailable'],
    [REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol'],
  ])('close code %i ends the link with reason %s and ignores later events', (code, reason) => {
    const live = goLive();
    const { context, effects } = run(live, [{ type: 'SOCKET_CLOSED', generation: 1, code }]);
    expect(context.status).toEqual({ kind: 'closed', reason });
    expect(effects.filter((e) => e.type === 'ARM_TIMER')).toEqual([]);
    const after = run(context, [
      { type: 'ENV', online: true, visible: true },
      { type: 'TIMER', kind: 'retry' },
    ]);
    expect(after.context).toBe(context);
  });

  it('CLOSE releases the link and closes the socket with 1000', () => {
    const { context, effects } = run(goLive(), [{ type: 'CLOSE' }]);
    expect(context.status).toEqual({ kind: 'closed', reason: 'released' });
    expect(effects).toContainEqual({ type: 'CLOSE_SOCKET', generation: 1, code: 1000 });
  });
});

describe('linkReducer environment gate', () => {
  it('CONNECT while hidden or offline waits without opening a socket', () => {
    const hidden = run(initial({ visible: false }), [{ type: 'CONNECT' }]);
    expect(hidden.context.status).toEqual({
      kind: 'waiting',
      cause: 'hidden',
      attempt: 0,
      nextRetryAtMs: null,
    });
    expect(hidden.effects.some((e) => e.type === 'OPEN_SOCKET')).toBe(false);

    const offline = run(initial({ online: false }), [{ type: 'CONNECT' }]);
    expect(offline.context.status).toMatchObject({ kind: 'waiting', cause: 'offline' });
  });

  it('becoming visible and online from waiting attempts immediately on attempt 0', () => {
    const waiting = run(initial({ visible: false }), [{ type: 'CONNECT' }]).context;
    const { context, effects } = run(waiting, [{ type: 'ENV', online: true, visible: true }]);
    expect(context.status).toEqual({ kind: 'connecting', attempt: 0 });
    expect(effects).toContainEqual({ type: 'OPEN_SOCKET', generation: 1 });
  });

  it('going offline during backoff cancels the retry timer and waits for the network', () => {
    const waiting = run(goLive(), [{ type: 'SOCKET_CLOSED', generation: 1, code: 1006 }]).context;
    const { context, effects } = run(waiting, [{ type: 'ENV', online: false, visible: true }]);
    expect(context.status).toEqual({
      kind: 'waiting',
      cause: 'offline',
      attempt: 1,
      nextRetryAtMs: null,
    });
    expect(effects).toEqual([{ type: 'DISARM_TIMER', kind: 'retry' }]);
    const online = run(context, [{ type: 'ENV', online: true, visible: true }]);
    expect(online.context.status).toMatchObject({ kind: 'waiting', cause: 'backoff', attempt: 1 });
  });

  it('hiding while live pauses the keepalive; a short hide resyncs on the same socket', () => {
    const live = goLive();
    const hidden = run(live, [{ type: 'ENV', online: true, visible: false }], T0 + 1_000);
    expect(hidden.context.status).toEqual({ kind: 'live' });
    expect(hidden.effects).toEqual([
      { type: 'DISARM_TIMER', kind: 'ping' },
      { type: 'DISARM_TIMER', kind: 'pong' },
    ]);

    const resumed = run(
      hidden.context,
      [{ type: 'ENV', online: true, visible: true }],
      T0 + 1_000 + FAST_RESUME_MAX_HIDDEN_MS - 1,
    );
    expect(resumed.context.status).toEqual({ kind: 'syncing' });
    expect(resumed.context.socketGeneration).toBe(1);
    expect(resumed.effects).toContainEqual(
      expect.objectContaining({ type: 'SEND_SYNC', generation: 1 }),
    );
  });

  it('a long hide replaces the socket immediately with attempt 0', () => {
    const hidden = run(
      goLive(),
      [{ type: 'ENV', online: true, visible: false }],
      T0 + 1_000,
    ).context;
    const { context, effects } = run(
      hidden,
      [{ type: 'ENV', online: true, visible: true }],
      T0 + 1_000 + FAST_RESUME_MAX_HIDDEN_MS,
    );
    expect(context.status).toEqual({ kind: 'connecting', attempt: 0 });
    expect(effects).toContainEqual({ type: 'CLOSE_SOCKET', generation: 1, code: 1000 });
    expect(effects).toContainEqual({ type: 'OPEN_SOCKET', generation: 2 });
  });

  it('a ping timer firing while hidden does nothing', () => {
    const hidden = run(goLive(), [{ type: 'ENV', online: true, visible: false }]).context;
    expect(run(hidden, [{ type: 'TIMER', kind: 'ping' }]).effects).toEqual([]);
  });
});
