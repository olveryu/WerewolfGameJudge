import {
  type GameTemplate,
  WEREWOLF_STATE_CODEC,
  WEREWOLF_STATE_IDENTITY,
  werewolfEngine,
} from '../../../games/werewolf/public';
import { createRoomSnapshot, parseRoomSnapshot } from '../roomSnapshot';

const TEMPLATE: GameTemplate = {
  name: 'Snapshot contract',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};

const UNSUPPORTED_WEREWOLF_STATE_VERSION = WEREWOLF_STATE_IDENTITY.stateVersion + 1;

function createState() {
  return werewolfEngine.createInitialState(
    { templateRoles: TEMPLATE.roles },
    { roomCode: 'ROOM', hostUserId: 'HOST', nowMs: 1, commandId: 'create-snapshot-test' },
  );
}

describe('room snapshot protocol', () => {
  it('copies authoritative state identity into the envelope', () => {
    const state = createState();

    expect(createRoomSnapshot(state, 7)).toEqual({
      ...WEREWOLF_STATE_IDENTITY,
      revision: 7,
      state,
    });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid revision %p', (revision) => {
    const state = createState();
    expect(() => createRoomSnapshot(state, revision)).toThrow(
      'revision must be a positive safe integer',
    );
  });

  it('rejects an invalid state version', () => {
    const state = { ...createState(), stateVersion: 0 };

    expect(() => createRoomSnapshot(state, 1)).toThrow(
      'stateVersion must be a positive safe integer',
    );
  });

  it('decodes the authoritative room snapshot envelope', () => {
    const state = createState();
    const snapshot = createRoomSnapshot(state, 3);
    const encoded: unknown = JSON.parse(JSON.stringify(snapshot));

    expect(parseRoomSnapshot(encoded, WEREWOLF_STATE_CODEC)).toEqual(snapshot);
  });

  it('rejects unknown envelope fields', () => {
    const state = createState();
    const encoded = { ...createRoomSnapshot(state, 3), legacyRevision: 2 };

    expect(() => parseRoomSnapshot(encoded, WEREWOLF_STATE_CODEC)).toThrow(
      'RoomSnapshot contains unknown field: legacyRevision',
    );
  });

  it('rejects envelope and payload identity drift', () => {
    const state = createState();
    const encoded = {
      ...createRoomSnapshot(state, 3),
      stateVersion: UNSUPPORTED_WEREWOLF_STATE_VERSION,
    };

    expect(() => parseRoomSnapshot(encoded, WEREWOLF_STATE_CODEC)).toThrow(
      `Unsupported snapshot state version: ${UNSUPPORTED_WEREWOLF_STATE_VERSION}`,
    );
  });
});
