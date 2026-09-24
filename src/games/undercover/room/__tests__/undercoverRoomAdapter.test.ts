/** Public room projections must conceal live identities and distinguish test controls. */

import {
  type UndercoverCommand,
  undercoverEngine,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { showConfirmAlert } from '@/utils/alertPresets';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import { useUndercoverRoundControls } from '../hooks/useUndercoverRoundControls';
import {
  createUndercoverBottomActions,
  createUndercoverHostManagement,
} from '../undercoverActionModels';
import {
  createUndercoverRoomCapabilities,
  createUndercoverSeatDataSource,
  createUndercoverStatusRibbon,
  getUndercoverUserSeat,
} from '../undercoverRoomAdapter';

jest.mock('@/utils/alertPresets', () => ({
  showConfirmAlert: jest.fn(),
  showErrorAlert: jest.fn(),
}));

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

function dispatch(state: UndercoverState, command: UndercoverCommand, isSystem = false) {
  const execution = { nowMs: 1, commandId: 'start', randomSeed: 'test' };
  const decision = undercoverEngine.decide(
    state,
    command,
    isSystem
      ? { ...execution, actor: { kind: 'system', effectId: 'selection' }, controlledSeat: null }
      : { ...execution, actor: { kind: 'user', userId: 'host' }, controlledSeat: null },
  );
  if (decision.kind === 'reject') throw new Error(decision.reason);
  return undercoverEngine.normalize(decision.events.reduce(undercoverEngine.evolve, state));
}

function createReadingState() {
  let state = undercoverEngine.createInitialState(
    { numberOfPlayers: 6, hasBlank: true, category: 'all' },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  state = dispatch(state, { type: 'room.seat.fillBots' });
  state = dispatch(state, { type: 'undercover.round.start', shouldAllowRepeated: false });
  state = dispatch(
    state,
    {
      type: 'undercover.round.complete',
      roundId: 'undercover-round:start',
      wordPair: { id: 'pair', wordA: 'Milk', wordB: 'Tea', category: 'food' },
    },
    true,
  );
  return state;
}

it('conceals roles and words while everyone reads their cards', () => {
  const state = createReadingState();
  const source = createUndercoverSeatDataSource(state, 4, 'host', 1, null, false);
  for (let seat = 0; seat < source.count; seat += 1)
    expect(source.getSeat(seat).secondaryLabel).toBeNull();
  expect(source.getSeat(1).highlight).toBe('controlled');
  expect(getUndercoverUserSeat(state, 'host')).toBe(0);
  expect(getUndercoverUserSeat(state, 'visitor')).toBeNull();
  expect(createUndercoverStatusRibbon(state)).toMatchObject({ text: '确认词卡 · 0/6' });
});

it('conceals cards on control changes, backgrounding and remount', () => {
  const state = createReadingState();
  const session = { dispatch: jest.fn() } as unknown as UndercoverRoomSession;
  const listener = jest.spyOn(AppState, 'addEventListener');
  const { result, rerender, unmount } = renderHook(
    ({
      currentState,
      controlledSeat,
    }: {
      currentState: UndercoverState;
      controlledSeat: number | null;
    }) => useUndercoverRoundControls(currentState, session, 'host', controlledSeat),
    { initialProps: { currentState: state, controlledSeat: null } },
  );
  expect(result.current.card).toBeNull();
  act(() => result.current.openCard());
  expect(result.current.card).toMatchObject({ seat: 0 });
  rerender({ currentState: state, controlledSeat: 1 });
  expect(result.current.card).toBeNull();
  act(() => result.current.openCard());
  expect(result.current.card).toMatchObject({ seat: 1 });
  rerender({ currentState: state, controlledSeat: null });
  expect(result.current.card).toBeNull();
  act(() => result.current.openCard());
  const onAppState = listener.mock.calls.find(([event]) => event === 'change')?.[1];
  if (onAppState === undefined) throw new Error('Missing background listener');
  act(() => onAppState('background'));
  expect(result.current.card).toBeNull();
  act(() => result.current.openCard());
  unmount();
  const remounted = renderHook(() => useUndercoverRoundControls(state, session, 'host', null));
  expect(remounted.result.current.card).toBeNull();
  remounted.unmount();
  listener.mockRestore();
});

it('offers unseated host bot filling and bulk viewing only while bots remain unconfirmed', () => {
  const state = createReadingState();
  const session = { dispatch: jest.fn() } as unknown as UndercoverRoomSession;
  const { result } = renderHook(() => useUndercoverRoundControls(state, session, 'host', null));
  const capabilities = createUndercoverRoomCapabilities({
    state: dispatch(state, { type: 'undercover.round.abort', roundId: state.round!.roundId }),
    isHost: true,
    mySeat: null,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    shareRoom: jest.fn(),
    openProfile: jest.fn(),
    takeOverBot: jest.fn(),
  });
  const lobby = dispatch(
    dispatch(state, { type: 'undercover.round.abort', roundId: state.round!.roundId }),
    { type: 'undercover.game.returnToLobby' },
  );
  const empty = dispatch(dispatch(lobby, { type: 'undercover.bots.clear' }), {
    type: 'room.seat.leave',
  });
  const unseatedCapabilities = createUndercoverRoomCapabilities({
    state: empty,
    isHost: true,
    mySeat: null,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    shareRoom: jest.fn(),
    openProfile: jest.fn(),
    takeOverBot: jest.fn(),
  });
  expect(unseatedCapabilities.canFillBots.isAllowed).toBe(true);
  expect(
    createUndercoverHostManagement(state, true, capabilities, result.current)?.sections[0]?.actions,
  ).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'mark-all-bots-viewed' })]));
  const confirmed = dispatch(state, {
    type: 'undercover.round.markAllBotsViewed',
    roundId: state.round!.roundId,
  });
  expect(
    createUndercoverHostManagement(confirmed, true, capabilities, result.current)?.sections[0]
      ?.actions,
  ).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: 'mark-all-bots-viewed' })]));
});

