import { ROOM_CREATION_INTENTS_KEY } from '@/config/storageKeys';
import { UnsupportedRoomGameTypeError } from '@/services/types/IRoomDirectoryService';

import { cfPost } from '../cfFetch';
import { CFRoomDirectoryService } from '../CFRoomDirectoryService';

jest.mock('../cfFetch', () => ({ cfPost: jest.fn() }));

const mockStorageState = new Map<string, string>();
jest.mock('@/lib/storage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStorageState.get(key)),
    set: jest.fn((key: string, value: string) => mockStorageState.set(key, value)),
    remove: jest.fn((key: string) => mockStorageState.delete(key)),
  },
}));

const TEMPLATE_ROLES = ['wolf', 'seer', 'villager', 'villager'] as const;
const mockCfPost = jest.mocked(cfPost);

describe('CFRoomDirectoryService', () => {
  beforeEach(() => {
    mockCfPost.mockReset();
    mockStorageState.clear();
  });

  it('replays one creation ID after unknown delivery without client-authored identity', async () => {
    mockCfPost
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }))
      .mockResolvedValueOnce({
        room: {
          roomCode: '2345',
          roomId: 'room-id-2345',
          gameType: 'werewolf',
          hostUserId: 'HOST',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
    const request = {
      expectedHostUserId: 'HOST',
      gameType: 'werewolf' as const,
      config: { templateRoles: TEMPLATE_ROLES },
    };

    await expect(new CFRoomDirectoryService().createRoom(request)).rejects.toThrow('unavailable');
    const restoredService = new CFRoomDirectoryService();
    const created = await restoredService.createRoom(request);
    expect(created).toMatchObject({ roomCode: '2345', roomId: 'room-id-2345' });
    expect(mockStorageState.has(ROOM_CREATION_INTENTS_KEY)).toBe(true);
    restoredService.acknowledgeRoomCreation(created.creationId);
    expect(mockStorageState.has(ROOM_CREATION_INTENTS_KEY)).toBe(false);

    const firstBody = mockCfPost.mock.calls[0]?.[1];
    const secondBody = mockCfPost.mock.calls[1]?.[1];
    if (firstBody === undefined || secondBody === undefined) {
      throw new Error('Missing create-room request bodies');
    }
    expect(firstBody).toEqual({
      gameType: 'werewolf',
      config: { templateRoles: TEMPLATE_ROLES },
      creationId: firstBody.creationId,
    });
    expect(typeof firstBody.creationId).toBe('string');
    expect(secondBody).toEqual(firstBody);
    expect(firstBody).not.toHaveProperty('initialState');
    expect(firstBody).not.toHaveProperty('hostUserId');
  });

  it('fails fast when created room identity differs from the authenticated request', async () => {
    mockCfPost.mockResolvedValue({
      room: {
        roomCode: '3456',
        roomId: 'room-id-3456',
        gameType: 'werewolf',
        hostUserId: 'OTHER-HOST',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await expect(
      new CFRoomDirectoryService().createRoom({
        expectedHostUserId: 'HOST',
        gameType: 'werewolf',
        config: { templateRoles: TEMPLATE_ROLES },
      }),
    ).rejects.toThrow('/room/create identity does not match');
  });

  it('parses active room metadata without a game state codec', async () => {
    mockCfPost.mockResolvedValue({
      room: {
        roomCode: '5678',
        roomId: 'room-id-5678',
        gameType: 'werewolf',
        hostUserId: 'HOST',
        createdAt: '2026-07-10T12:00:00.000Z',
      },
    });

    await expect(new CFRoomDirectoryService().getRoom('5678')).resolves.toMatchObject({
      roomCode: '5678',
      roomId: 'room-id-5678',
      gameType: 'werewolf',
      hostUserId: 'HOST',
    });
  });

  it('reports a server game ID that this client cannot render', async () => {
    mockCfPost.mockResolvedValue({
      room: {
        roomCode: '5678',
        roomId: 'room-id-5678',
        gameType: 'future-game',
        hostUserId: 'HOST',
        createdAt: '2026-07-10T12:00:00.000Z',
      },
    });

    await expect(new CFRoomDirectoryService().getRoom('5678')).rejects.toBeInstanceOf(
      UnsupportedRoomGameTypeError,
    );
  });
});
