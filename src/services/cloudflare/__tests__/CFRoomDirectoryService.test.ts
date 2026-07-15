import { UnsupportedRoomGameTypeError } from '@/features/room/model/RoomDirectory';

import { cfPost } from '../cfFetch';
import { CFRoomDirectoryService } from '../CFRoomDirectoryService';

jest.mock('../cfFetch', () => ({ cfPost: jest.fn() }));

const TEMPLATE_ROLES = ['wolf', 'seer', 'villager', 'villager'] as const;
const mockCfPost = jest.mocked(cfPost);

describe('CFRoomDirectoryService', () => {
  beforeEach(() => {
    mockCfPost.mockReset();
  });

  it('sends the creation ID supplied by the room-creation service', async () => {
    mockCfPost.mockResolvedValue({
      room: {
        roomCode: '2345',
        roomId: 'room-id-2345',
        gameType: 'werewolf',
        hostUserId: 'HOST',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await expect(
      new CFRoomDirectoryService().createRoom({
        expectedHostUserId: 'HOST',
        gameType: 'werewolf',
        config: { templateRoles: TEMPLATE_ROLES },
        creationId: 'creation-id-2345',
      }),
    ).resolves.toMatchObject({ roomCode: '2345', roomId: 'room-id-2345' });

    expect(mockCfPost).toHaveBeenCalledWith('/room/create', {
      gameType: 'werewolf',
      config: { templateRoles: TEMPLATE_ROLES },
      creationId: 'creation-id-2345',
    });
    const body = mockCfPost.mock.calls[0]?.[1];
    if (body === undefined) throw new Error('Missing create-room request body');
    expect(body).not.toHaveProperty('initialState');
    expect(body).not.toHaveProperty('hostUserId');
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
        creationId: 'creation-id-3456',
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
