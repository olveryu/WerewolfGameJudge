import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { WEREWOLF_STATE_CODEC } from '@werewolf/game-engine/games/werewolf/public';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import { cfPost } from '../cfFetch';
import { CFRoomStateService } from '../CFRoomStateService';

jest.mock('../cfFetch', () => ({ cfPost: jest.fn() }));

const TEMPLATE: GameTemplate = {
  name: 'Room state service',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};
const ROOM = { roomCode: '4567', roomId: 'room-id-4567' } as const;
const mockCfPost = jest.mocked(cfPost);

describe('CFRoomStateService', () => {
  beforeEach(() => mockCfPost.mockReset());

  it('decodes the canonical snapshot response', async () => {
    const snapshot = createRoomSnapshot(buildInitialGameState('4567', 'HOST', TEMPLATE), 3);
    mockCfPost.mockResolvedValue({ snapshot });

    await expect(new CFRoomStateService(WEREWOLF_STATE_CODEC).getGameState(ROOM)).resolves.toEqual(
      snapshot,
    );
  });

  it('returns null only for an explicit null snapshot', async () => {
    mockCfPost.mockResolvedValue({ snapshot: null });

    await expect(
      new CFRoomStateService(WEREWOLF_STATE_CODEC).getGameState(ROOM),
    ).resolves.toBeNull();
  });

  it('rejects a removed flat state response', async () => {
    const state = buildInitialGameState('4567', 'HOST', TEMPLATE);
    mockCfPost.mockResolvedValue({ state, revision: 3 });

    await expect(new CFRoomStateService(WEREWOLF_STATE_CODEC).getGameState(ROOM)).rejects.toThrow(
      '/room/state response has unsupported fields',
    );
  });

  it('accepts only positive integer revisions or null', async () => {
    const service = new CFRoomStateService(WEREWOLF_STATE_CODEC);
    mockCfPost.mockResolvedValueOnce({ revision: 4 }).mockResolvedValueOnce({ revision: 0 });

    await expect(service.getStateRevision(ROOM)).resolves.toBe(4);
    await expect(service.getStateRevision(ROOM)).rejects.toThrow(
      '/room/revision returned an invalid revision',
    );
  });
});
