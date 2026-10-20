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
  state = dispatch(state, { type: 'undercover.roles.assign', shouldAllowRepeated: false });
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
    state: dispatch(state, { type: 'undercover.game.abort', roundId: state.round!.roundId }),
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
    dispatch(state, { type: 'undercover.game.abort', roundId: state.round!.roundId }),
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
  state = dispatch(state, { type: 'undercover.role.viewed', roundId });
  state = dispatch(state, { type: 'undercover.game.begin', roundId });
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
  expect(
    createUndercoverBottomActions(result.current, state, {
      isHost: true,
      mySeat: getUndercoverUserSeat(state, 'host'),
    }),
  ).toMatchObject({
    kind: 'stacked',
    message: '选择本次出局玩家',
    layout: {
      primary: [],
      secondary: [],
      ghost: [{ key: 'cancel', label: '取消选择', variant: 'ghost' }],
    },
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
    { type: 'undercover.game.redeal', roundId: state.round.roundId },
    { controlledSeat: null, label: '重新开始' },
  );
  const aborted = dispatch(state, { type: 'undercover.game.abort', roundId: state.round.roundId });
  rerender({ currentState: aborted });
  expect(
    createUndercoverBottomActions(result.current, aborted, {
      isHost: true,
      mySeat: getUndercoverUserSeat(aborted, 'host'),
    }),
  ).toMatchObject({
    kind: 'stacked',
    message: '本局已中止',
    layout: { primary: [], secondary: [], ghost: [] },
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
  const nextRound = hostManagement?.sections[0]?.actions.find(
    (action) => action.key === 'next-round',
  );
  if (nextRound === undefined || !nextRound.isEnabled)
    throw new Error('Expected enabled next round');
  jest.mocked(showConfirmAlert).mockClear();
  await act(async () => {
    nextRound.onPress();
  });
  // Terminal presses confirm first (chassis contract); the restart
  // dispatch lands once the host confirms.
  const terminalConfirmation = jest.mocked(showConfirmAlert).mock.calls.at(-1);
  if (terminalConfirmation === undefined) throw new Error('Expected next-round confirmation');
  expect(terminalConfirmation[0]).toBe('再来一局');
  expect(terminalConfirmation[1]).toBe('重新分配词语与身份，开始新的一局。');
  await act(async () => {
    await terminalConfirmation[2]();
  });
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
    expect(model.bottomActions).toEqual(
      createUndercoverBottomActions(controls, state, {
        isHost: true,
        mySeat: getUndercoverUserSeat(state, 'host'),
      }),
    );
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
    const start = model?.sections[0]?.actions.find((action) => action.key === 'assign-roles');
    // Submitting marshal: disabled with no reason (the room IS full —
    // the lock, not a seat shortage, is what blocks it) and no handler.
    expect(start).toMatchObject({ label: '分配角色', isEnabled: false, disabledReason: null });
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
  expect(
    createUndercoverBottomActions(result.current, viewing, {
      isHost: true,
      mySeat: getUndercoverUserSeat(viewing, 'host'),
    }),
  ).toMatchObject({
    message: '请点击下方「查看我的词」，查看词语',
  });
  // Tier contract: the word card is the viewing step's main action, so
  // it sits in the primary tier at stage-action size — it is not a
  // ghost-tier review tool even though its definition resolves through
  // the shared view-action resolver.
  const viewingBottom = createUndercoverBottomActions(result.current, viewing, {
    isHost: true,
    mySeat: getUndercoverUserSeat(viewing, 'host'),
  });
  if (viewingBottom.kind !== 'stacked') throw new Error('expected stacked bottom actions');
  expect(viewingBottom.layout.primary).toMatchObject([
    {
      key: 'card',
      label: '查看我的词',
      variant: 'primary',
      size: 'lg',
      testID: 'undercover-view-word',
      isEnabled: true,
    },
  ]);
  expect(viewingBottom.layout.secondary).toEqual([]);
  expect(viewingBottom.layout.ghost).toEqual([]);
  let state = dispatch(viewing, { type: 'undercover.role.viewed', roundId });
  state = dispatch(state, { type: 'undercover.bots.markAllBotsViewed', roundId });
  expect(state.round!.confirmedSeats).toHaveLength(6);
  rerender({ currentState: state });
  expect(
    createUndercoverBottomActions(result.current, state, {
      isHost: true,
      mySeat: getUndercoverUserSeat(state, 'host'),
    }),
  ).toMatchObject({ message: null });
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
    expect(step).toMatchObject({ actionKey: 'assign-roles', label: '分配角色' });
    if (step?.kind !== 'blocked') throw new Error('expected a blocked console primary');
    expect(step.reason).toBe('座位尚未坐满（还差 5 人）');
    expect(step.remedy?.label).toBe('分享房间');
    step.remedy?.onPress();
    expect(shareRoom).toHaveBeenCalledTimes(1);
    // The panel caption renders the same player-facing reason; the
    // bot-mentioning command-failure copy must never reach it.
    const startAction = model?.sections[0]?.actions.find((action) => action.key === 'assign-roles');
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
      '分配角色？',
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
    expect(blocked.reason).toBe('0/6 位玩家已查看词卡，等待剩余玩家');
    expect(blocked.remedy).toBeNull();

    const roundId = viewing.round!.roundId;
    let confirmed = dispatch(viewing, { type: 'undercover.role.viewed', roundId });
    confirmed = dispatch(confirmed, { type: 'undercover.bots.markAllBotsViewed', roundId });
    const ready = resolveHostConsolePrimary(buildFor(confirmed).model!);
    if (ready?.kind !== 'ready') throw new Error('expected a ready console primary');
  });

  it('opens the begin gate over the participant set, not the raw record count (B-4)', () => {
    const viewing = createViewingState();
    const roundId = viewing.round!.roundId;
    let confirmed = dispatch(viewing, { type: 'undercover.role.viewed', roundId });
    confirmed = dispatch(confirmed, { type: 'undercover.bots.markAllBotsViewed', roundId });
    // Seat 5 is vacated with its confirmation record dropped: five
    // participants remain, all confirmed. The engine checkpoint
    // (haveAllViewed over the participant set) opens here; the old
    // client predicate — confirmedSeats.length === numberOfPlayers —
    // stayed closed on this state.
    if (confirmed.phase !== 'viewing') throw new Error('expected a viewing state');
    const state: UndercoverState = {
      ...confirmed,
      roster: { ...confirmed.roster, 5: null },
      round: { ...confirmed.round, confirmedSeats: [0, 1, 2, 3, 4] },
    };
    const ready = resolveHostConsolePrimary(buildFor(state).model!);
    if (ready?.kind !== 'ready') throw new Error('expected a ready console primary');
    expect(ready).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
  });
});

