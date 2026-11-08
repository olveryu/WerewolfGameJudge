import { RoomCommandProtocolError } from '@game-judge/game-engine/platform/protocol/commandResult';
import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import { z } from 'zod';

import type { OutboxStorage } from '@/platform/realtime/outboxStorage';
import type { FakeWebSocket } from '@/test-utils/fakeWebSocket';
import { createUnsignedAccessToken, jsonResponse } from '@/test-utils/httpClient';
import {
  closeAllLinks,
  createLinkHarness,
  flush,
  IDENTITY,
  settle,
  snapshotAt,
  testState,
} from '@/test-utils/roomLink';

/** Only the fields these tests assert on; the Worker schema validates the full body. */
const commandBodySchema = z.looseObject({ commandId: z.string(), command: z.unknown() });

afterEach(() => {
  closeAllLinks();
  vi.useRealTimers();
});

function committedResult(commandId: string, revision: number) {
  return {
    kind: 'committed',
    commandId,
    snapshot: snapshotAt(revision),
    outcome: { kind: 'success' },
  } as const;
}

/** The latest COMMAND frame the harness socket sent, validated like the old HTTP body. */
function commandFrameSent(socket: FakeWebSocket): { commandId: string; command: unknown } {
  const frames = socket.sent.map((text) => JSON.parse(text) as Record<string, unknown>);
  const frame = frames.filter((candidate) => candidate.type === 'COMMAND').at(-1);
  if (frame === undefined) throw new Error('No COMMAND frame was sent');
  return commandBodySchema.parse(frame);
}

/** Answer the sent COMMAND with a decided committed result at `revision`. */
function answerCommitted(socket: FakeWebSocket, revision: number): string {
  const frame = commandFrameSent(socket);
  socket.serverSend({
    type: 'COMMAND_RESULT',
    commandId: frame.commandId,
    outcome: 'decided',
    result: committedResult(frame.commandId, revision),
  });
  return frame.commandId;
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

  it('an unreachable refresh endpoint counts as one failed attempt and is retried', async () => {
    vi.useFakeTimers();
    const harness = createLinkHarness();
    harness.tokens.saveTokens(createUnsignedAccessToken('host-user', 1), 'r');
    harness.network.respond(() => jsonResponse(503, { reason: 'SERVER_ERROR' }));

    const connected = harness.link.connect(IDENTITY, new AbortController().signal);
    const rejection = connected.catch((error: unknown) => error);
    // The 503 body is read on a macrotask; advance fake time by 0 to settle it.
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.sockets.sockets).toHaveLength(0);
    expect(harness.link.getSnapshot().status).toMatchObject({
      kind: 'waiting',
      cause: 'backoff',
      attempt: 1,
    });

    harness.network.respond(() =>
      jsonResponse(200, {
        access_token: createUnsignedAccessToken('host-user', Math.floor(Date.now() / 1000) + 3600),
        refresh_token: 'r2',
      }),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.sockets.sockets).toHaveLength(1);
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'connecting', attempt: 1 });
    harness.link.close();
    await expect(rejection).resolves.toBeInstanceOf(Error);
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
    vi.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      harness.sockets.latest().serverClose(1006);
      const waiting = harness.link.getSnapshot().status;
      expect(waiting).toMatchObject({ kind: 'waiting', cause: 'backoff', attempt: 1 });

      await vi.advanceTimersByTimeAsync(600);
      await flush();
      expect(harness.sockets.sockets).toHaveLength(2);
      expect(harness.link.getSnapshot().status).toEqual({ kind: 'connecting', attempt: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('retryNow() reconnects immediately from waiting and is a no-op otherwise', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    harness.link.retryNow();
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'live' });
    harness.sockets.latest().serverClose(1006);
    harness.link.retryNow();
    await flush();
    expect(harness.sockets.sockets).toHaveLength(2);
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'connecting', attempt: 0 });
    harness.link.close();
    expect(() => harness.link.retryNow()).not.toThrow();
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

  it('a start-up failure in connect() gives the lease back and leaves the link idle', async () => {
    let shouldFailRestore = true;
    const outboxStorage: OutboxStorage = {
      load: () => {
        if (shouldFailRestore)
          throw new Error('[FAIL-FAST] Durable commands contain duplicate intents');
        return [];
      },
      save: () => undefined,
      remove: () => undefined,
    };
    const harness = createLinkHarness({ outboxStorage });
    await expect(harness.link.connect(IDENTITY, new AbortController().signal)).rejects.toThrow(
      'duplicate intents',
    );
    expect(harness.link.getSnapshot()).toMatchObject({ status: { kind: 'idle' }, identity: null });
    expect(harness.sockets.sockets).toHaveLength(0);

    // Not wedged: the same link and lease can be entered again.
    shouldFailRestore = false;
    await harness.goLive();
    expect(harness.link.getSnapshot().status).toEqual({ kind: 'live' });
  });
});

