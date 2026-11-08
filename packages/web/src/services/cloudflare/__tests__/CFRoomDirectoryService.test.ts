import { UnsupportedRoomGameTypeError } from '@/features/room/model/RoomDirectory';
import { requestSpecAt, respondWithJson as queueJson, spyOnApiJson } from '@/test-utils/apiClient';

import { CFRoomDirectoryService } from '../CFRoomDirectoryService';

const TEMPLATE_ROLES = ['wolf', 'seer', 'villager', 'villager'] as const;
const jsonSpy = spyOnApiJson();

function respondWithJson(value: unknown): void {
  queueJson(jsonSpy, value);
}

describe('CFRoomDirectoryService', () => {
  beforeEach(() => {
    jsonSpy.mockReset();
  });

  it('sends the creation ID supplied by the room-creation service', async () => {
    respondWithJson({
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

    const spec = requestSpecAt(jsonSpy, 0);
    expect(spec).toMatchObject({
      method: 'POST',
      path: '/room/create',
      auth: 'required',
      idempotent: true,
      body: {
        gameType: 'werewolf',
        config: { templateRoles: TEMPLATE_ROLES },
        creationId: 'creation-id-2345',
      },
    });
    expect(spec.body).not.toHaveProperty('initialState');
    expect(spec.body).not.toHaveProperty('hostUserId');
  });

  it('fails fast when created room identity differs from the authenticated request', async () => {
    respondWithJson({
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
    respondWithJson({
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
    respondWithJson({
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