describe('createUndercoverBottomActions phase messages (PR-B G-1/G-7/G-9)', () => {
  const idleControls: UndercoverRoundControls = {
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

  function createLobbyState() {
    let state = undercoverEngine.createInitialState(
      { numberOfPlayers: 6, hasBlank: true, category: 'all' },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
    );
    state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
    state = dispatch(state, { type: 'room.seat.fillBots' });
    return state;
  }

  function createOngoingState() {
    let state = createViewingState();
    const roundId = state.round!.roundId;
    state = dispatch(state, { type: 'undercover.role.viewed', roundId });
    state = dispatch(state, { type: 'undercover.bots.markAllBotsViewed', roundId });
    state = dispatch(state, { type: 'undercover.game.begin', roundId });
    return state;
  }

  it('shows the shared lobby wait to a seated non-host player only', () => {
    const state = createLobbyState();
    expect(
      createUndercoverBottomActions(idleControls, state, { isHost: false, mySeat: 2 }).message,
    ).toBe('等待房主开始游戏');
    expect(
      createUndercoverBottomActions(idleControls, state, { isHost: true, mySeat: 0 }).message,
    ).toBeNull();
    expect(
      createUndercoverBottomActions(idleControls, state, { isHost: false, mySeat: null }).message,
    ).toBeNull();
  });

  it('shows the preparing status while words are prepared', () => {
    const state = dispatch(createLobbyState(), {
      type: 'undercover.roles.assign',
      shouldAllowRepeated: false,
    });
    expect(state.phase).toBe('preparing');
    expect(
      createUndercoverBottomActions(idleControls, state, { isHost: false, mySeat: 2 }).message,
    ).toBe('正在准备词语');
  });

  it('keeps the three failure reasons distinct for players and bare for the host', () => {
    const preparing = dispatch(createLobbyState(), {
      type: 'undercover.roles.assign',
      shouldAllowRepeated: false,
    });
    if (preparing.phase !== 'preparing') throw new Error('Expected preparing');
    const failed = (
      failureCode: 'selectionFailed' | 'inventoryEmpty' | 'inventoryExhausted',
    ): UndercoverState => ({ ...preparing, phase: 'preparationFailed', failureCode });
    const player = { isHost: false, mySeat: 2 };
    const host = { isHost: true, mySeat: 0 };
    expect(
      createUndercoverBottomActions(idleControls, failed('selectionFailed'), player).message,
    ).toBe('词语准备失败，等待房主处理');
    expect(
      createUndercoverBottomActions(idleControls, failed('inventoryEmpty'), player).message,
    ).toBe('暂无可用词语，等待房主处理');
    expect(
      createUndercoverBottomActions(idleControls, failed('inventoryExhausted'), player).message,
    ).toBe('该类别的新词已用完，等待房主处理');
    expect(
      createUndercoverBottomActions(idleControls, failed('inventoryExhausted'), host).message,
    ).toBe('该类别的新词已用完');
  });

  it('keeps the speaking order resident for everyone during ongoing', () => {
    const state = createOngoingState();
    expect(state.phase).toBe('ongoing');
    if (state.phase !== 'ongoing') throw new Error('Expected ongoing');
    const expected = `本轮从 ${state.round.speakingStartSeat + 1} 号起按座位顺序发言`;
    expect(
      createUndercoverBottomActions(idleControls, state, { isHost: false, mySeat: 2 }).message,
    ).toBe(expected);
    expect(
      createUndercoverBottomActions(idleControls, state, { isHost: true, mySeat: 0 }).message,
    ).toBe(expected);
  });

  it('gives aborted players the conclusion plus the host wait', () => {
    const ongoing = createOngoingState();
    const aborted = dispatch(ongoing, {
      type: 'undercover.game.abort',
      roundId: ongoing.round!.roundId,
    });
    expect(aborted.phase).toBe('aborted');
    expect(
      createUndercoverBottomActions(idleControls, aborted, { isHost: false, mySeat: 2 }).message,
    ).toBe('本局已中止，等待房主处理');
    expect(
      createUndercoverBottomActions(idleControls, aborted, { isHost: true, mySeat: 0 }).message,
    ).toBe('本局已中止');
  });
});
