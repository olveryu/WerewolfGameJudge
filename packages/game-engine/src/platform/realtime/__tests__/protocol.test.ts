import {
  type GameTemplate,
  WEREWOLF_STATE_CODEC,
  WEREWOLF_STATE_IDENTITY,
  werewolfEngine,
} from '../../../games/werewolf/public';
import { createRoomCommandResult, RoomCommandProtocolError } from '../../protocol/commandResult';
import { createRoomSnapshot } from '../../protocol/roomSnapshot';
import { readTerminalCloseReason, REALTIME_CLOSE_CODE } from '../closeCodes';
import {
  createCommandDecidedFrame,
  createCommandFrame,
  createCommandThrottledFrame,
  createCommandUnavailableFrame,
  createStateUpdateFrame,
  createSyncCurrentFrame,
  createSyncFrame,
  createSyncSnapshotFrame,
  INBOX_HINT_FRAME,
  parseClientFrame,
  parseServerFrame,
  RealtimeProtocolError,
} from '../protocol';

const TEMPLATE: GameTemplate = {
  name: 'Realtime protocol',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};

function createState() {
  return werewolfEngine.createInitialState(
    { templateRoles: TEMPLATE.roles },
    { roomCode: 'ROOM', hostUserId: 'HOST', nowMs: 1, commandId: 'create-realtime-test' },
  );
}

function createSnapshot(revision: number) {
  return createRoomSnapshot(createState(), revision);
}

function createCommittedResult(commandId: string) {
  return createRoomCommandResult({
    kind: 'committed',
    commandId,
    state: createState(),
    revision: 4,
    outcome: { kind: 'success' },
  });
}

function createRejectedResult(commandId: string) {
  return createRoomCommandResult({
    kind: 'rejected',
    commandId,
    reason: 'room.wrong_phase',
  });
}

function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('realtime protocol v3 — client frames', () => {
  it('creates and parses SYNC with and without a known revision', () => {
    const fresh = createSyncFrame('req-1', null);
    const resumed = createSyncFrame('req-2', 7);

    expect(parseClientFrame(roundTrip(fresh))).toEqual(fresh);
    expect(parseClientFrame(roundTrip(resumed))).toEqual(resumed);
  });

  it('creates and parses COMMAND with a seat and without one', () => {
    const seated = createCommandFrame('cmd-1', '1234', { type: 'room.seat.take', seat: 2 }, 2);
    const unseated = createCommandFrame(
      'cmd-2',
      '1234',
      { type: 'room.chat.send', text: 'hi' },
      null,
    );

    expect(parseClientFrame(roundTrip(seated))).toEqual(seated);
    expect(parseClientFrame(roundTrip(unseated))).toEqual(unseated);
  });

  it.each([
    [
      { type: 'SYNC', requestId: '', knownRevision: null },
      'Too small: expected string to have >=1 characters\n  → at requestId',
    ],
    [
      { type: 'SYNC', requestId: 'r', knownRevision: 0 },
      'Too small: expected number to be >0\n  → at knownRevision',
    ],
    [
      { type: 'SYNC', requestId: 'r', knownRevision: 1.5 },
      'Invalid input: expected int, received number\n  → at knownRevision',
    ],
    [
      { type: 'SYNC', requestId: 'r' },
      'Invalid input: expected number, received undefined\n  → at knownRevision',
    ],
    [{ type: 'SYNC', requestId: 'r', knownRevision: null, extra: 1 }, 'Unrecognized key: "extra"'],
    [
      { type: 'STATE_SYNC_REQUEST', requestId: 'r' },
      "Invalid discriminator value. Expected 'SYNC' | 'COMMAND'\n  → at type",
    ],
    ['ping', 'Invalid input: expected object, received string'],
    [
      { type: 'COMMAND', commandId: '', roomCode: '1234', command: {}, controlledSeat: null },
      'Too small: expected string to have >=1 characters\n  → at commandId',
    ],
    [
      {
        type: 'COMMAND',
        commandId: 'c'.repeat(201),
        roomCode: '1234',
        command: {},
        controlledSeat: null,
      },
      'Too big: expected string to have <=200 characters\n  → at commandId',
    ],
    [
      { type: 'COMMAND', commandId: 'c', roomCode: '0123', command: {}, controlledSeat: null },
      'Invalid string: must match pattern /^[1-9][0-9]{3}$/\n  → at roomCode',
    ],
    [
      { type: 'COMMAND', commandId: 'c', roomCode: '123', command: {}, controlledSeat: null },
      'Invalid string: must match pattern /^[1-9][0-9]{3}$/\n  → at roomCode',
    ],
    [
      { type: 'COMMAND', commandId: 'c', roomCode: '1234', command: {}, controlledSeat: 1.5 },
      'Invalid input: expected int, received number\n  → at controlledSeat',
    ],
    [
      { type: 'COMMAND', commandId: 'c', roomCode: '1234', command: {}, controlledSeat: '2' },
      'Invalid input: expected number, received string\n  → at controlledSeat',
    ],
    [
      {
        type: 'COMMAND',
        commandId: 'c',
        roomCode: '1234',
        command: {},
        controlledSeat: null,
        extra: 1,
      },
      'Unrecognized key: "extra"',
    ],
  ])('rejects malformed client frame %j', (frame, message) => {
    expect(() => parseClientFrame(frame)).toThrow(RealtimeProtocolError);
    expect(() => parseClientFrame(frame)).toThrow(`ClientFrame is malformed:\n✖ ${message}`);
  });

  it('rejects constructing COMMAND with an invalid room code or seat', () => {
    expect(() => createCommandFrame('c', '0123', {}, null)).toThrow(
      'CommandFrame is malformed:\n✖ Invalid string: must match pattern /^[1-9][0-9]{3}$/\n  → at roomCode',
    );
    expect(() => createCommandFrame('c', '1234', {}, 1.5)).toThrow(
      'CommandFrame is malformed:\n✖ Invalid input: expected int, received number\n  → at controlledSeat',
    );
  });

  it('rejects constructing SYNC with an invalid known revision', () => {
    expect(() => createSyncFrame('req', -1)).toThrow(
      'SyncFrame is malformed:\n✖ Too small: expected number to be >0\n  → at knownRevision',
    );
    expect(() => createSyncFrame('', null)).toThrow(
      'SyncFrame is malformed:\n✖ Too small: expected string to have >=1 characters\n  → at requestId',
    );
  });
});

