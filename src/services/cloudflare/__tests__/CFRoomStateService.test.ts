import type { GameTemplate } from '@game-judge/game-engine/games/werewolf/public';
import {
  WEREWOLF_STATE_CODEC,
  werewolfEngine,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

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

function createState() {
  return werewolfEngine.createInitialState(
    { templateRoles: TEMPLATE.roles },
    { roomCode: '4567', hostUserId: 'HOST', nowMs: 1, commandId: 'create-room-state-test' },
  );
}

function respondWithJson(value: unknown): void {
  mockCfPost.mockImplementationOnce(async (_path, _body, decode) => decode(value));
}

describe('CFRoomStateService', () => {
  beforeEach(() => mockCfPost.mockReset());

  it('decodes the canonical snapshot response', async () => {
    const snapshot = createRoomSnapshot(createState(), 3);
    respondWithJson({ snapshot });

    await expect(new CFRoomStateService(WEREWOLF_STATE_CODEC).getGameState(ROOM)).resolves.toEqual(
      snapshot,
    );
  });

  it('returns null only for an explicit null snapshot', async () => {
    respondWithJson({ snapshot: null });

    await expect(
      new CFRoomStateService(WEREWOLF_STATE_CODEC).getGameState(ROOM),
    ).resolves.toBeNull();
  });

  it('rejects a removed flat state response', async () => {
    const state = createState();
    respondWithJson({ state, revision: 3 });

    await expect(new CFRoomStateService(WEREWOLF_STATE_CODEC).getGameState(ROOM)).rejects.toThrow(
      '/room/state response has unsupported fields',
    );
  });

  it('accepts only positive integer revisions or null', async () => {
    const service = new CFRoomStateService(WEREWOLF_STATE_CODEC);
    respondWithJson({ revision: 4 });
    respondWithJson({ revision: 0 });

    await expect(service.getStateRevision(ROOM)).resolves.toBe(4);
    await expect(service.getStateRevision(ROOM)).rejects.toThrow(
      '/room/revision returned an invalid revision',
    );
  });
});
