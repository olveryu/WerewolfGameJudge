/**
 * createPictionaryHostManagement task body: the console model is
 * derived from the same lobby start action the panel renders — blocked
 * with the seat reason and a share remedy until the room is full, ready
 * after.
 */
import {
  createPictionaryCommand,
  decidePictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryOccupiedSeatCount,
  getPictionaryUserSeat,
  isPictionaryRoomFull,
  type PictionaryCommandInput,
  pictionaryEngine,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  createViewProfilesCapability,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import { hostTaskBody } from '@/test-utils/hostTask';

import { createPictionaryHostManagement } from '../pictionaryRoomAdapter';

/** Mirrors the hook's capability assembly: shared setup capabilities + host-only takeover. */
function testCapabilities(input: {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly shareRoom: () => void;
}): RoomCapabilities {
  const isLobby = input.state.phase === 'lobby';
  return {
    ...createRoomSetupCapabilities({
      isSetup: isLobby,
      isHost: input.isHost,
      supportsBots: true,
      mySeat: input.mySeat,
      hasOccupiedSeats: getPictionaryOccupiedSeatCount(input.state) > 0,
      isRoomFull: isPictionaryRoomFull(input.state),
      requestTakeSeat: jest.fn(),
      requestMoveSeat: jest.fn(),
      leaveSeat: jest.fn(),
      kickSeat: jest.fn(),
      clearSeats: jest.fn(),
      fillBots: jest.fn(),
      configureGame: jest.fn(),
      shareRoom: input.shareRoom,
    }),
    canViewProfiles: createViewProfilesCapability(isLobby, jest.fn()),
    canTakeOverBots: createBotTakeoverCapability(input.isHost, jest.fn()),
  };
}

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
  const capabilities = testCapabilities({ state, isHost: true, mySeat: 0, shareRoom });
  const model = createPictionaryHostManagement({
    state,
    capabilities,
    isCommandSubmitting: false,
    startRound: jest.fn(),
    nextRound: jest.fn(),
    returnToLobby: jest.fn(),
    abortRound: jest.fn(),
  });
  return { model, shareRoom };
}

describe('createPictionaryHostManagement task body', () => {
  it('keeps only abort during editing with no host advancement task', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    session.dispatch({ type: 'room.seat.fillBots' });
    session.dispatch({ type: 'pictionary.game.begin' });
    const { model } = build(session.state);
    expect(model.task).toBeNull();
    expect(model.sections.map((section) => section.key)).toEqual(['danger']);
    expect(model.sections[0]!.actions.map((action) => action.key)).toEqual(['abort-game']);
  });

  it('blocks game start in a non-full lobby and offers room sharing as the remedy', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    const { model, shareRoom } = build(session.state);
    const step = hostTaskBody(model);
    expect(step).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (step?.kind !== 'blocked') throw new Error('expected a blocked task body');
    expect(step.reason).toBe('座位尚未坐满（还差 3 人）');
    expect(step.remedy?.label).toBe('分享房间');
    step.remedy?.onPress();
    expect(shareRoom).toHaveBeenCalledTimes(1);
  });

  it('offers game start once every seat is taken', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    session.dispatch({ type: 'room.seat.fillBots' });
    const { model } = build(session.state);
    const step = hostTaskBody(model);
    expect(step).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (step?.kind !== 'ready') throw new Error('expected a ready task body');
  });
});
