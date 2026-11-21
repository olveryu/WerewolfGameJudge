/**
 * createPictionaryHostManagement task body: the console model is
 * derived from the same lobby start action the panel renders — blocked
 * with the seat reason and a share remedy until the room is full, ready
 * after — and a finished round closes on the shared review.
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
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { hostTaskBody } from '@/test-utils/hostTask';
import { playPictionaryTestRound } from '@/test-utils/pictionaryState';
import { alertStore } from '@/utils/alert';

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
      requestTakeSeat: vi.fn(),
      requestMoveSeat: vi.fn(),
      leaveSeat: vi.fn(),
      kickSeat: vi.fn(),
      clearSeats: vi.fn(),
      fillBots: vi.fn(),
      configureGame: vi.fn(),
      shareRoom: input.shareRoom,
    }),
    canViewProfiles: createViewProfilesCapability(isLobby, vi.fn()),
    canTakeOverBots: createBotTakeoverCapability(input.isHost, vi.fn()),
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

function build(state: PictionaryState, review: RoomReviewEntry | null = null) {
  const shareRoom = vi.fn();
  const restartRound = vi.fn();
  const capabilities = testCapabilities({ state, isHost: true, mySeat: 0, shareRoom });
  const model = createPictionaryHostManagement({
    state,
    capabilities,
    isCommandSubmitting: false,
    review,
    startRound: vi.fn(),
    restartRound,
  });
  return { model, shareRoom, restartRound };
}

describe('createPictionaryHostManagement task body', () => {
  it('offers a confirmed restart during editing without an advancement task', async () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    session.dispatch({ type: 'room.seat.fillBots' });
    session.dispatch({ type: 'pictionary.game.begin' });
    const { model, restartRound } = build(session.state);
    expect(model.task).toBeNull();
    expect(model.actions.map((action) => action.key)).toEqual(['restart']);
    const action = model.actions[0]!;
    expect(action).toMatchObject({
      key: 'restart',
      category: 'danger',
      state: { kind: 'ready' },
    });
    if (action.state.kind !== 'ready') throw new Error('expected an enabled restart');
    action.state.onPress();
    const confirmation = alertStore.getSnapshot();
    expect(confirmation?.message).toContain('不结算完成奖励');
    expect(restartRound).not.toHaveBeenCalled();
    await confirmation?.buttons.find((button) => button.text === '重新开始')?.onPress?.();
    expect(restartRound).toHaveBeenCalledOnce();
  });

  it('warns that restarting the final transition does not settle rewards', () => {
    const state = playPictionaryTestRound({ stopAt: { stepIndex: 3, phase: 'transition' } });
    const action = build(state).model.actions[0];
    if (action?.state.kind !== 'ready') throw new Error('expected an enabled restart');
    action.state.onPress();
    expect(alertStore.getSnapshot()?.message).toContain('不结算完成奖励');
  });

  it('blocks game start in a non-full lobby without a remedy action', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    const { model } = build(session.state);
    expect(model.pendingActionKeys).toEqual(['start-game']);
    const step = hostTaskBody(model);
    expect(step).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (step?.kind !== 'action') throw new Error('expected an action task body');
    expect(step.action.state).toEqual({
      kind: 'blocked',
      reason: '座位尚未坐满（还差 3 人）',
    });
  });

  it('offers game start once every seat is taken', () => {
    const session = createSession();
    session.dispatch({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    session.dispatch({ type: 'room.seat.fillBots' });
    const { model } = build(session.state);
    const step = hostTaskBody(model);
    expect(step).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (step?.kind !== 'action' || step.action.state.kind !== 'ready')
      throw new Error('expected a ready action task body');
  });

  it('keeps review optional and offers only restart after a finished round', () => {
    const openReview = vi.fn();
    const { model } = build(playPictionaryTestRound(), { isEnabled: true, onPress: openReview });
    expect(model.actions.map((action) => action.key)).toEqual(['review', 'restart']);
    expect(model.task).toBeNull();
    const [review, restart] = model.actions;
    if (review?.state.kind !== 'ready') throw new Error('expected an enabled review action');
    expect(review.testID).toBe('room-review-host-action');
    review.state.onPress();
    expect(openReview).toHaveBeenCalledTimes(1);
    if (restart?.state.kind !== 'ready') throw new Error('expected an enabled restart');
    restart.state.onPress();
    expect(alertStore.getSnapshot()?.message).toContain('本局已结算');
  });

  it('fails fast when a finished round reaches the host panel without its review entry', () => {
    expect(() => build(playPictionaryTestRound())).toThrow(
      '[FAIL-FAST] Pictionary ended host has no review entry',
    );
  });
});
