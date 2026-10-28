import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import type { ServerFrame } from '@game-judge/game-engine/platform/realtime/protocol';

import { SocketChannel, type SocketChannelEvents } from '@/platform/realtime/SocketChannel';
import { createSocketFactory } from '@/test-utils/fakeWebSocket';
import { snapshotAt, TEST_CODEC, type TestState } from '@/test-utils/roomLink';

const ROOM = { roomCode: '1234', roomId: 'room-id-1234' };

function createChannel(token: string | null = 'token-1') {
  const sockets = createSocketFactory();
  const events: jest.Mocked<SocketChannelEvents<TestState>> = {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onFrame: jest.fn(),
    onPong: jest.fn(),
    onProtocolError: jest.fn(),
  };
  const channel = new SocketChannel<TestState>({
    baseUrl: 'wss://api.test',
    codec: TEST_CODEC,
    accessToken: async () => token,
    createSocket: sockets.create,
    events,
  });
  return { channel, sockets, events };
}

describe('SocketChannel', () => {
  it('rejects a non-websocket base URL', () => {
    expect(
      () =>
        new SocketChannel<TestState>({
          baseUrl: 'https://api.test',
          codec: TEST_CODEC,
          accessToken: async () => 't',
          createSocket: () => {
            throw new Error('unreachable');
          },
          events: {
            onOpen: jest.fn(),
            onClose: jest.fn(),
            onFrame: jest.fn(),
            onPong: jest.fn(),
            onProtocolError: jest.fn(),
          },
        }),
    ).toThrow('ws:// or wss://');
  });

  it('reports a missing token as an AUTH_REJECTED close without creating a socket', async () => {
    const { channel, sockets, events } = createChannel(null);
    await channel.open(1, ROOM);
    expect(sockets.sockets).toHaveLength(0);
    expect(events.onClose).toHaveBeenCalledWith(1, REALTIME_CLOSE_CODE.AUTH_REJECTED, 'no_token');
  });

  it('delivers pong, parsed frames and close with the socket generation', async () => {
    const { channel, sockets, events } = createChannel();
    await channel.open(2, ROOM);
    const socket = sockets.latest();
    socket.serverOpen();
    expect(events.onOpen).toHaveBeenCalledWith(2);

    socket.serverSend('pong');
    expect(events.onPong).toHaveBeenCalledWith(2);

    const frame: ServerFrame<TestState> = { type: 'INBOX_HINT' };
    socket.serverSend(frame);
    expect(events.onFrame).toHaveBeenCalledWith(2, frame);

    expect(channel.send(2, { type: 'SYNC', requestId: 'r1', knownRevision: null })).toBe(true);
    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'SYNC', requestId: 'r1', knownRevision: null }),
    ]);
    expect(channel.send(1, { type: 'SYNC', requestId: 'r2', knownRevision: null })).toBe(false);

    socket.serverClose(1006, 'gone');
    expect(events.onClose).toHaveBeenCalledWith(2, 1006, 'gone');
  });

  it.each([
    ['binary frame', () => new ArrayBuffer(2)],
    ['invalid JSON', () => '{nope'],
    ['unknown type', () => ({ type: 'UNKNOWN' })],
    ['extra field', () => ({ type: 'INBOX_HINT', extra: 1 })],
    [
      'bad state',
      () => ({
        type: 'STATE_UPDATE',
        snapshot: { ...snapshotAt(1), state: { counter: 'x' } },
        commandType: null,
      }),
    ],
  ])('closes with 1002 on a %s and reports the protocol error once', async (_label, payload) => {
    const { channel, sockets, events } = createChannel();
    await channel.open(1, ROOM);
    const socket = sockets.latest();
    socket.serverOpen();
    const data = payload();
    socket.onmessage?.({ data } as MessageEvent);
    expect(socket.closedWith).toEqual({ code: 1002, reason: 'protocol_error' });
    expect(events.onProtocolError).toHaveBeenCalledTimes(1);
    expect(events.onFrame).not.toHaveBeenCalled();
    // The channel detached its handlers; a late server close is not reported.
    socket.serverClose(1002);
    expect(events.onClose).not.toHaveBeenCalled();
  });

  it('requires STATE_UPDATE revisions to advance within one socket', async () => {
    const { channel, sockets, events } = createChannel();
    await channel.open(1, ROOM);
    const socket = sockets.latest();
    socket.serverOpen();
    socket.serverSend({ type: 'STATE_UPDATE', snapshot: snapshotAt(3), commandType: null });
    socket.serverSend({ type: 'STATE_UPDATE', snapshot: snapshotAt(3), commandType: null });
    expect(events.onFrame).toHaveBeenCalledTimes(1);
    expect(events.onProtocolError.mock.calls[0]?.[1].message).toMatch(/did not advance from 3/);
  });

  it('ignores events from a socket replaced by a newer open()', async () => {
    const { channel, sockets, events } = createChannel();
    await channel.open(1, ROOM);
    const first = sockets.latest();
    await channel.open(2, ROOM);
    expect(first.closedWith?.code).toBe(1000);
    first.serverOpen();
    first.serverSend('pong');
    expect(events.onOpen).not.toHaveBeenCalled();
    expect(events.onPong).not.toHaveBeenCalled();
    sockets.latest().serverOpen();
    expect(events.onOpen).toHaveBeenCalledWith(2);
  });
});
