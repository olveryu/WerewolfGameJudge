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
      success: true as const,
      state: STATE,
      revision: 3,
      sideEffects: [{ type: 'BROADCAST_STATE' }],
    };

    expect(createRoomCommandResult(internalResult)).toEqual({
      success: true,
      snapshot: {
        gameType: 'werewolf',
        stateVersion: 1,
        revision: 3,
        state: STATE,
      },
    });
  });

  it('round-trips a successful result through the runtime codec', () => {
    const encoded = createRoomCommandResult({
      success: true,
      state: STATE,
      revision: 4,
      reason: 'DEDUPLICATED',
    });

    expect(parseRoomCommandResult(encoded, CODEC)).toEqual(encoded);
  });

  it('round-trips a domain rejection without a snapshot', () => {
    expect(parseRoomCommandResult({ success: false, reason: 'seat_taken' }, CODEC)).toEqual({
      success: false,
      reason: 'seat_taken',
    });
  });

  it('rejects leaked internal side effects', () => {
    const encoded = createRoomCommandResult({ success: true, state: STATE, revision: 2 });
    if (!encoded.success) throw new Error(`Expected success, received ${encoded.reason}`);

    expect(() =>
      parseRoomCommandResult(
        {
          success: true,
          snapshot: encoded.snapshot,
          sideEffects: [],
        },
        CODEC,
      ),
    ).toThrow('RoomCommandResult contains unknown field: sideEffects');
  });

  it('rejects success without the committed snapshot', () => {
    expect(() => parseRoomCommandResult({ success: true }, CODEC)).toThrow(
      'Successful RoomCommandResult must contain snapshot',
    );
  });
});
