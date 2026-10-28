import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';

import { ApiError } from '@/platform/http/ApiError';
import { jsonResponse } from '@/test-utils/httpClient';
import {
  closeAllLinks,
  createLinkHarness,
  flush,
  IDENTITY,
  settle,
  snapshotAt,
  testState,
} from '@/test-utils/roomLink';

afterEach(() => {
  closeAllLinks();
  jest.useRealTimers();
});

function committed(commandId: string, revision: number) {
  return jsonResponse(200, {
    kind: 'committed',
    commandId,
    snapshot: snapshotAt(revision),
    outcome: { kind: 'success' },
  });
}

describe('RoomLink connect and sync', () => {
  it('opens a socket with the room locator and token, syncs, and resolves connect() when live', async () => {
    const harness = createLinkHarness();
    await harness.goLive(3);

    const socket = harness.sockets.latest();
    expect(socket.url).toMatch(/^wss:\/\/api\.test\/ws\?roomCode=1234&roomId=room-id-1234&token=/);
    expect(JSON.parse(socket.sent[0]!)).toMatchObject({ type: 'SYNC', knownRevision: null });
    const snapshot = harness.link.getSnapshot();
    expect(snapshot.status).toEqual({ kind: 'live' });
    expect(snapshot.room?.revision).toBe(3);
    expect(snapshot.epoch).toBe(1);
  });

  it('applies broadcasts by revision rule: older ignored, equal must match, newer replaces', async () => {
    const harness = createLinkHarness();
    await harness.goLive(3);
    const socket = harness.sockets.latest();

    socket.serverSend({
      type: 'STATE_UPDATE',
      snapshot: snapshotAt(4),
      commandType: 'test.increment',
    });
    expect(harness.link.getSnapshot().room?.revision).toBe(4);
    expect(harness.link.getSnapshot().lastCommand).toEqual({ revision: 4, type: 'test.increment' });

    // A second socket-level revision regression is a protocol error at the channel.
    socket.serverSend({ type: 'STATE_UPDATE', snapshot: snapshotAt(4, 99), commandType: null });
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'closed', reason: 'protocol' });
    expect(harness.protocolErrors[0]?.message).toMatch(/did not advance/);
  });

  it('rejects a snapshot whose identity does not match the directory record', async () => {
    const harness = createLinkHarness();
    const connected = harness.link.connect(IDENTITY, new AbortController().signal);
    await flush();
    const socket = harness.sockets.latest();
    socket.serverOpen();
    const sync = JSON.parse(socket.sent[0]!) as { requestId: string };
    socket.serverSend({
      type: 'SYNC_RESULT',
      requestId: sync.requestId,
      outcome: 'snapshot',
      snapshot: {
        gameType: 'werewolf',
        stateVersion: 1,
        revision: 1,
        state: testState(0, 'impostor'),
      },
    });

    await expect(connected).rejects.toThrow('closed: protocol');
    expect(harness.protocolErrors[0]?.message).toMatch(/identity/);
  });

  it('SYNC_RESULT current confirms the held revision after a fast resume', async () => {
    const harness = createLinkHarness();
    await harness.goLive(5);
    harness.env.set({ visible: false });
    harness.env.set({ visible: true });
    const socket = harness.sockets.latest();
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'syncing' });
    const sync = JSON.parse(socket.sent[1]!) as { requestId: string; knownRevision: number };
    expect(sync.knownRevision).toBe(5);

    socket.serverSend({
      type: 'SYNC_RESULT',
      requestId: sync.requestId,
      outcome: 'current',
      revision: 5,
    });
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'live' });
    expect(harness.sockets.sockets).toHaveLength(1);
  });
});

describe('RoomLink reconnection', () => {
  it('a non-terminal close enters waiting with a countdown, then reopens on a new socket', async () => {
    jest.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      harness.sockets.latest().serverClose(1006);
      const waiting = harness.link.getSnapshot().status;
      expect(waiting).toMatchObject({ kind: 'waiting', cause: 'backoff', attempt: 1 });

      await jest.advanceTimersByTimeAsync(600);
      await flush();
      expect(harness.sockets.sockets).toHaveLength(2);
      expect(harness.link.getSnapshot().status).toEqual({ kind: 'connecting', attempt: 1 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('retryNow() reconnects immediately from waiting and throws otherwise', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    expect(() => harness.link.retryNow()).toThrow('[FAIL-FAST]');
    harness.sockets.latest().serverClose(1006);
    harness.link.retryNow();
    await flush();
    expect(harness.sockets.sockets).toHaveLength(2);
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'connecting', attempt: 0 });
  });

  it('a terminal close ends the link with its reason and does not reconnect', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    harness.sockets.latest().serverClose(REALTIME_CLOSE_CODE.ROOM_DELETED, 'room_deleted');
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'closed', reason: 'roomDeleted' });
    await flush();
    expect(harness.sockets.sockets).toHaveLength(1);
  });

  it('close() releases the lease, aborts in-flight commands and lets another connect start', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    harness.network.respond(() => new Promise<Response>(() => undefined));
    const pending = harness.link.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: '测试', durable: false },
    );
    await flush();
    harness.link.close();
    await expect(pending).resolves.toMatchObject({ kind: 'cancelled' });
    expect(harness.sockets.latest().closedWith?.code).toBe(1000);
    expect(harness.link.getSnapshot()).toMatchObject({
      status: { kind: 'idle' },
      identity: null,
      epoch: 1,
    });

    await harness.goLive();
    expect(harness.link.getSnapshot().epoch).toBe(2);
  });
});

