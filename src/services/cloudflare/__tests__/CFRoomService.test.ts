import { WEREWOLF_STATE_CODEC } from '@werewolf/game-engine';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import { cfPost } from '../cfFetch';
import { CFRoomService } from '../CFRoomService';

jest.mock('../cfFetch', () => ({
  cfPost: jest.fn(),
}));

const TEMPLATE: GameTemplate = {
  name: 'Room service',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};

const mockCfPost = jest.mocked(cfPost);

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
      'Invalid /room/state response envelope',
    );
  });
});
