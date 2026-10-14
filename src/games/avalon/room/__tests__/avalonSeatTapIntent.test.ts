/**
 * getAvalonSeatTapIntent: the shared seat-tap contract (ruling 3) over a
 * real lobby state — blocked taps stay local, occupied seats open the
 * profile, empty seats take or move. States come from the real engine.
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
} from '@game-judge/game-engine/games/avalon/public';

import { getAvalonSeatTapIntent } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function lobbyState(): AvalonState {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonPublicCommand, userId = 'host') => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
    return state;
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  return state;
}

describe('getAvalonSeatTapIntent', () => {
  it('blocks locally when the seat carries a disabled reason', () => {
    const state = lobbyState();
    expect(
      getAvalonSeatTapIntent({ state, seat: 1, currentSeat: null, disabledReason: '座位不可用' }),
    ).toEqual({ kind: 'blocked', reason: '座位不可用' });
    expect(
      getAvalonSeatTapIntent({ state, seat: 0, currentSeat: null, disabledReason: '座位不可用' })
        .kind,
    ).toBe('blocked');
  });

  it('opens the profile for an occupied seat', () => {
    const state = lobbyState();
    const intent = getAvalonSeatTapIntent({ state, seat: 0, currentSeat: null });
    expect(intent.kind).toBe('profile');
    if (intent.kind === 'profile') {
      expect(intent.target).toMatchObject({ seat: 0, userId: 'host', occupantKind: 'human' });
    }
  });

  it('takes an empty seat when unseated and moves when seated', () => {
    const state = lobbyState();
    expect(getAvalonSeatTapIntent({ state, seat: 1, currentSeat: null })).toEqual({
      kind: 'take',
      seat: 1,
    });
    expect(getAvalonSeatTapIntent({ state, seat: 1, currentSeat: 0 })).toEqual({
      kind: 'move',
      seat: 1,
    });
  });
});
