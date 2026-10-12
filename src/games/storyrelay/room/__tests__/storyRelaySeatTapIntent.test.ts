/**
 * getStoryRelaySeatTapIntent: the shared seat-tap contract (ruling 3) over a
 * real lobby state — blocked taps stay local, occupied seats open the
 * profile, empty seats take or move. States come from the real engine.
 */
import {
  DEFAULT_STORY_RELAY_CONFIG,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import { getStoryRelaySeatTapIntent } from '../storyRelayRoomAdapter';

type CommandContext = Parameters<typeof storyRelayEngine.decide>[2];

function lobbyState(): StoryRelayState {
  let commandNumber = 0;
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: StoryRelayCommand, userId = 'host') => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(storyRelayEngine.evolve, state);
    return state;
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  return state;
}

describe('getStoryRelaySeatTapIntent', () => {
  it('blocks locally when the seat carries a disabled reason', () => {
    const state = lobbyState();
    expect(
      getStoryRelaySeatTapIntent({
        state,
        seat: 1,
        currentSeat: null,
        disabledReason: '座位不可用',
      }),
    ).toEqual({ kind: 'blocked', reason: '座位不可用' });
    expect(
      getStoryRelaySeatTapIntent({
        state,
        seat: 0,
        currentSeat: null,
        disabledReason: '座位不可用',
      }).kind,
    ).toBe('blocked');
  });

  it('opens the profile for an occupied seat', () => {
    const state = lobbyState();
    const intent = getStoryRelaySeatTapIntent({ state, seat: 0, currentSeat: null });
    expect(intent.kind).toBe('profile');
    if (intent.kind === 'profile') {
      expect(intent.target).toMatchObject({ seat: 0, userId: 'host', occupantKind: 'human' });
    }
  });

  it('takes an empty seat when unseated and moves when seated', () => {
    const state = lobbyState();
    expect(getStoryRelaySeatTapIntent({ state, seat: 1, currentSeat: null })).toEqual({
      kind: 'take',
      seat: 1,
    });
    expect(getStoryRelaySeatTapIntent({ state, seat: 1, currentSeat: 0 })).toEqual({
      kind: 'move',
      seat: 1,
    });
  });
});
