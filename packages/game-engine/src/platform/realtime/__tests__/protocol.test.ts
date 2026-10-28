import {
  type GameTemplate,
  WEREWOLF_STATE_CODEC,
  WEREWOLF_STATE_IDENTITY,
  werewolfEngine,
} from '../../../games/werewolf/public';
import { createRoomSnapshot } from '../../protocol/roomSnapshot';
import { readTerminalCloseReason, REALTIME_CLOSE_CODE } from '../closeCodes';
import {
  createPresenceFrame,
  createStateUpdateFrame,
  createSyncCurrentFrame,
  createSyncFrame,
  createSyncSnapshotFrame,
  INBOX_HINT_FRAME,
  parseClientFrame,
  parseServerFrame,
} from '../protocol';

const TEMPLATE: GameTemplate = {
  name: 'Realtime protocol',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};

function createSnapshot(revision: number) {
  const state = werewolfEngine.createInitialState(
    { templateRoles: TEMPLATE.roles },
    { roomCode: 'ROOM', hostUserId: 'HOST', nowMs: 1, commandId: 'create-realtime-test' },
  );
  return createRoomSnapshot(state, revision);
}

function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('realtime protocol v2 — client frames', () => {
  it('creates and parses SYNC with and without a known revision', () => {
    const fresh = createSyncFrame('req-1', null);
    const resumed = createSyncFrame('req-2', 7);

    expect(parseClientFrame(roundTrip(fresh))).toEqual(fresh);
    expect(parseClientFrame(roundTrip(resumed))).toEqual(resumed);
  });

  it.each([
    [
      { type: 'SYNC', requestId: '', knownRevision: null },
      'SyncFrame.requestId must be a non-empty string',
    ],
    [
      { type: 'SYNC', requestId: 'r', knownRevision: 0 },
      'SyncFrame.knownRevision must be a positive revision',
    ],
    [
      { type: 'SYNC', requestId: 'r', knownRevision: 1.5 },
      'SyncFrame.knownRevision must be a safe integer',
    ],
    [{ type: 'SYNC', requestId: 'r' }, 'SyncFrame.knownRevision must be a finite number'],
    [
      { type: 'SYNC', requestId: 'r', knownRevision: null, extra: 1 },
      'SyncFrame contains unknown field: extra',
    ],
    [
      { type: 'STATE_SYNC_REQUEST', requestId: 'r' },
      'ClientFrame.type must be a supported client frame type',
    ],
    ['ping', 'ClientFrame must be an object'],
  ])('rejects malformed client frame %j', (frame, message) => {
    expect(() => parseClientFrame(frame)).toThrow(message);
  });

  it('rejects constructing SYNC with an invalid known revision', () => {
    expect(() => createSyncFrame('req', -1)).toThrow(
      'SyncFrame.knownRevision must be a positive revision',
    );
    expect(() => createSyncFrame('', null)).toThrow(
      'SyncFrame.requestId must be a non-empty string',
    );
  });
});

