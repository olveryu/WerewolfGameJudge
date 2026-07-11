import { WEREWOLF_STATE_CODEC } from '@werewolf/game-engine';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import { ROOM_CREATION_INTENTS_KEY } from '@/config/storageKeys';

import { UnsupportedRoomGameTypeError } from '../../types/IRoomService';
import { cfPost } from '../cfFetch';
import { CFRoomService } from '../CFRoomService';

jest.mock('../cfFetch', () => ({
  cfPost: jest.fn(),
}));

const mockStorageState = new Map<string, string>();
jest.mock('@/lib/storage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStorageState.get(key)),
    set: jest.fn((key: string, value: string) => mockStorageState.set(key, value)),
    remove: jest.fn((key: string) => mockStorageState.delete(key)),
  },
}));

const TEMPLATE: GameTemplate = {
  name: 'Room service',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};
const ROOM = { roomCode: '4567', roomId: 'room-id-4567' } as const;

const mockCfPost = jest.mocked(cfPost);
describe('CFRoomService.createRoom', () => {
  beforeEach(() => {
    mockCfPost.mockReset();
    mockStorageState.clear();
  });

  it('sends no client room code and reuses one creation ID after unknown delivery', async () => {
    const state = buildInitialGameState('2345', 'HOST', TEMPLATE);
    const snapshot = createRoomSnapshot(state, 1);
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
        snapshot,
      });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);
    const request = {
      expectedHostUserId: 'HOST',
      gameType: 'werewolf' as const,
      config: { templateRoles: TEMPLATE.roles },
    };

    await expect(service.createRoom(request)).rejects.toThrow('unavailable');
    const restoredService = new CFRoomService(WEREWOLF_STATE_CODEC);
    const created = await restoredService.createRoom(request);
    expect(created).toMatchObject({
      roomCode: '2345',
      roomId: 'room-id-2345',
      snapshot,
    });
    expect(mockStorageState.has(ROOM_CREATION_INTENTS_KEY)).toBe(true);
    restoredService.acknowledgeRoomCreation(created.creationId);
    expect(mockStorageState.has(ROOM_CREATION_INTENTS_KEY)).toBe(false);

    expect(mockCfPost).toHaveBeenCalledTimes(2);
    const firstCall = mockCfPost.mock.calls[0];
    const secondCall = mockCfPost.mock.calls[1];
    if (firstCall === undefined || secondCall === undefined) {
      throw new Error('Missing create-room calls');
    }
    const firstBody = firstCall[1];
    const secondBody = secondCall[1];
    if (firstBody === undefined || secondBody === undefined) {
      throw new Error('Missing create-room request bodies');
    }
    expect(firstBody).toEqual({
      gameType: 'werewolf',
      config: { templateRoles: TEMPLATE.roles },
      creationId: firstBody.creationId,
    });
    expect(typeof firstBody.creationId).toBe('string');
    expect(secondBody).toEqual(firstBody);
    expect(firstBody).not.toHaveProperty('initialState');
    expect(firstBody).not.toHaveProperty('hostUserId');
  });

  it('fails fast when the response identity differs from the authenticated request', async () => {
    const state = buildInitialGameState('3456', 'OTHER-HOST', TEMPLATE);
    mockCfPost.mockResolvedValue({
      room: {
        roomCode: '3456',
        roomId: 'room-id-3456',
        gameType: 'werewolf',
        hostUserId: 'OTHER-HOST',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      snapshot: createRoomSnapshot(state, 1),
    });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(
      service.createRoom({
        expectedHostUserId: 'HOST',
        gameType: 'werewolf',
        config: { templateRoles: TEMPLATE.roles },
      }),
    ).rejects.toThrow('/room/create identity does not match');
  });
});

describe('CFRoomService.getGameState', () => {
  beforeEach(() => {
    mockCfPost.mockReset();
    mockStorageState.clear();
  });

  it('decodes the canonical snapshot response', async () => {
    const state = buildInitialGameState('4567', 'HOST', TEMPLATE);
    const snapshot = createRoomSnapshot(state, 3);
    mockCfPost.mockResolvedValue({ snapshot });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getGameState(ROOM)).resolves.toEqual(snapshot);
  });

  it('returns null only for an explicit null snapshot', async () => {
    mockCfPost.mockResolvedValue({ snapshot: null });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getGameState(ROOM)).resolves.toBeNull();
  });

  it('rejects the removed flat state response', async () => {
    const state = buildInitialGameState('4567', 'HOST', TEMPLATE);
    mockCfPost.mockResolvedValue({ state, revision: 3 });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getGameState(ROOM)).rejects.toThrow(
      '/room/state response has unsupported fields',
    );
  });
});

describe('CFRoomService.getRoom', () => {
  beforeEach(() => {
    mockCfPost.mockReset();
    mockStorageState.clear();
  });

  it('parses the game discriminator in active room metadata', async () => {
    mockCfPost.mockResolvedValue({
      room: {
        roomCode: '5678',
        roomId: 'room-id-5678',
        gameType: 'werewolf',
        hostUserId: 'HOST',
        createdAt: '2026-07-10T12:00:00.000Z',
      },
    });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getRoom('5678')).resolves.toMatchObject({
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
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getRoom('5678')).rejects.toBeInstanceOf(UnsupportedRoomGameTypeError);
  });
});
