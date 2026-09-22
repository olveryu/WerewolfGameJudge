/** Public room projections must conceal live identities and distinguish test controls. */

import {
  type UndercoverCommand,
  undercoverEngine,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import { useUndercoverRoundControls } from '../hooks/useUndercoverRoundControls';
import {
  createUndercoverSeatDataSource,
  createUndercoverStatusRibbon,
  getUndercoverUserSeat,
} from '../undercoverRoomAdapter';

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
  const source = createUndercoverSeatDataSource(state, 4, 'host', 1, null);
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