describe('realtime protocol v3 — server frames', () => {
  it('round-trips SYNC_RESULT current', () => {
    const frame = createSyncCurrentFrame('req-1', 9);
    expect(parseServerFrame(roundTrip(frame), WEREWOLF_STATE_CODEC)).toEqual(frame);
  });

  it('round-trips COMMAND_RESULT decided with a committed and a rejected result', () => {
    const committed = createCommandDecidedFrame('cmd-1', createCommittedResult('cmd-1'));
    const rejected = createCommandDecidedFrame('cmd-2', createRejectedResult('cmd-2'));

    expect(parseServerFrame(roundTrip(committed), WEREWOLF_STATE_CODEC)).toEqual(committed);
    expect(parseServerFrame(roundTrip(rejected), WEREWOLF_STATE_CODEC)).toEqual(rejected);
  });

  it('round-trips COMMAND_RESULT unavailable and throttled', () => {
    const unavailable = createCommandUnavailableFrame('cmd-1');
    const throttled = createCommandThrottledFrame('cmd-2');

    expect(parseServerFrame(roundTrip(unavailable), WEREWOLF_STATE_CODEC)).toEqual(unavailable);
    expect(parseServerFrame(roundTrip(throttled), WEREWOLF_STATE_CODEC)).toEqual(throttled);
  });

  it('rejects constructing COMMAND_RESULT with an empty command id', () => {
    expect(() => createCommandUnavailableFrame('')).toThrow(
      'CommandResultFrame is malformed:\n✖ Too small: expected string to have >=1 characters\n  → at commandId',
    );
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
      'Too small: expected number to be >0\n  → at revision',
    ],
    [
      { type: 'SYNC_RESULT', requestId: 'r', outcome: 'stale', revision: 1 },
      "Invalid discriminator value. Expected 'current' | 'snapshot'\n  → at outcome",
    ],
    [
      { type: 'SYNC_RESULT', requestId: 'r', outcome: 'current', revision: 1, snapshot: {} },
      'Unrecognized key: "snapshot"',
    ],
    [
      { type: 'STATE_UPDATE', snapshot: createSnapshot(1), commandType: '' },
      'Too small: expected string to have >=1 characters\n  → at commandType',
    ],
    [
      {
        type: 'STATE_UPDATE',
        snapshot: createSnapshot(1),
        commandType: null,
        lastCommandType: null,
      },
      'Unrecognized key: "lastCommandType"',
    ],
    [{ type: 'INBOX_HINT', eventId: 'x' }, 'Unrecognized key: "eventId"'],
    [
      { type: 'COMMAND_RESULT', commandId: 'c', outcome: 'pending' },
      "Invalid discriminator value. Expected 'decided' | 'unavailable' | 'throttled'\n  → at outcome",
    ],
    [
      { type: 'COMMAND_RESULT', commandId: 'c', outcome: 'unavailable', result: {} },
      'Unrecognized key: "result"',
    ],
    [
      { type: 'STATE_SYNC_RESPONSE', requestId: 'r' },
      "Invalid discriminator value. Expected 'SYNC_RESULT' | 'STATE_UPDATE' | 'COMMAND_RESULT' | 'INBOX_HINT'\n  → at type",
    ],
    [[], 'Invalid input: expected object, received array'],
  ])('rejects malformed server frame %j', (frame, message) => {
    expect(() => parseServerFrame(frame, WEREWOLF_STATE_CODEC)).toThrow(RealtimeProtocolError);
    expect(() => parseServerFrame(frame, WEREWOLF_STATE_CODEC)).toThrow(
      `ServerFrame is malformed:\n✖ ${message}`,
    );
  });

  it('delegates command result validation to the command result parser', () => {
    const frame = {
      type: 'COMMAND_RESULT',
      commandId: 'c',
      outcome: 'decided',
      result: { kind: 'bogus' },
    };

    expect(() => parseServerFrame(frame, WEREWOLF_STATE_CODEC)).toThrow(RoomCommandProtocolError);
    expect(() => parseServerFrame(frame, WEREWOLF_STATE_CODEC)).toThrow(
      'RoomCommandResult kind must be committed or rejected',
    );
  });

  it('delegates snapshot payload validation to the game codec', () => {
    const frame = roundTrip(createStateUpdateFrame(createSnapshot(2), null)) as {
      snapshot: { state: Record<string, unknown> };
    };
    frame.snapshot.state = { ...frame.snapshot.state, status: 'not-a-status' };

    expect(() => parseServerFrame(frame, WEREWOLF_STATE_CODEC)).toThrow(/status/);
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