it('selects directly for confirmation, cancels without submission and invalidates eliminated targets', () => {
  let state = createReadingState();
  const roundId = state.round!.roundId;
  state = dispatch(state, { type: 'undercover.round.markAllBotsViewed', roundId });
  state = dispatch(state, { type: 'undercover.round.confirm', roundId });
  const session = { dispatch: jest.fn() } as unknown as UndercoverRoomSession;
  const { result, rerender } = renderHook(
    ({ currentState }: { currentState: UndercoverState }) =>
      useUndercoverRoundControls(currentState, session, 'host', 1),
    { initialProps: { currentState: state } },
  );
  act(() => result.current.beginSelection());
  act(() => result.current.selectSeat(1));
  expect(result.current.selectedSeat).toBe(1);
  expect(createUndercoverSeatDataSource(state, 1, 'host', 1, 1, true).getSeat(1).highlight).toBe(
    'selected',
  );
  expect(createUndercoverBottomActions(state, true, result.current)).toMatchObject({
    kind: 'info',
    actions: [{ key: 'cancel' }],
  });
  act(() => result.current.cancelRevelation());
  expect(result.current.isSelecting).toBe(true);
  expect(result.current.selectedSeat).toBeNull();
  expect(session.dispatch).not.toHaveBeenCalled();
  act(() => result.current.selectSeat(1));
  const eliminated = dispatch(state, { type: 'undercover.round.reveal', roundId, seat: 1 });
  rerender({ currentState: eliminated });
  expect(result.current.selectedSeat).toBeNull();
  expect(
    createUndercoverSeatDataSource(eliminated, 2, 'host', 1, null, true).getSeat(1).disabledReason,
  ).toBe('该玩家已出局');
  act(() => result.current.selectSeat(1));
  expect(result.current.selectedSeat).toBeNull();
});

it('shows the authoritative starting speaker only once all cards are confirmed', () => {
  let state = createReadingState();
  if (state.round === null) throw new Error('Expected round');
  const { roundId, speakingStartSeat } = state.round;
  expect(createUndercoverStatusRibbon(state)).toMatchObject({
    kind: 'message',
    supportingText: null,
  });
  state = dispatch(state, { type: 'undercover.round.markAllBotsViewed', roundId });
  expect(createUndercoverStatusRibbon(state)).toMatchObject({
    kind: 'message',
    supportingText: null,
  });
  state = dispatch(state, { type: 'undercover.round.confirm', roundId });
  expect(createUndercoverStatusRibbon(state)).toMatchObject({
    kind: 'message',
    icon: 'speaking',
    supportingText: `首轮随机由 ${speakingStartSeat + 1} 号开始发言`,
  });
});

it('requires confirmation to restart an active round and exposes a direct host action after abort', async () => {
  const state = createReadingState();
  if (state.round === null) throw new Error('Expected round');
  const session = {
    dispatch: jest.fn().mockResolvedValue({
      kind: 'decided',
      decision: { kind: 'committed', outcome: { kind: 'success' } },
    }),
  } as unknown as UndercoverRoomSession;
  const { result, rerender } = renderHook(
    ({ currentState }: { currentState: UndercoverState }) =>
      useUndercoverRoundControls(currentState, session, 'host', null),
    { initialProps: { currentState: state } },
  );
  act(() => result.current.restart());
  expect(session.dispatch).not.toHaveBeenCalled();
  const confirmation = jest.mocked(showConfirmAlert).mock.calls.at(-1);
  if (confirmation === undefined) throw new Error('Expected restart confirmation');
  expect(confirmation[0]).toBe('重新开始？');
  await act(async () => {
    await confirmation[2]();
  });
  expect(session.dispatch).toHaveBeenCalledWith(
    { type: 'undercover.round.restart', roundId: state.round.roundId },
    { controlledSeat: null, label: '重新开始' },
  );
  const aborted = dispatch(state, { type: 'undercover.round.abort', roundId: state.round.roundId });
  rerender({ currentState: aborted });
  expect(createUndercoverBottomActions(aborted, false, result.current)).toMatchObject({
    actions: [],
  });
  const model = createUndercoverBottomActions(aborted, true, result.current);
  if (model.kind !== 'info') throw new Error('Expected room actions');
  const restart = model.actions.find((action) => action.key === 'restart');
  if (restart === undefined || !restart.isEnabled) throw new Error('Expected enabled restart');
  jest.mocked(showConfirmAlert).mockClear();
  await act(async () => {
    restart.onPress();
  });
  expect(showConfirmAlert).not.toHaveBeenCalled();
  expect(session.dispatch).toHaveBeenCalledTimes(2);
});