describe('RoomLink commands', () => {
  it('a committed command converges its snapshot before the caller sees the outcome', async () => {
    const harness = createLinkHarness();
    await harness.goLive(1);
    const socket = harness.sockets.latest();
    const outcomePromise = harness.link.dispatch(
      { type: 'test.increment', amount: 2 },
      { controlledSeat: null, label: '测试', durable: false },
    );
    await flush();
    expect(commandFrameSent(socket).command).toEqual({ type: 'test.increment', amount: 2 });
    answerCommitted(socket, 2);

    const outcome = await outcomePromise;
    expect(outcome.kind).toBe('committed');
    expect(harness.link.getSnapshot().room?.revision).toBe(2);
  });

  it('shares one command ID between concurrent dispatches of the same intent', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    const socket = harness.sockets.latest();
    const aPromise = harness.link.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'a', durable: false },
    );
    const bPromise = harness.link.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'b', durable: false },
    );
    await flush();
    const commandFrames = socket.sent
      .map((text) => JSON.parse(text) as { type?: string })
      .filter((frame) => frame.type === 'COMMAND');
    expect(commandFrames).toHaveLength(1);
    answerCommitted(socket, 2);

    const [a, b] = await Promise.all([aPromise, bPromise]);
    expect(a.commandId).toBe(b.commandId);
  });

  it('a durable command survives an undelivered attempt, is replayed on the next live socket and then settled', async () => {
    vi.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      const firstSocket = harness.sockets.latest();
      const decision = harness.link.dispatch(
        { type: 'test.increment', amount: 5 },
        { controlledSeat: null, label: '持久', durable: true },
      );
      await flush();
      expect(commandFrameSent(firstSocket).commandId).toBe('cmd-1');
      expect(harness.link.getSnapshot().pendingDurableCount).toBe(1);
      expect(harness.outboxStorage.load('room-id-1234', 'host-user')).toHaveLength(1);

      // Drop the socket before the server answers: the in-flight send settles undelivered.
      firstSocket.serverClose(1006);
      await flush();
      await vi.advanceTimersByTimeAsync(600);
      await flush();
      const socket = harness.sockets.latest();
      socket.serverOpen();
      const sync = JSON.parse(socket.sent[0]!) as { requestId: string };
      socket.serverSend({
        type: 'SYNC_RESULT',
        requestId: sync.requestId,
        outcome: 'current',
        revision: 1,
      });
      await flush();

      // The replay sends the same commandId on the new socket.
      expect(commandFrameSent(socket).commandId).toBe('cmd-1');
      answerCommitted(socket, 2);
      await expect(decision).resolves.toMatchObject({ kind: 'committed', commandId: 'cmd-1' });
      expect(harness.link.getSnapshot().pendingDurableCount).toBe(0);
      expect(harness.outboxStorage.load('room-id-1234', 'host-user')).toHaveLength(0);
      const commandFrames = [firstSocket, socket].flatMap((candidate) =>
        candidate.sent
          .map((text) => JSON.parse(text) as { type?: string })
          .filter((frame) => frame.type === 'COMMAND'),
      );
      expect(commandFrames).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a throttled result keeps a durable command for replay while a protocol error drops it', async () => {
    vi.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      const socket = harness.sockets.latest();

      const throttled = harness.link.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: '限流', durable: true },
      );
      await flush();
      const throttledId = commandFrameSent(socket).commandId;
      socket.serverSend({ type: 'COMMAND_RESULT', commandId: throttledId, outcome: 'throttled' });
      await vi.advanceTimersByTimeAsync(0);
      expect(harness.outboxStorage.load('room-id-1234', 'host-user')).toHaveLength(1);
      expect(harness.link.getSnapshot().pendingDurableCount).toBe(1);
      // First rung of the replay ladder: the same commandId goes out again.
      await vi.advanceTimersByTimeAsync(1_000);
      await flush();
      expect(commandFrameSent(socket).commandId).toBe('cmd-1');
      answerCommitted(socket, 2);
      await expect(throttled).resolves.toMatchObject({ kind: 'committed', commandId: 'cmd-1' });
      expect(harness.outboxStorage.load('room-id-1234', 'host-user')).toHaveLength(0);

      const forbidden = harness.link.dispatch(
        { type: 'test.increment', amount: 2 },
        { controlledSeat: null, label: '拒绝', durable: true },
      );
      const settled = forbidden.catch((error: unknown) => error);
      await flush();
      const forbiddenId = commandFrameSent(socket).commandId;
      socket.serverSend({
        type: 'COMMAND_RESULT',
        commandId: forbiddenId,
        outcome: 'decided',
        result: committedResult('cmd-other', 2),
      });
      await vi.advanceTimersByTimeAsync(0);
      await expect(settled).resolves.toBeInstanceOf(RoomCommandProtocolError);
      expect(harness.outboxStorage.load('room-id-1234', 'host-user')).toHaveLength(0);
      expect(harness.link.getSnapshot().pendingDurableCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restores persisted durable commands into a new link and replays them once live', async () => {
    const first = createLinkHarness();
    await first.goLive();
    void first.link.dispatch(
      { type: 'test.increment', amount: 9 },
      { controlledSeat: null, label: '持久', durable: true },
    );
    await flush();
    first.link.close();

    const second = createLinkHarness({ outboxStorage: first.outboxStorage });
    await second.goLive();
    await flush();
    const socket = second.sockets.latest();
    expect(commandFrameSent(socket).command).toEqual({ type: 'test.increment', amount: 9 });
    answerCommitted(socket, 2);
    await settle();
    expect(second.link.getSnapshot().pendingDurableCount).toBe(0);
  });

  it('an unavailable result is unavailable, a throttled result is undelivered, a mismatched result throws to the caller', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    const socket = harness.sockets.latest();

    const unavailable = harness.link.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'x', durable: false },
    );
    await flush();
    socket.serverSend({
      type: 'COMMAND_RESULT',
      commandId: commandFrameSent(socket).commandId,
      outcome: 'unavailable',
    });
    await expect(unavailable).resolves.toMatchObject({ kind: 'unavailable' });

    const throttled = harness.link.dispatch(
      { type: 'test.increment', amount: 2 },
      { controlledSeat: null, label: 'x', durable: false },
    );
    await flush();
    socket.serverSend({
      type: 'COMMAND_RESULT',
      commandId: commandFrameSent(socket).commandId,
      outcome: 'throttled',
    });
    await expect(throttled).resolves.toEqual({
      kind: 'undelivered',
      commandId: 'cmd-2',
      cause: 'throttled',
    });

    const mismatched = harness.link.dispatch(
      { type: 'test.increment', amount: 3 },
      { controlledSeat: null, label: 'x', durable: false },
    );
    await flush();
    socket.serverSend({
      type: 'COMMAND_RESULT',
      commandId: commandFrameSent(socket).commandId,
      outcome: 'decided',
      result: committedResult('cmd-other', 2),
    });
    await expect(mismatched).rejects.toBeInstanceOf(RoomCommandProtocolError);
  });

  it('a late response for a previous epoch is reported as cancelled and never applied', async () => {
    const harness = createLinkHarness();
    await harness.goLive(1);
    const pending = harness.link.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'x', durable: false },
    );
    await flush();
    harness.link.close();
    await expect(pending).resolves.toMatchObject({ kind: 'cancelled' });
    await harness.goLive(1);
    expect(harness.link.getSnapshot().room?.revision).toBe(1);
    // The late result arrives on the new epoch's socket: unknown command, ignored.
    harness.sockets.latest().serverSend({
      type: 'COMMAND_RESULT',
      commandId: 'cmd-1',
      outcome: 'decided',
      result: committedResult('cmd-1', 9),
    });
    await flush();
    expect(harness.link.getSnapshot().room?.revision).toBe(1);
    expect(harness.protocolErrors).toHaveLength(0);
  });

  it('a non-durable command while the link is not live fails fast as undelivered', async () => {
    const harness = createLinkHarness();
    const connected = harness.link.connect(IDENTITY, new AbortController().signal);
    await flush();
    const outcome = await harness.link.dispatch(
      { type: 'test.increment', amount: 1 },
      { controlledSeat: null, label: 'x', durable: false },
    );
    expect(outcome).toEqual({ kind: 'undelivered', commandId: 'cmd-1', cause: 'network' });
    expect(harness.sockets.latest().sent).toHaveLength(0);
    harness.link.close();
    await expect(connected).rejects.toBeInstanceOf(Error);
  });

  it('a command in flight when the socket drops settles as undelivered', async () => {
    vi.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      const socket = harness.sockets.latest();
      const pending = harness.link.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'x', durable: false },
      );
      await flush();
      expect(commandFrameSent(socket).commandId).toBe('cmd-1');
      socket.serverClose(1006);
      await expect(pending).resolves.toEqual({
        kind: 'undelivered',
        commandId: 'cmd-1',
        cause: 'network',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a command with no answer times out after 12 seconds', async () => {
    vi.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      const pending = harness.link.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'x', durable: false },
      );
      await flush();
      await vi.advanceTimersByTimeAsync(12_000);
      await expect(pending).resolves.toEqual({
        kind: 'undelivered',
        commandId: 'cmd-1',
        cause: 'timeout',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a late COMMAND_RESULT for a timed-out command is ignored', async () => {
    vi.useFakeTimers();
    try {
      const harness = createLinkHarness();
      await harness.goLive();
      const socket = harness.sockets.latest();
      const pending = harness.link.dispatch(
        { type: 'test.increment', amount: 1 },
        { controlledSeat: null, label: 'x', durable: false },
      );
      await flush();
      await vi.advanceTimersByTimeAsync(12_000);
      await expect(pending).resolves.toEqual({
        kind: 'undelivered',
        commandId: 'cmd-1',
        cause: 'timeout',
      });
      socket.serverSend({
        type: 'COMMAND_RESULT',
        commandId: 'cmd-1',
        outcome: 'decided',
        result: committedResult('cmd-1', 9),
      });
      await flush();
      expect(harness.link.getSnapshot().status).toEqual({ kind: 'live' });
      expect(harness.link.getSnapshot().room?.revision).toBe(1);
      expect(harness.protocolErrors).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('RoomLink inbox wakes', () => {
  it('wakes the inbox on live and on INBOX_HINT', async () => {
    const harness = createLinkHarness();
    await harness.goLive();
    expect(harness.inboxWakes).toEqual(['live']);
    const socket = harness.sockets.latest();
    socket.serverSend({ type: 'INBOX_HINT' });
    expect(harness.inboxWakes).toEqual(['live', 'hint']);
  });
});
