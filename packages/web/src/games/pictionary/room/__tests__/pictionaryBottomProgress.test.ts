/**
 * derivePictionaryBottomProgress: only the gallery feeds the bottom panel's progress row; the
 * relay steps report their progress in the stage information bar, and every other phase has no
 * step progress.
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

import {
  PICTIONARY_TEST_PLAYER_NAMES,
  playPictionaryTestRound,
} from '@/test-utils/pictionaryState';

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

  it('is null on the relay steps, which report progress in the stage information bar', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    session.dispatch({ type: 'room.seat.fillBots' });
    session.dispatch({ type: 'pictionary.game.begin' });
    expect(session.state.phase).toBe('answering');
    expect(derivePictionaryBottomProgress(session.state)).toBeNull();
  });

  it('reports the first gallery entry as the reveal opens', () => {
    const stepCount = getPictionaryRelayStepCount(PICTIONARY_TEST_PLAYER_NAMES.length);
    const state = playPictionaryTestRound({
      stopAt: { stepIndex: stepCount - 1, phase: 'gallery' },
    });
    expect(derivePictionaryBottomProgress(state)).toEqual({
      current: 1,
      total: PICTIONARY_TEST_PLAYER_NAMES.length * stepCount,
      label: '接龙揭晓中',
    });
  });
});
