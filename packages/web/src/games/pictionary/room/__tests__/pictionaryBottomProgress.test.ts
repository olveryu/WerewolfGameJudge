/**
 * derivePictionaryBottomProgress: the retired status ribbon's stepped
 * phases (answering / transition / gallery) feed the bottom panel's
 * progress row with the same counts and labels; every other phase has
 * no step progress.
 */
import {
  createPictionaryCommand,
  decidePictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryRelayStepCount,
  getPictionaryUserSeat,
  type PictionaryCommandInput,
  pictionaryEngine,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { derivePictionaryBottomProgress } from '../pictionaryRoomAdapter';

function createSession() {
  let sequence = 0;
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '2468', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const dispatch = (command: PictionaryCommandInput) => {
    sequence += 1;
    const seat = getPictionaryUserSeat(state, 'host') ?? 0;
    const decision = decidePictionaryCommand(state, createPictionaryCommand(state, command, seat), {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat: null,
      nowMs: 1000 + sequence,
      commandId: `command-${sequence}`,
      randomSeed: 'progress',
    });
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    for (const event of decision.events) state = pictionaryEngine.evolve(state, event);
    state = pictionaryEngine.normalize(state);
  };
  return {
    get state(): PictionaryState {
      return state;
    },
    dispatch,
  };
}

describe('derivePictionaryBottomProgress', () => {
  it('is null in the lobby', () => {
    const session = createSession();
    expect(derivePictionaryBottomProgress(session.state)).toBeNull();
  });

  it('reports the first relay step once the round starts', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    session.dispatch({ type: 'room.seat.fillBots' });
    session.dispatch({ type: 'pictionary.game.begin' });
    expect(session.state.phase).toBe('answering');
    expect(derivePictionaryBottomProgress(session.state)).toEqual({
      current: 1,
      total: getPictionaryRelayStepCount(4),
      label: '全员出题中',
    });
  });
});
