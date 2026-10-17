/** Public room projections must conceal live identities and distinguish test controls. */

import {
  getUndercoverUserSeat,
  type UndercoverCommand,
  undercoverEngine,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { resolveHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
import { showConfirmAlert } from '@/utils/alertPresets';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import {
  type UndercoverRoundControls,
  useUndercoverRoundControls,
} from '../hooks/useUndercoverRoundControls';
import { createUndercoverBottomActions } from '../undercoverActionModels';
import {
  createUndercoverBoardInfoSections,
  createUndercoverHostManagement,
  createUndercoverRoomCapabilities,
  createUndercoverRoomShellModel,
  createUndercoverSeatDataSource,
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

function createViewingState() {
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

it('conceals roles and words while everyone views their cards', () => {
  const state = createViewingState();
  const source = createUndercoverSeatDataSource({
    state,
    revision: 4,
    myUserId: 'host',
    controlledSeat: 1,
    selectedSeat: null,
    isSelecting: false,
  });
  for (let seat = 0; seat < source.count; seat += 1)
    expect(source.getSeat(seat).secondaryLabel).toBeNull();
  expect(source.getSeat(1).highlight).toBe('controlled');
  expect(getUndercoverUserSeat(state, 'host')).toBe(0);
  expect(getUndercoverUserSeat(state, 'visitor')).toBeNull();
});

it('conceals cards on control changes, backgrounding and remount', () => {
  const state = createViewingState();
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
  const state = createViewingState();
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
  const empty = dispatch(lobby, { type: 'room.seat.clear' });
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
    createUndercoverHostManagement({ state, isHost: true, capabilities, controls: result.current })
      ?.sections[0]?.actions,
  ).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'mark-bots-viewed' })]));
  const confirmed = dispatch(state, {
    type: 'undercover.bots.markAllBotsViewed',
    roundId: state.round!.roundId,
  });
  expect(
    createUndercoverHostManagement({
      state: confirmed,
      isHost: true,
      capabilities,
      controls: result.current,
    })?.sections[0]?.actions,
  ).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: 'mark-bots-viewed' })]));
});

