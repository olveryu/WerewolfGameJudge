import { createRoomCommandResult, parseRoomCommandResult } from '../commandResult';
import type { BaseGameState, GameStateCodec } from '../roomSnapshot';

interface TestState extends BaseGameState<'werewolf'> {
  readonly value: number;
}

const STATE: TestState = {
  gameType: 'werewolf',
  stateVersion: 1,
  roomCode: '1234',
  hostUserId: 'host-1',
  value: 7,
};

const CODEC: GameStateCodec<TestState> = {
  gameType: 'werewolf',
  stateVersion: 1,
  parse(value: unknown): TestState {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('TestState must be an object');
    }
    const raw = value as Record<string, unknown>;
    if (
      raw.gameType !== 'werewolf' ||
      raw.stateVersion !== 1 ||
      typeof raw.roomCode !== 'string' ||
      typeof raw.hostUserId !== 'string' ||
      typeof raw.value !== 'number'
    ) {
      throw new Error('Invalid TestState');
    }
    return {
      gameType: raw.gameType,
      stateVersion: raw.stateVersion,
      roomCode: raw.roomCode,
      hostUserId: raw.hostUserId,
      value: raw.value,
    };
  },
};

describe('RoomCommandResult protocol', () => {
  it('projects an internal success result to a public snapshot envelope', () => {
    const internalResult = {
      kind: 'committed' as const,
      commandId: 'command-1',
      state: STATE,
      revision: 3,
      outcome: { kind: 'success' } as const,
      sideEffects: [{ type: 'BROADCAST_STATE' }],
    };

    expect(createRoomCommandResult(internalResult)).toEqual({
      kind: 'committed',
      commandId: 'command-1',
      snapshot: {
        gameType: 'werewolf',
        stateVersion: 1,
        revision: 3,
        state: STATE,
      },
      outcome: { kind: 'success' },
    });
  });

  it('round-trips a committed success through the runtime codec', () => {
    const encoded = createRoomCommandResult({
      kind: 'committed',
      commandId: 'command-2',
      state: STATE,
      revision: 4,
      outcome: { kind: 'success', reason: 'DEDUPLICATED' },
    });

    expect(parseRoomCommandResult(encoded, CODEC)).toEqual(encoded);
  });

  it('round-trips a committed domain rejection with its snapshot', () => {
    const encoded = createRoomCommandResult({
      kind: 'committed',
      commandId: 'command-3',
      state: STATE,
      revision: 5,
      outcome: { kind: 'domainRejected', reason: 'seat_taken' },
    });

    expect(parseRoomCommandResult(encoded, CODEC)).toEqual(encoded);
  });

  it('parses an uncommitted rejection without a snapshot', () => {
    expect(
      parseRoomCommandResult(
        { kind: 'rejected', commandId: 'command-4', reason: 'seat_taken' },
        CODEC,
      ),
    ).toEqual({
      kind: 'rejected',
      commandId: 'command-4',
      reason: 'seat_taken',
    });
  });

  it('rejects leaked internal side effects', () => {
    const encoded = createRoomCommandResult({
      kind: 'committed',
      commandId: 'command-5',
      state: STATE,
      revision: 2,
      outcome: { kind: 'success' },
    });
    if (encoded.kind !== 'committed') {
      throw new Error(`Expected committed result, received ${encoded.reason}`);
    }

    expect(() =>
      parseRoomCommandResult(
        {
          kind: 'committed',
          commandId: encoded.commandId,
          snapshot: encoded.snapshot,
          outcome: encoded.outcome,
          sideEffects: [],
        },
        CODEC,
      ),
    ).toThrow('RoomCommandResult contains unknown field: sideEffects');
  });

  it('rejects transport fields on an uncommitted rejection', () => {
    expect(() =>
      parseRoomCommandResult(
        {
          kind: 'rejected',
          commandId: 'command-6',
          reason: 'seat_taken',
          snapshot: { revision: 1 },
        },
        CODEC,
      ),
    ).toThrow('RoomCommandResult contains unknown field: snapshot');
  });

  it('rejects unknown fields inside the committed outcome', () => {
    const encoded = createRoomCommandResult({
      kind: 'committed',
      commandId: 'command-7',
      state: STATE,
      revision: 2,
      outcome: { kind: 'success' },
    });
    if (encoded.kind !== 'committed') {
      throw new Error(`Expected committed result, received ${encoded.reason}`);
    }

    expect(() =>
      parseRoomCommandResult(
        {
          kind: 'committed',
          commandId: encoded.commandId,
          snapshot: encoded.snapshot,
          outcome: { kind: 'success', internal: true },
        },
        CODEC,
      ),
    ).toThrow('RoomCommandResult outcome contains unknown field: internal');
  });

  it('rejects a committed result without the snapshot', () => {
    expect(() =>
      parseRoomCommandResult(
        {
          kind: 'committed',
          commandId: 'command-8',
          outcome: { kind: 'success' },
        },
        CODEC,
      ),
    ).toThrow('Committed RoomCommandResult must contain snapshot');
  });

  it('rejects a committed result without the outcome', () => {
    const encoded = createRoomCommandResult({
      kind: 'committed',
      commandId: 'command-9',
      state: STATE,
      revision: 2,
      outcome: { kind: 'success' },
    });
    if (encoded.kind !== 'committed') {
      throw new Error(`Expected committed result, received ${encoded.reason}`);
    }

    expect(() =>
      parseRoomCommandResult(
        {
          kind: 'committed',
          commandId: encoded.commandId,
          snapshot: encoded.snapshot,
        },
        CODEC,
      ),
    ).toThrow('Committed RoomCommandResult must contain outcome');
  });

  it.each([
    [{ kind: 'domainRejected' }, 'RoomCommandResult outcome reason must be a non-empty string'],
    [
      { kind: 'success', reason: '' },
      'RoomCommandResult outcome reason must be a non-empty string',
    ],
    [{ kind: 'other' }, 'RoomCommandResult outcome kind must be success or domainRejected'],
  ])('rejects an invalid committed outcome %#', (outcome, message) => {
    const encoded = createRoomCommandResult({
      kind: 'committed',
      commandId: 'command-10',
      state: STATE,
      revision: 2,
      outcome: { kind: 'success' },
    });
    if (encoded.kind !== 'committed') {
      throw new Error(`Expected committed result, received ${encoded.reason}`);
    }

    expect(() =>
      parseRoomCommandResult(
        {
          kind: 'committed',
          commandId: encoded.commandId,
          snapshot: encoded.snapshot,
          outcome,
        },
        CODEC,
      ),
    ).toThrow(message);
  });

  it.each(['', 'x'.repeat(201)])('rejects an invalid command ID', (commandId) => {
    expect(() =>
      parseRoomCommandResult({ kind: 'rejected', commandId, reason: 'seat_taken' }, CODEC),
    ).toThrow('RoomCommandResult commandId must contain between 1 and 200 characters');
  });
});
