import { WEREWOLF_STATE_CODEC } from '@werewolf/game-engine';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import { generateRoomCode } from '@/utils/roomCode';

import { cfPost } from '../cfFetch';
import { CFRoomService } from '../CFRoomService';

jest.mock('../cfFetch', () => ({
  cfPost: jest.fn(),
}));
jest.mock('@/utils/roomCode', () => ({
  generateRoomCode: jest.fn(),
}));

const TEMPLATE: GameTemplate = {
  name: 'Room service',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};

const mockCfPost = jest.mocked(cfPost);
const mockGenerateRoomCode = jest.mocked(generateRoomCode);

describe('CFRoomService.createRoom', () => {
  beforeEach(() => {
    mockCfPost.mockReset();
    mockGenerateRoomCode.mockReset();
  });

  it('sends server-authored config and reuses one creation ID across code conflicts', async () => {
    const state = buildInitialGameState('SECOND', 'HOST', TEMPLATE);
    const snapshot = createRoomSnapshot(state, 1);
    mockGenerateRoomCode.mockReturnValue('SECOND');
    mockCfPost
      .mockRejectedValueOnce(Object.assign(new Error('conflict'), { status: 409 }))
      .mockResolvedValueOnce({
        room: {
          roomCode: 'SECOND',
          gameType: 'werewolf',
          hostUserId: 'HOST',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        snapshot,
      });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(
      service.createRoom({
        expectedHostUserId: 'HOST',
        gameType: 'werewolf',
        config: { templateRoles: TEMPLATE.roles },
        initialRoomCode: 'FIRST',
      }),
    ).resolves.toMatchObject({ roomCode: 'SECOND', snapshot });

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
      roomCode: 'FIRST',
      gameType: 'werewolf',
      config: { templateRoles: TEMPLATE.roles },
      creationId: firstBody.creationId,
    });
    expect(typeof firstBody.creationId).toBe('string');
    expect(secondBody).toEqual({
      ...firstBody,
      roomCode: 'SECOND',
    });
    expect(firstBody).not.toHaveProperty('initialState');
    expect(firstBody).not.toHaveProperty('hostUserId');
  });

  it('fails fast when the response identity differs from the authenticated request', async () => {
    const state = buildInitialGameState('ROOM', 'OTHER-HOST', TEMPLATE);
    mockCfPost.mockResolvedValue({
      room: {
        roomCode: 'ROOM',
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
        initialRoomCode: 'ROOM',
        maxAttempts: 1,
      }),
    ).rejects.toThrow('/room/create identity does not match');
  });
});

describe('CFRoomService.getGameState', () => {
  beforeEach(() => {
    mockCfPost.mockReset();
  });

  it('decodes the canonical snapshot response', async () => {
    const state = buildInitialGameState('ROOM', 'HOST', TEMPLATE);
    const snapshot = createRoomSnapshot(state, 3);
    mockCfPost.mockResolvedValue({ snapshot });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getGameState('ROOM')).resolves.toEqual(snapshot);
  });

  it('returns null only for an explicit null snapshot', async () => {
    mockCfPost.mockResolvedValue({ snapshot: null });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getGameState('ROOM')).resolves.toBeNull();
  });

  it('rejects the removed flat state response', async () => {
    const state = buildInitialGameState('ROOM', 'HOST', TEMPLATE);
    mockCfPost.mockResolvedValue({ state, revision: 3 });
    const service = new CFRoomService(WEREWOLF_STATE_CODEC);

    await expect(service.getGameState('ROOM')).rejects.toThrow(
      '/room/state response has unsupported fields',
    );
  });
});
