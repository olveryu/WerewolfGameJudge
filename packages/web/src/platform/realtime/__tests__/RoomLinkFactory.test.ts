import type { RoomIdentity } from '../types';

class FakeLink {
  static created: FakeLink[] = [];
  identity: RoomIdentity<string> | null = null;
  readonly close = vi.fn(() => {
    this.identity = null;
  });
  constructor() {
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
      gameType: 'demo',
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

  it('keeps the link of the route room and user and closes the rest', () => {
    const factory = createRoomLinkFactory({ onInboxWake: vi.fn() });
    const codec = { gameType: 'demo' } as never;
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
    factory.create({ gameType: 'demo' } as never);
    const link = bind(FakeLink.created[0], '1234', 'user-1');

    factory.releaseOutside({ roomCode: '1234', userId: 'user-2' });
    expect(link.close).toHaveBeenCalledTimes(1);

    bind(link, '1234', 'user-1');
    factory.releaseOutside({ roomCode: null, userId: 'user-1' });
    expect(link.close).toHaveBeenCalledTimes(2);
  });
});