it('selects directly for confirmation, cancels without submission and invalidates eliminated targets', () => {
  let state = createViewingState();
  const roundId = state.round!.roundId;
  state = dispatch(state, { type: 'undercover.bots.markAllBotsViewed', roundId });
  state = dispatch(state, { type: 'undercover.round.confirm', roundId });
  state = dispatch(state, { type: 'undercover.round.begin', roundId });
  const session = { dispatch: jest.fn() } as unknown as UndercoverRoomSession;
  const { result, rerender } = renderHook(
    ({ currentState }: { currentState: UndercoverState }) =>
      useUndercoverRoundControls(currentState, session, 'host', 1),
    { initialProps: { currentState: state } },
  );
  act(() => result.current.beginSelection());
  act(() => result.current.selectSeat(1));
  expect(result.current.selectedSeat).toBe(1);
  expect(
    createUndercoverSeatDataSource({
      state,
      revision: 1,
      myUserId: 'host',
      controlledSeat: 1,
      selectedSeat: 1,
      isSelecting: true,
    }).getSeat(1).highlight,
  ).toBe('selected');
  expect(createUndercoverBottomActions(result.current)).toMatchObject({
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
    createUndercoverSeatDataSource({
      state: eliminated,
      revision: 2,
      myUserId: 'host',
      controlledSeat: 1,
      selectedSeat: null,
      isSelecting: true,
    }).getSeat(1).disabledReason,
  ).toBe('该玩家已出局');
  act(() => result.current.selectSeat(1));
  expect(result.current.selectedSeat).toBeNull();
});

it('requires confirmation to restart an active round and exposes restart in host management after abort', async () => {
  const state = createViewingState();
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
  expect(createUndercoverBottomActions(result.current)).toMatchObject({
    actions: [],
  });
  const capabilities = createUndercoverRoomCapabilities({
    state: aborted,
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
  const hostManagement = createUndercoverHostManagement({
    state: aborted,
    isHost: true,
    capabilities,
    controls: result.current,
  });
  const restart = hostManagement?.sections[0]?.actions.find((action) => action.key === 'restart');
  if (restart === undefined || !restart.isEnabled) throw new Error('Expected enabled restart');
  jest.mocked(showConfirmAlert).mockClear();
  await act(async () => {
    restart.onPress();
  });
  expect(showConfirmAlert).not.toHaveBeenCalled();
  expect(session.dispatch).toHaveBeenCalledTimes(2);
});

describe('createUndercoverBoardInfoSections', () => {
  it('builds undercover and civilian sections without a blank section', () => {
    const sections = createUndercoverBoardInfoSections({
      roleCounts: { undercover: 1, civilian: 5, blank: 0 },
      hasBlank: false,
    });
    expect(sections.map((section) => section.title)).toEqual(['卧底', '平民']);
    expect(sections[0]?.items[0]).toMatchObject({ roleId: 'undercover', count: 1 });
    expect(sections[1]?.items[0]).toMatchObject({ roleId: 'civilian', count: 5 });
  });

  it('appends the blank section only for blank games', () => {
    const sections = createUndercoverBoardInfoSections({
      roleCounts: { undercover: 1, civilian: 4, blank: 1 },
      hasBlank: true,
    });
    expect(sections.map((section) => section.title)).toEqual(['卧底', '平民', '白板']);
    expect(sections[2]?.items[0]).toMatchObject({ roleId: 'blank', count: 1 });
  });
});

describe('createUndercoverRoomShellModel', () => {
  function createLobbyState() {
    let state = undercoverEngine.createInitialState(
      { numberOfPlayers: 6, hasBlank: true, category: 'all' },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
    );
    state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
    state = dispatch(state, { type: 'room.seat.fillBots' });
    return state;
  }

  const controls: UndercoverRoundControls = {
    isSubmitting: false,
    controlledSeat: null,
    card: null,
    canViewCard: false,
    shouldConfirm: false,
    openCard: jest.fn(),
    closeCard: jest.fn(),
    confirmCard: jest.fn(),
    markAllBotsViewed: jest.fn(),
    begin: jest.fn(),
    isSelecting: false,
    selectedSeat: null,
    reveal: jest.fn(),
    selectSeat: jest.fn(),
    beginSelection: jest.fn(),
    cancelRevelation: jest.fn(),
    cancelSelection: jest.fn(),
    start: jest.fn(),
    retry: jest.fn(),
    abort: jest.fn(),
    restart: jest.fn(),
    returnToLobby: jest.fn(),
    allowRepeated: jest.fn(),
  };

  it('assembles the shell from the hook projections (AU-01 characterization)', () => {
    const state = createLobbyState();
    const capabilities = createUndercoverRoomCapabilities({
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
      shareRoom: jest.fn(),
      openProfile: jest.fn(),
      takeOverBot: jest.fn(),
    });
    const share = {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    };
    const connection = {
      status: 'live' as const,
      pendingCommandCount: 0,
      onManualReconnect: jest.fn(),
    };
    const onSeatPress = jest.fn();
    const onBotSeatLongPress = jest.fn();
    const model = createUndercoverRoomShellModel({
      roomCode: '1234',
      capabilities,
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: { normalDraws: 1, goldenDraws: 1 },
      onUserActionPress: jest.fn(),
      connection,
      state,
      revision: 3,
      myUserId: 'host',
      controlledSeat: null,
      selectedSeat: null,
      isSelecting: false,
      seatsVisuallyDisabled: false,
      onSeatPress,
      onBotSeatLongPress,
      seatConfirmation: null,
      profile: null,
      share,
      isHost: true,
      controls,
      release: jest.fn(),
    });
    expect(model.roomCode).toBe('1234');
    expect(model.capabilities).toBe(capabilities);
    expect(model.header.userAction?.ticketCount).toBe(2);
    expect(model.connection).toBe(connection);
    expect(model.seats.source.count).toBe(6);
    expect(model.seats.onSeatPress).toBe(onSeatPress);
    expect(model.seats.onBotSeatLongPress).toBe(onBotSeatLongPress);
    expect(model.bottomActions).toEqual(createUndercoverBottomActions(controls));
    expect(model.hostManagement).not.toBeNull();
    // No takeover is active: no banner renders.
    expect(model.controlledSeat).toBeNull();
    expect(model.share).toBe(share);
    // The shell phase anchor carries the UndercoverState phase verbatim.
    expect(model.phase).toBe('lobby');
  });

  it('locks the lobby start action while a command is submitting', () => {
    const state = createLobbyState();
    const capabilities = createUndercoverRoomCapabilities({
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
      shareRoom: jest.fn(),
      openProfile: jest.fn(),
      takeOverBot: jest.fn(),
    });
    const model = createUndercoverHostManagement({
      state,
      isHost: true,
      capabilities,
      controls: { ...controls, isSubmitting: true },
    });
    const start = model?.sections[0]?.actions.find((action) => action.key === 'start-game');
    // Submitting marshal: disabled with no reason (the room IS full —
    // the lock, not a seat shortage, is what blocks it) and no handler.
    expect(start).toMatchObject({ label: '开始本局', isEnabled: false, disabledReason: null });
    expect(start).not.toHaveProperty('onPress');
  });

  it('exposes the viewing phase on the shell model', () => {
    const state = createViewingState();
    const model = createUndercoverRoomShellModel({
      roomCode: '1234',
      capabilities: createUndercoverRoomCapabilities({
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
        shareRoom: jest.fn(),
        openProfile: jest.fn(),
        takeOverBot: jest.fn(),
      }),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: {
        status: 'live' as const,
        pendingCommandCount: 0,
        onManualReconnect: jest.fn(),
      },
      state,
      revision: 3,
      myUserId: 'host',
      controlledSeat: null,
      selectedSeat: null,
      isSelecting: false,
      seatsVisuallyDisabled: false,
      onSeatPress: jest.fn(),
      onBotSeatLongPress: jest.fn(),
      seatConfirmation: null,
      profile: null,
      share: {
        isVisible: false,
        roomCode: '1234',
        roomUrl: 'https://example.test/1234',
        open: jest.fn(),
        close: jest.fn(),
        copyLink: jest.fn(async () => undefined),
        shareImage: jest.fn(async () => undefined),
      },
      isHost: true,
      controls,
      release: jest.fn(),
    });
    expect(model.phase).toBe('viewing');
  });
});

// 本用例注册 AppState 监听（经 hook），必须排在其余用例之后：更早的
// 'conceals cards…' 用例按注册顺序取第一个 change 监听器，顺序不可动。
it('clears the self-hint once every seat has viewed', () => {
  const viewing = createViewingState();
  const roundId = viewing.round!.roundId;
  const session = { dispatch: jest.fn() } as unknown as UndercoverRoomSession;
  const { result, rerender, unmount } = renderHook(
    ({ currentState }: { currentState: UndercoverState }) =>
      useUndercoverRoundControls(currentState, session, 'host', null),
    { initialProps: { currentState: viewing } },
  );
  // 本人未确认：底部只出一处提示，指向查看按钮（展示契约 self-hint 态）。
  expect(createUndercoverBottomActions(result.current)).toMatchObject({
    message: '请点击下方「查看我的词」，查看词语',
  });
  let state = dispatch(viewing, { type: 'undercover.round.confirm', roundId });
  state = dispatch(state, { type: 'undercover.bots.markAllBotsViewed', roundId });
  expect(state.round!.confirmedSeats).toHaveLength(6);
  rerender({ currentState: state });
  expect(createUndercoverBottomActions(result.current)).toMatchObject({ message: null });
  unmount();
});

describe('createUndercoverHostManagement console primary', () => {
  const buildFor = (state: UndercoverState) => {
    const session = { dispatch: jest.fn() } as unknown as UndercoverRoomSession;
    const { result } = renderHook(() => useUndercoverRoundControls(state, session, 'host', null));
    const shareRoom = jest.fn();
    const capabilities = createUndercoverRoomCapabilities({
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
      shareRoom,
      openProfile: jest.fn(),
      takeOverBot: jest.fn(),
    });
    const model = createUndercoverHostManagement({
      state,
      isHost: true,
      capabilities,
      controls: result.current,
    });
    return { model, shareRoom };
  };

  const lobbyState = (fill: boolean) => {
    let state = undercoverEngine.createInitialState(
      { numberOfPlayers: 6, hasBlank: true, category: 'all' },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
    );
    state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
    if (fill) state = dispatch(state, { type: 'room.seat.fillBots' });
    return state;
  };

  it('blocks the round start in a non-full lobby with a seat-count reason and share remedy', () => {
    const { model, shareRoom } = buildFor(lobbyState(false));
    const step = resolveHostConsolePrimary(model!);
    expect(step).toMatchObject({ actionKey: 'start-game', label: '开始本局' });
    if (step?.kind !== 'blocked') throw new Error('expected a blocked console primary');
    expect(step.reason).toBe('座位尚未坐满（还差 5 人）');
    expect(step.remedy?.label).toBe('分享房间');
    step.remedy?.onPress();
    expect(shareRoom).toHaveBeenCalledTimes(1);
    // The panel caption renders the same player-facing reason; the
    // bot-mentioning command-failure copy must never reach it.
    const startAction = model?.sections[0]?.actions.find((action) => action.key === 'start-game');
    if (startAction?.isEnabled !== false) throw new Error('expected a disabled panel start action');
    expect(startAction.disabledReason).toBe('座位尚未坐满（还差 5 人）');
    expect(startAction.disabledReason).not.toContain('机器人');
  });

  it('offers the round start once the room is full and gates its press with a confirm', () => {
    jest.mocked(showConfirmAlert).mockClear();
    const { model } = buildFor(lobbyState(true));
    const step = resolveHostConsolePrimary(model!);
    if (step?.kind !== 'ready') throw new Error('expected a ready console primary');
    step.onPress();
    expect(showConfirmAlert).toHaveBeenCalledWith(
      '开始本局？',
      '将为每位玩家分配词卡',
      expect.any(Function),
    );
  });

  it('blocks game start while cards are unviewed, then offers it once all are confirmed', () => {
    const viewing = createViewingState();
    const blockedBuild = buildFor(viewing);
    const blocked = resolveHostConsolePrimary(blockedBuild.model!);
    expect(blocked).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
    if (blocked?.kind !== 'blocked') throw new Error('expected a blocked console primary');
    expect(blocked.reason).toBe('还有玩家未查看词卡');
    expect(blocked.remedy).toBeNull();

    const roundId = viewing.round!.roundId;
    let confirmed = dispatch(viewing, { type: 'undercover.round.confirm', roundId });
    confirmed = dispatch(confirmed, { type: 'undercover.bots.markAllBotsViewed', roundId });
    const ready = resolveHostConsolePrimary(buildFor(confirmed).model!);
    if (ready?.kind !== 'ready') throw new Error('expected a ready console primary');
  });
});