describe('realtime protocol v2 — server frames', () => {
  it('round-trips SYNC_RESULT current', () => {
    const frame = createSyncCurrentFrame('req-1', 9);
    expect(parseServerFrame(roundTrip(frame), WEREWOLF_STATE_CODEC)).toEqual(frame);
  });

  it('round-trips SYNC_RESULT snapshot through the game codec', () => {
    const frame = createSyncSnapshotFrame('req-1', createSnapshot(4));
    expect(parseServerFrame(roundTrip(frame), WEREWOLF_STATE_CODEC)).toEqual(frame);
  });

  it('round-trips STATE_UPDATE with and without a command type', () => {
    const withCommand = createStateUpdateFrame(createSnapshot(5), 'room.seat.take');
    const withoutCommand = createStateUpdateFrame(createSnapshot(6), null);

    expect(parseServerFrame(roundTrip(withCommand), WEREWOLF_STATE_CODEC)).toEqual(withCommand);
    expect(parseServerFrame(roundTrip(withoutCommand), WEREWOLF_STATE_CODEC)).toEqual(
      withoutCommand,
    );
  });

  it('round-trips PRESENCE with deduplicated, sorted user IDs', () => {
    const frame = createPresenceFrame(['u2', 'u1', 'u2']);

    expect(frame.onlineUserIds).toEqual(['u1', 'u2']);
    expect(parseServerFrame(roundTrip(frame), WEREWOLF_STATE_CODEC)).toEqual(frame);
  });

  it('round-trips INBOX_HINT', () => {
    expect(parseServerFrame(roundTrip(INBOX_HINT_FRAME), WEREWOLF_STATE_CODEC)).toEqual(
      INBOX_HINT_FRAME,
    );
  });

  it('rejects snapshot identity drift at construction', () => {
    const drifted = {
      ...createSnapshot(4),
      stateVersion: WEREWOLF_STATE_IDENTITY.stateVersion + 1,
    };

    expect(() => createSyncSnapshotFrame('req', drifted)).toThrow(
      'Snapshot identity does not match its state',
    );
    expect(() => createStateUpdateFrame(drifted, null)).toThrow(
      'Snapshot identity does not match its state',
    );
  });

  it.each([
    [
      { type: 'SYNC_RESULT', requestId: 'r', outcome: 'current', revision: 0 },
      'SyncResultFrame.revision must be a positive revision',
    ],
    [
      { type: 'SYNC_RESULT', requestId: 'r', outcome: 'stale', revision: 1 },
      "SyncResultFrame.outcome must be 'current' or 'snapshot'",
    ],
    [
      { type: 'SYNC_RESULT', requestId: 'r', outcome: 'current', revision: 1, snapshot: {} },
      'SyncResultFrame contains unknown field: snapshot',
    ],
    [
      { type: 'STATE_UPDATE', snapshot: createSnapshot(1), commandType: '' },
      'StateUpdateFrame.commandType must be a non-empty string',
    ],
    [
      {
        type: 'STATE_UPDATE',
        snapshot: createSnapshot(1),
        commandType: null,
        lastCommandType: null,
      },
      'StateUpdateFrame contains unknown field: lastCommandType',
    ],
    [
      { type: 'PRESENCE', onlineUserIds: ['a', 'a'] },
      'PresenceFrame.onlineUserIds must be a list of distinct user IDs',
    ],
    [
      { type: 'PRESENCE', onlineUserIds: ['a', ''] },
      'PresenceFrame.onlineUserIds[1] must be a non-empty string',
    ],
    [{ type: 'INBOX_HINT', eventId: 'x' }, 'InboxHintFrame contains unknown field: eventId'],
    [
      { type: 'STATE_SYNC_RESPONSE', requestId: 'r' },
      'ServerFrame.type must be a supported server frame type',
    ],
    [[], 'ServerFrame must be an object'],
  ])('rejects malformed server frame %j', (frame, message) => {
    expect(() => parseServerFrame(frame, WEREWOLF_STATE_CODEC)).toThrow(message);
  });

  it('delegates snapshot payload validation to the game codec', () => {
    const frame = roundTrip(createStateUpdateFrame(createSnapshot(2), null)) as {
      snapshot: { state: Record<string, unknown> };
    };
    frame.snapshot.state = { ...frame.snapshot.state, status: 'not-a-status' };

    expect(() => parseServerFrame(frame, WEREWOLF_STATE_CODEC)).toThrow();
  });
});

describe('realtime close codes', () => {
  it.each([
    [REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol'],
    [REALTIME_CLOSE_CODE.ROOM_DELETED, 'roomDeleted'],
    [REALTIME_CLOSE_CODE.ROOM_INSTANCE_MISMATCH, 'instanceMismatch'],
    [REALTIME_CLOSE_CODE.AUTH_REJECTED, 'authRejected'],
    [REALTIME_CLOSE_CODE.STATE_UNAVAILABLE, 'stateUnavailable'],
  ])('treats %i as terminal (%s)', (code, reason) => {
    expect(readTerminalCloseReason(code)).toBe(reason);
  });

  it.each([1000, 1001, 1005, 1006, 1011, 1012, 1013, 4004, 4999])(
    'treats %i as retryable',
    (code) => {
      expect(readTerminalCloseReason(code)).toBeNull();
    },
  );
});
