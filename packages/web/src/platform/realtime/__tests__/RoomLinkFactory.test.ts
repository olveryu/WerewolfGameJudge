import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';

import type { RealtimeSocket } from '../SocketChannel';
import type { RoomIdentity } from '../types';

class FakeLink {
  static created: FakeLink[] = [];
  identity: RoomIdentity<string> | null = null;
  readonly createSocket: (url: string) => RealtimeSocket;
  readonly close = vi.fn(() => {
    this.identity = null;
  });
  constructor(options: { readonly createSocket: (url: string) => RealtimeSocket }) {
    this.createSocket = options.createSocket;
    FakeLink.created.push(this);
  }
  getSnapshot() {
    return { identity: this.identity };
  }
}

vi.mock('../RoomLink', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../RoomLink')>()),
  RoomLinkImpl: FakeLink,
}));

const { createRoomLinkFactory } = await import('../RoomLinkFactory');

function bind(link: FakeLink | undefined, roomCode: string, userId: string): FakeLink {
  if (link === undefined) throw new Error('link was not created');
  link.identity = {
    room: {
      roomCode,
      roomId: `room-${roomCode}`,
      gameType: 'avalon',
      hostUserId: userId,
      createdAt: new Date(0),
    },
    userId,
  };
  return link;
}

describe('createRoomLinkFactory releaseOutside', () => {
  beforeEach(() => {
    FakeLink.created = [];
  });

  describe('browser socket close', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('closes protocol errors using a browser-permitted code without hiding the reason', () => {
      const close = vi.fn((code: number) => {
        if (code !== 1000 && (code < 3000 || code > 4999)) {
          throw new DOMException('Invalid close code', 'InvalidAccessError');
        }
      });
      vi.stubGlobal(
        'WebSocket',
        class {
          readonly close = close;
        },
      );
      FakeLink.created = [];
      createRoomLinkFactory({ onInboxWake: vi.fn() }).create({ gameType: 'avalon' } as never);
      const link = FakeLink.created[0];
      if (link === undefined) throw new Error('link was not created');
      const socket = link.createSocket('ws://example.test');

      socket.close(REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol_error');
      expect(close).toHaveBeenCalledWith(1000, 'protocol_error');
      socket.close(REALTIME_CLOSE_CODE.AUTH_REJECTED, 'auth');
      expect(close).toHaveBeenCalledWith(REALTIME_CLOSE_CODE.AUTH_REJECTED, 'auth');
    });
  });

  it('keeps the link of the route room and user and closes the rest', () => {
    const factory = createRoomLinkFactory({ onInboxWake: vi.fn() });
    const codec = { gameType: 'avalon' } as never;
    factory.create(codec);
    factory.create(codec);
    factory.create(codec);
    const [current, otherRoom, idle] = FakeLink.created;
    bind(current, '1234', 'user-1');
    bind(otherRoom, '5678', 'user-1');

    factory.releaseOutside({ roomCode: '1234', userId: 'user-1' });

    expect(current?.close).not.toHaveBeenCalled();
    expect(otherRoom?.close).toHaveBeenCalledTimes(1);
    expect(idle?.close).not.toHaveBeenCalled();
  });

  it('closes the room link once the user changes or the route leaves the room', () => {
    const factory = createRoomLinkFactory({ onInboxWake: vi.fn() });
    factory.create({ gameType: 'avalon' } as never);
    const link = bind(FakeLink.created[0], '1234', 'user-1');

    factory.releaseOutside({ roomCode: '1234', userId: 'user-2' });
    expect(link.close).toHaveBeenCalledTimes(1);

    bind(link, '1234', 'user-1');
    factory.releaseOutside({ roomCode: null, userId: 'user-1' });
    expect(link.close).toHaveBeenCalledTimes(2);
  });
});