describe('RoomLink commands', () => {
  it('a committed command converges its snapshot before the caller sees the outcome', async () => {
    const harness = createLinkHarness();
    await harness.goLive(1);
    harness.network.respond((request) => {
      const body = JSON.parse(request.body as string) as { commandId: string; command: unknown };
      expect(body.command).toEqual({ type: 'test.increment', amount: 2 });
      return committed(body.commandId, 2);
    });

    const outcome = await harness.link.dispatch(
      { type: 'test.increment', amount: 2 },
      { controlledSeat: null, label: '测试', durable: false },
    );

    expect(outcome.kind).toBe('committed');
    expect(harness.link.getSnapshot().room?.revision).toBe(2);
  });

  it('shares one command ID between concurrent dispatches of the same intent', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    harness.network.respond((request) => {
      const body = JSON.parse(request.body as string) as { commandId: string };
      return committed(body.commandId, 2);
    });

    const [a, b] = await Promise.all([
      harness.link.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'a', durable: false },
      ),
      harness.link.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'b', durable: false },
      ),
    ]);
    expect(a.commandId).toBe(b.commandId);
    expect(harness.network.requests).toHaveLength(1);
  });

  it('a durable command survives an undelivered attempt, is replayed on the next live socket and then settled', async () => {
    jest.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      harness.network.respond(() => new TypeError('Failed to fetch'));
      const decision = harness.link.dispatch(
        { type: 'test.increment', amount: 5 },
        { controlledSeat: null, label: '持久', durable: true },
      );
      await flush();
      expect(harness.link.getSnapshot().pendingDurableCount).toBe(1);
      expect(harness.outboxStorage.load('room-id-1234', 'host-user')).toHaveLength(1);

      // Drop and reconnect: the new live generation triggers an immediate replay.
      harness.sockets.latest().serverClose(1006);
      await jest.advanceTimersByTimeAsync(600);
      await flush();
      const socket = harness.sockets.latest();
      socket.serverOpen();
      const sync = JSON.parse(socket.sent[0]!) as { requestId: string };
      harness.network.respond((request) => {
        const body = JSON.parse(request.body as string) as { commandId: string };
        expect(body.commandId).toBe('cmd-1');
        return committed(body.commandId, 2);
      });
      socket.serverSend({
        type: 'SYNC_RESULT',
        requestId: sync.requestId,
        outcome: 'current',
        revision: 1,
      });
      await flush();

      await expect(decision).resolves.toMatchObject({ kind: 'committed', commandId: 'cmd-1' });
      expect(harness.link.getSnapshot().pendingDurableCount).toBe(0);
      expect(harness.outboxStorage.load('room-id-1234', 'host-user')).toHaveLength(0);
      expect(harness.network.requests).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('restores persisted durable commands into a new link and replays them once live', async () => {
    const first = createLinkHarness();
    await first.goLive();
    first.network.respond(() => new TypeError('Failed to fetch'));
    void first.link.dispatch(
      { type: 'test.increment', amount: 9 },
      { controlledSeat: null, label: '持久', durable: true },
    );
    await flush();
    first.link.close();

    const second = createLinkHarness({ outboxStorage: first.outboxStorage });
    second.network.respond((request) => {
      const body = JSON.parse(request.body as string) as { commandId: string; command: unknown };
      expect(body.command).toEqual({ type: 'test.increment', amount: 9 });
      return committed(body.commandId, 2);
    });
    await second.goLive();
    await settle();
    expect(second.network.requests).toHaveLength(1);
    expect(second.link.getSnapshot().pendingDurableCount).toBe(0);
  });

  it('a 404 no_state keeps the intent as unavailable; a 4xx answer throws to the caller', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    harness.network.respond(() => jsonResponse(404, { success: false, reason: 'no_state' }));
    await expect(
      harness.link.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'x', durable: false },
      ),
    ).resolves.toMatchObject({ kind: 'unavailable' });

    harness.network.respond(() => jsonResponse(429, { success: false, reason: 'RATE_LIMITED' }));
    await expect(
      harness.link.dispatch(
        { type: 'test.increment', amount: 2 },
        { controlledSeat: null, label: 'x', durable: false },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('a late response for a previous epoch is reported as cancelled and never applied', async () => {
    const harness = createLinkHarness();
    await harness.goLive(1);
    let release: ((response: Response) => void) | null = null;
    harness.network.respond(() => new Promise<Response>((resolve) => (release = resolve)));
    const pending = harness.link.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'x', durable: false },
    );
    await flush();
    harness.link.close();
    release!(committed('cmd-1', 9));
    await expect(pending).resolves.toMatchObject({ kind: 'cancelled' });
    await harness.goLive(1);
    expect(harness.link.getSnapshot().room?.revision).toBe(1);
  });
});

describe('RoomLink presence and inbox hints', () => {
  it('publishes PRESENCE as a set and forwards INBOX_HINT', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    const socket = harness.sockets.latest();
    socket.serverSend({ type: 'PRESENCE', onlineUserIds: ['host-user', 'guest'] });
    expect([...harness.link.getSnapshot().presence]).toEqual(['host-user', 'guest']);
    socket.serverSend({ type: 'INBOX_HINT' });
    expect(harness.inboxHints.count).toBe(1);
  });
});
