import type {
  RoomCreationRequest,
  RoomCreationTransportRequest,
  RoomDirectory,
  RoomRecord,
} from '@/features/room/model/RoomDirectory';
import type { RecentRoomIdentity } from '@/features/room/services/recentRooms';
import type { RoomCreationIntentRepository } from '@/features/room/services/RoomCreationIntentStore';
import { RoomCreationService } from '@/features/room/services/RoomCreationService';

const mockAddRecentRoom = jest.fn<void, [string, RecentRoomIdentity]>();
jest.mock('@/features/room/services/recentRooms', () => ({
  addRecentRoom: (userId: string, room: RecentRoomIdentity): void =>
    mockAddRecentRoom(userId, room),
}));

const REQUEST: RoomCreationRequest = {
  expectedHostUserId: 'host-user',
  gameType: 'fibking',
  config: { numberOfPlayers: 8 },
};

const ROOM: RoomRecord = {
  roomCode: '2345',
  roomId: 'room-id-2345',
  gameType: 'fibking',
  hostUserId: 'host-user',
  createdAt: new Date('2026-07-15T00:00:00.000Z'),
};

function createHarness() {
  const createRoom = jest.fn<Promise<RoomRecord>, [RoomCreationTransportRequest]>();
  const getOrCreate = jest.fn<string, [string]>().mockReturnValue('creation-id-1');
  const remove = jest.fn<void, [string]>();
  const directory: RoomDirectory = {
    createRoom,
    getRoom: jest.fn(),
    deleteRoom: jest.fn(),
  };
  const intentStore: RoomCreationIntentRepository = { getOrCreate, remove };
  return {
    service: new RoomCreationService(directory, intentStore),
    createRoom,
    getOrCreate,
    remove,
  };
}

describe('RoomCreationService', () => {
  beforeEach(() => {
    mockAddRecentRoom.mockReset();
  });

  it('runs one in-flight creation for equal canonical requests', async () => {
    const harness = createHarness();
    let resolveDirectory: ((room: RoomRecord) => void) | undefined;
    harness.createRoom.mockReturnValue(
      new Promise((resolve) => {
        resolveDirectory = resolve;
      }),
    );

    const first = harness.service.createRoom(REQUEST);
    const second = harness.service.createRoom({ ...REQUEST, config: { numberOfPlayers: 8 } });

    expect(harness.createRoom).toHaveBeenCalledTimes(1);
    expect(harness.createRoom).toHaveBeenCalledWith({ ...REQUEST, creationId: 'creation-id-1' });
    if (resolveDirectory === undefined) throw new Error('Missing room-directory resolver');
    resolveDirectory(ROOM);

    await expect(Promise.all([first, second])).resolves.toEqual([ROOM, ROOM]);
    expect(mockAddRecentRoom).toHaveBeenCalledTimes(1);
    expect(mockAddRecentRoom).toHaveBeenCalledWith('host-user', {
      roomCode: ROOM.roomCode,
      roomId: ROOM.roomId,
      gameType: ROOM.gameType,
    });
    expect(harness.remove).toHaveBeenCalledTimes(1);
    expect(harness.remove).toHaveBeenCalledWith('creation-id-1');
  });

  it('reuses the persisted creation ID after an unknown delivery failure', async () => {
    const harness = createHarness();
    harness.createRoom
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }))
      .mockResolvedValueOnce(ROOM);

    await expect(harness.service.createRoom(REQUEST)).rejects.toThrow('unavailable');
    expect(harness.remove).not.toHaveBeenCalled();
    await expect(harness.service.createRoom(REQUEST)).resolves.toEqual(ROOM);

    expect(harness.createRoom).toHaveBeenNthCalledWith(1, {
      ...REQUEST,
      creationId: 'creation-id-1',
    });
    expect(harness.createRoom).toHaveBeenNthCalledWith(2, {
      ...REQUEST,
      creationId: 'creation-id-1',
    });
    expect(harness.remove).toHaveBeenCalledWith('creation-id-1');
  });

  it('removes a terminal rejected intent before surfacing the error', async () => {
    const harness = createHarness();
    harness.createRoom.mockRejectedValue(
      Object.assign(new Error('invalid config'), { status: 400 }),
    );

    await expect(harness.service.createRoom(REQUEST)).rejects.toThrow('invalid config');
    expect(harness.remove).toHaveBeenCalledWith('creation-id-1');
    expect(mockAddRecentRoom).not.toHaveBeenCalled();
  });

  it('retains the intent when committing recent-room identity fails', async () => {
    const harness = createHarness();
    harness.createRoom.mockResolvedValue(ROOM);
    mockAddRecentRoom.mockImplementation(() => {
      throw new Error('recent-room persistence failed');
    });

    await expect(harness.service.createRoom(REQUEST)).rejects.toThrow(
      'recent-room persistence failed',
    );
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it('fails fast when the transport returns another room identity', async () => {
    const harness = createHarness();
    harness.createRoom.mockResolvedValue({ ...ROOM, gameType: 'werewolf' });

    await expect(harness.service.createRoom(REQUEST)).rejects.toThrow(
      'does not match its creation request',
    );
    expect(mockAddRecentRoom).not.toHaveBeenCalled();
    expect(harness.remove).not.toHaveBeenCalled();
  });
});
