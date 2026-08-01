import {
  type GameTemplate,
  WEREWOLF_STATE_CODEC,
  WEREWOLF_STATE_IDENTITY,
  werewolfEngine,
} from '../../../games/werewolf/public';
import {
  createRoomSnapshot,
  createStateUpdateMessage,
  parseRoomSnapshot,
  parseStateUpdateMessage,
} from '../roomSnapshot';

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

  it('creates a discriminator-bearing realtime message', () => {
    const state = createState();
    const snapshot = createRoomSnapshot(state, 4);

    expect(createStateUpdateMessage(snapshot, 'room.seat.take')).toEqual({
      type: 'STATE_UPDATE',
      ...snapshot,
      lastCommandType: 'room.seat.take',
    });
  });

  it('rejects snapshot identity drift before broadcast', () => {
    const state = createState();
    const snapshot = {
      ...createRoomSnapshot(state, 4),
      stateVersion: UNSUPPORTED_WEREWOLF_STATE_VERSION,
    };

    expect(() => createStateUpdateMessage(snapshot, null)).toThrow(
      'Snapshot identity does not match its state',
    );
  });

  it('decodes the same snapshot envelope used by HTTP reconnects', () => {
    const state = createState();
    const snapshot = createRoomSnapshot(state, 3);
    const encoded: unknown = JSON.parse(JSON.stringify(snapshot));

    expect(parseRoomSnapshot(encoded, WEREWOLF_STATE_CODEC)).toEqual(snapshot);
  });

  it('decodes the same envelope inside realtime updates', () => {
    const state = createState();
    const message = createStateUpdateMessage(createRoomSnapshot(state, 5), 'room.seat.take');
    const encoded: unknown = JSON.parse(JSON.stringify(message));

    expect(parseStateUpdateMessage(encoded, WEREWOLF_STATE_CODEC)).toEqual(message);
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
