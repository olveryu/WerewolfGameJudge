/**
 * createPictionaryHostManagement next step: the strip model is derived
 * from the same lobby start action the panel renders — blocked with the
 * seat reason and a share remedy until the room is full, ready after.
 */
import {
  createPictionaryCommand,
  decidePictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryUserSeat,
  type PictionaryCommandInput,
  pictionaryEngine,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  createPictionaryHostManagement,
  createPictionaryRoomCapabilities,
} from '../pictionaryRoomAdapter';

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
      randomSeed: 'next-step',
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

function build(state: PictionaryState) {
  const shareRoom = jest.fn();
  const capabilities = createPictionaryRoomCapabilities({
    state,
    isHost: true,
    mySeat: 0,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    openProfile: jest.fn(),
    takeOverBot: jest.fn(),
    shareRoom,
  });
  const model = createPictionaryHostManagement({
    state,
    isHost: true,
    capabilities,
    isCommandSubmitting: false,
    startRound: jest.fn(),
    nextRound: jest.fn(),
    returnToLobby: jest.fn(),
    finishPhase: jest.fn(),
    abortRound: jest.fn(),
    onStartDisabled: jest.fn(),
  });
  return { model, shareRoom };
}

describe('createPictionaryHostManagement next step', () => {
  it('blocks game start in a non-full lobby and offers room sharing as the remedy', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    const { model, shareRoom } = build(session.state);
    expect(model?.preview).toBe('下一步：开始游戏');
    const step = model?.nextStep;
    expect(step).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
    if (step?.state.kind !== 'blocked') throw new Error('expected a blocked next step');
    expect(step.state.reason).toBe('座位尚未坐满');
    expect(step.state.remedy?.label).toBe('分享房间');
    step.state.remedy?.onPress();
    expect(shareRoom).toHaveBeenCalledTimes(1);
  });

  it('offers game start once every seat is taken', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    session.dispatch({ type: 'room.seat.fillBots' });
    const { model } = build(session.state);
    const step = model?.nextStep;
    expect(step).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
    if (step?.state.kind !== 'ready') throw new Error('expected a ready next step');
  });
});
