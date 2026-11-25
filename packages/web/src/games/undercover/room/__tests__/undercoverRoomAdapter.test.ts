/** Public room projections must conceal live identities and distinguish test controls. */

import {
  getUndercoverUserSeat,
  type UndercoverCommand,
  undercoverEngine,
  type UndercoverPublicCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { act, renderHook } from '@testing-library/react';

import { confirmAction, confirmView } from '@/features/room/confirm';
import { createBotTakeoverCapability } from '@/features/room/model/RoomCapabilities';
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { hostTaskBody } from '@/test-utils/hostTask';
import { playUndercoverTestRound } from '@/test-utils/undercoverState';
import { TESTIDS } from '@/testids';
import { dismissAlert } from '@/utils/alert';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import { undercoverReview } from '../../review/undercoverReview';
import {
  type UndercoverRoundControls,
  useUndercoverRoundControls,
} from '../hooks/useUndercoverRoundControls';
import { createUndercoverPlayerActions } from '../undercoverActionModels';
import {
  createUndercoverBoardInfoSections,
  createUndercoverHostManagement,
  createUndercoverRoomCapabilities,
  createUndercoverRoomShellModel,
  createUndercoverSeatDataSource,
} from '../undercoverRoomAdapter';

vi.mock('@/features/room/confirm', () => ({
  confirmAction: vi.fn((input: { onShown?: (generation: number | null) => void }) =>
    input.onShown?.(17),
  ),
  confirmView: vi.fn((input: { onShown?: (generation: number | null) => void }) =>
    input.onShown?.(17),
  ),
}));
vi.mock('@/utils/alertPresets', () => ({ showErrorAlert: vi.fn() }));
vi.mock('@/utils/alert', () => ({ dismissAlert: vi.fn() }));

/** Sets the page visibility and notifies listeners, as a browser does when the tab is hidden. */
function setDocumentVisibility(visibility: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibility });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

/** Mirrors useReadyRoomSession.submit on a bare session mock so dispatch assertions stay exact. */
const submitVia =
  (session: UndercoverRoomSession) =>
  (label: string, command: UndercoverPublicCommand, options?: { controlledSeat?: number | null }) =>
    session
      .dispatch(command, { controlledSeat: options?.controlledSeat ?? null, label, durable: false })
      .then((outcome) => outcome.kind === 'committed');

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

/** The entry the room derives for this state from the real review contribution. */
function reviewEntryFor(state: UndercoverState): RoomReviewEntry | null {
  const availability = undercoverReview.resolve({
    state,
    viewer: { userId: 'host', isHost: true, seat: 0 },
    roomCode: '1234',
  });
  return availability.kind === 'available' ? { isEnabled: true, onPress: vi.fn() } : null;
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

/** Plays the dealt round to its end: undercover and blank seats are revealed until a side wins. */
function createEndedState() {
  let state = createViewingState();
  const roundId = state.round!.roundId;
  state = dispatch(state, { type: 'undercover.role.viewed', roundId });
  state = dispatch(state, { type: 'undercover.bots.markAllBotsViewed', roundId });
  state = dispatch(state, { type: 'undercover.game.begin', roundId });
  while (state.phase === 'ongoing') {
    const revealed = state.round.revelations.map((revelation) => revelation.seat);
    const seat = state.round.roles.findIndex(
      (role, index) => role !== 'civilian' && !revealed.includes(index),
    );
    state = dispatch(state, { type: 'undercover.round.reveal', roundId, seat });
  }
  return state;
}

it('allows sharing while identities are being viewed but not after the game ends', () => {
  for (const [state, expected] of [
    [createViewingState(), true],
    [createEndedState(), false],
  ] as const) {
    const capabilities = createUndercoverRoomCapabilities({
      state,
      isHost: false,
      mySeat: 0,
      requestTakeSeat: vi.fn(),
      requestMoveSeat: vi.fn(),
      leaveSeat: vi.fn(),
      kickSeat: vi.fn(),
      clearSeats: vi.fn(),
      fillBots: vi.fn(),
      configureGame: vi.fn(),
      shareRoom: vi.fn(),
      openProfile: vi.fn(),
      takeOverBots: createBotTakeoverCapability(false, vi.fn()),
    });
    expect(capabilities.canShareRoom.isAllowed).toBe(expected);
  }
});

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
  const session = { dispatch: vi.fn() } as unknown as UndercoverRoomSession;
  const { result, rerender, unmount } = renderHook<
    UndercoverRoundControls,
    { currentState: UndercoverState; controlledSeat: number | null }
  >(
    ({
      currentState,
      controlledSeat,
    }: {
      currentState: UndercoverState;
      controlledSeat: number | null;
    }) =>
      useUndercoverRoundControls({
        state: currentState,
        userId: 'host',
        controlledSeat: controlledSeat,
        submit: submitVia(session),
        isSubmitting: false,
      }),
    { initialProps: { currentState: state, controlledSeat: null } },
  );
  const revealCard = () => {
    act(() => result.current.openCard());
    const confirmation = vi.mocked(confirmView).mock.calls.at(-1)?.[0];
    if (confirmation === undefined) throw new Error('Missing word-card view confirmation');
    expect(confirmation.label).toBe('查看词卡');
    const reveal = confirmation.onView;
    act(() => void reveal());
  };
  expect(result.current.card).toBeNull();
  revealCard();
  expect(result.current.card).toMatchObject({ seat: 0 });
  rerender({ currentState: state, controlledSeat: 1 });
  expect(result.current.card).toBeNull();
  revealCard();
  expect(result.current.card).toMatchObject({ seat: 1 });
  rerender({ currentState: state, controlledSeat: null });
  expect(result.current.card).toBeNull();
  revealCard();
  act(() => setDocumentVisibility('hidden'));
  expect(result.current.card).toBeNull();
  act(() => setDocumentVisibility('visible'));
  revealCard();
  unmount();
  const remounted = renderHook(() =>
    useUndercoverRoundControls({
      state: state,
      userId: 'host',
      controlledSeat: null,
      submit: submitVia(session),
      isSubmitting: false,
    }),
  );
  expect(remounted.result.current.card).toBeNull();
  remounted.unmount();
});

it('dismisses a pending card confirmation when the permitted card changes', () => {
  const state = createViewingState();
  const session = { dispatch: vi.fn() } as unknown as UndercoverRoomSession;
  const { result, rerender } = renderHook<
    UndercoverRoundControls,
    { currentState: UndercoverState; controlledSeat: number | null }
  >(
    ({ currentState, controlledSeat }) =>
      useUndercoverRoundControls({
        state: currentState,
        userId: 'host',
        controlledSeat,
        submit: submitVia(session),
        isSubmitting: false,
      }),
    { initialProps: { currentState: state, controlledSeat: null } },
  );
  act(() => result.current.openCard());

  rerender({ currentState: state, controlledSeat: 1 });

  expect(dismissAlert).toHaveBeenCalledWith(17);
});

it('offers unseated host bot filling and bulk viewing only while bots remain unconfirmed', () => {
  const state = createViewingState();
  const session = { dispatch: vi.fn() } as unknown as UndercoverRoomSession;
  const { result } = renderHook(() =>
    useUndercoverRoundControls({
      state: state,
      userId: 'host',
      controlledSeat: null,
      submit: submitVia(session),
      isSubmitting: false,
    }),
  );
  const capabilities = createUndercoverRoomCapabilities({
    state,
    isHost: true,
    mySeat: null,
    requestTakeSeat: vi.fn(),
    requestMoveSeat: vi.fn(),
    leaveSeat: vi.fn(),
    kickSeat: vi.fn(),
    clearSeats: vi.fn(),
    fillBots: vi.fn(),
    configureGame: vi.fn(),
    shareRoom: vi.fn(),
    openProfile: vi.fn(),
    takeOverBots: createBotTakeoverCapability(true, vi.fn()),
  });
  const lobby = dispatch(state, {
    type: 'undercover.game.restart',
    roundId: state.round!.roundId,
    wasEnded: false,
  });
  const empty = dispatch(lobby, { type: 'room.seat.clear' });
  const unseatedCapabilities = createUndercoverRoomCapabilities({
    state: empty,
    isHost: true,
    mySeat: null,
    requestTakeSeat: vi.fn(),
    requestMoveSeat: vi.fn(),
    leaveSeat: vi.fn(),
    kickSeat: vi.fn(),
    clearSeats: vi.fn(),
    fillBots: vi.fn(),
    configureGame: vi.fn(),
    shareRoom: vi.fn(),
    openProfile: vi.fn(),
    takeOverBots: createBotTakeoverCapability(true, vi.fn()),
  });
  expect(unseatedCapabilities.canFillBots.isAllowed).toBe(true);
  expect(
    createUndercoverHostManagement({ state, capabilities, controls: result.current, review: null })
      ?.actions,
  ).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'mark-bots-viewed' })]));
  const confirmed = dispatch(state, {
    type: 'undercover.bots.markAllBotsViewed',
    roundId: state.round!.roundId,
  });
  expect(
    createUndercoverHostManagement({
      state: confirmed,
      capabilities,
      controls: result.current,
      review: null,
    })?.actions,
  ).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: 'mark-bots-viewed' })]));
});

it('selects directly for confirmation, cancels without submission and invalidates eliminated targets', () => {
  let state = createViewingState();
  const roundId = state.round!.roundId;
  state = dispatch(state, { type: 'undercover.bots.markAllBotsViewed', roundId });
  state = dispatch(state, { type: 'undercover.role.viewed', roundId });
  state = dispatch(state, { type: 'undercover.game.begin', roundId });
  const session = { dispatch: vi.fn() } as unknown as UndercoverRoomSession;
  const { result, rerender } = renderHook(
    ({ currentState }: { currentState: UndercoverState }) =>
      useUndercoverRoundControls({
        state: currentState,
        userId: 'host',
        controlledSeat: 1,
        submit: submitVia(session),
        isSubmitting: false,
      }),
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
  // The bottom panel stays the host's own participant surface during
  // selection; the instruction and the cancel live on the host task card.
  expect(
    createUndercoverPlayerActions(
      result.current,
      state,
      { userId: 'host', isHost: true, seat: getUndercoverUserSeat(state, 'host') },
      null,
    ),
  ).toMatchObject({
    actions: [],
  });
  const capabilities = createUndercoverRoomCapabilities({
    state,
    isHost: true,
    mySeat: 0,
    requestTakeSeat: vi.fn(),
    requestMoveSeat: vi.fn(),
    leaveSeat: vi.fn(),
    kickSeat: vi.fn(),
    clearSeats: vi.fn(),
    fillBots: vi.fn(),
    configureGame: vi.fn(),
    shareRoom: vi.fn(),
    openProfile: vi.fn(),
    takeOverBots: createBotTakeoverCapability(true, vi.fn()),
  });
  const pendingSelection = createUndercoverHostManagement({
    state,
    capabilities,
    controls: { ...result.current, isSelecting: false },
    review: null,
  });
  expect(pendingSelection.pendingActionKeys).toEqual(['select-player']);
  const activeSelection = createUndercoverHostManagement({
    state,
    capabilities,
    controls: result.current,
    review: null,
  });
  expect(activeSelection.pendingActionKeys).toEqual([]);
  expect(activeSelection.task).toEqual({
    kind: 'message',
    text: '请选择要出局的玩家',
    escapeActionKey: 'cancel-selection',
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

it('restarts a confirmed round with its identity and completion boundary', async () => {
  const state = createViewingState();
  if (state.round === null) throw new Error('Expected round');
  const session = {
    dispatch: vi.fn().mockResolvedValue({ kind: 'committed', outcome: { kind: 'success' } }),
  } as unknown as UndercoverRoomSession;
  const { result } = renderHook<UndercoverRoundControls, { currentState: UndercoverState }>(
    ({ currentState }) =>
      useUndercoverRoundControls({
        state: currentState,
        userId: 'host',
        controlledSeat: null,
        submit: submitVia(session),
        isSubmitting: false,
      }),
    { initialProps: { currentState: state } },
  );
  await act(async () => {
    await result.current.restart();
  });
  expect(session.dispatch).toHaveBeenCalledWith(
    { type: 'undercover.game.restart', roundId: state.round.roundId, wasEnded: false },
    { controlledSeat: null, label: '重新开始', durable: false },
  );
});

it('allows repeated words with one round-bound command after confirmation', async () => {
  const preparing = playUndercoverTestRound('preparing');
  if (preparing.phase !== 'preparing') throw new Error('Expected preparation');
  const failed = dispatch(
    preparing,
    {
      type: 'undercover.round.failPreparation',
      roundId: preparing.pendingRound.roundId,
      failureCode: 'inventoryExhausted',
    },
    true,
  );
  const session = {
    dispatch: vi.fn().mockResolvedValue({ kind: 'committed', outcome: { kind: 'success' } }),
  } as unknown as UndercoverRoomSession;
  const { result } = renderHook(() =>
    useUndercoverRoundControls({
      state: failed,
      userId: 'host',
      controlledSeat: null,
      submit: submitVia(session),
      isSubmitting: false,
    }),
  );
  vi.mocked(confirmAction).mockClear();
  act(() => result.current.allowRepeated());
  expect(session.dispatch).not.toHaveBeenCalled();
  const confirmation = vi.mocked(confirmAction).mock.calls.at(-1)?.[0];
  if (confirmation === undefined) throw new Error('Expected confirmation');
  expect(confirmation).toMatchObject({
    label: '允许重复词对',
    body: '当前分类没有未使用词对。只对下一局生效，之后各局仍按去重设置。',
  });
  await act(async () => {
    await confirmation.onConfirm();
  });
  expect(session.dispatch).toHaveBeenCalledTimes(1);
  expect(session.dispatch).toHaveBeenCalledWith(
    { type: 'undercover.round.allowRepeated', roundId: preparing.pendingRound.roundId },
    { controlledSeat: null, label: '允许重复词对', durable: false },
  );
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
    openCard: vi.fn(),
    closeCard: vi.fn(),
    confirmCard: vi.fn(),
    markAllBotsViewed: vi.fn(),
    begin: vi.fn(),
    isSelecting: false,
    selectedSeat: null,
    reveal: vi.fn(),
    selectSeat: vi.fn(),
    beginSelection: vi.fn(),
    cancelRevelation: vi.fn(),
    cancelSelection: vi.fn(),
    start: vi.fn(),
    retry: vi.fn(),
    restart: vi.fn(),
    allowRepeated: vi.fn(),
  };

  it('assembles the shell from the hook projections (AU-01 characterization)', () => {
    const state = createLobbyState();
    const capabilities = createUndercoverRoomCapabilities({
      state,
      isHost: true,
      mySeat: 0,
      requestTakeSeat: vi.fn(),
      requestMoveSeat: vi.fn(),
      leaveSeat: vi.fn(),
      kickSeat: vi.fn(),
      clearSeats: vi.fn(),
      fillBots: vi.fn(),
      configureGame: vi.fn(),
      shareRoom: vi.fn(),
      openProfile: vi.fn(),
      takeOverBots: createBotTakeoverCapability(true, vi.fn()),
    });
    const share = {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: vi.fn(),
      close: vi.fn(),
      copyLink: vi.fn(async () => undefined),
      shareImage: vi.fn(async () => undefined),
    };
    const connection = {
      status: { kind: 'live' as const },
      pendingDurableCount: 0,
      onRetryNow: vi.fn(),
    };
    const onSeatPress = vi.fn();
    const onBotSeatLongPress = vi.fn();
    const model = createUndercoverRoomShellModel({
      roomCode: '1234',
      isSubmitting: false,
      pendingActionKey: null,
      viewer: { userId: 'host', isHost: true, seat: getUndercoverUserSeat(state, 'host') },
      capabilities,
      onBack: vi.fn(),
      onTitlePress: vi.fn(),
      onTitleLongPress: vi.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: { normalDraws: 1, goldenDraws: 1 },
      onUserActionPress: vi.fn(),
      connection,
      state,
      revision: 3,
      controlledSeat: null,
      selectedSeat: null,
      isSelecting: false,
      seatsVisuallyDisabled: false,
      onSeatPress,
      onBotSeatLongPress,
      seatConfirmation: null,
      profile: null,
      share,
      controls,
      review: null,
      release: vi.fn(),
    });
    expect(model.roomCode).toBe('1234');
    expect(model.capabilities).toBe(capabilities);
    expect(model.header.userAction?.ticketCount).toBe(2);
    expect(model.connection).toBe(connection);
    expect(model.seats.source.count).toBe(6);
    expect(model.seats.onSeatPress).toBe(onSeatPress);
    expect(model.seats.onBotSeatLongPress).toBe(onBotSeatLongPress);
    expect(model.playerActions).toEqual(
      createUndercoverPlayerActions(
        controls,
        state,
        { userId: 'host', isHost: true, seat: getUndercoverUserSeat(state, 'host') },
        null,
      ),
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
      requestTakeSeat: vi.fn(),
      requestMoveSeat: vi.fn(),
      leaveSeat: vi.fn(),
      kickSeat: vi.fn(),
      clearSeats: vi.fn(),
      fillBots: vi.fn(),
      configureGame: vi.fn(),
      shareRoom: vi.fn(),
      openProfile: vi.fn(),
      takeOverBots: createBotTakeoverCapability(true, vi.fn()),
    });
    const model = createUndercoverHostManagement({
      state,
      capabilities,
      controls: { ...controls, isSubmitting: true },
      review: null,
    });
    const start = model.actions.find((action) => action.key === 'assign-roles');
    // Submitting marshal: disabled with no reason (the room IS full —
    // the lock, not a seat shortage, is what blocks it) and no handler.
    expect(start).toMatchObject({ label: '分配角色', state: { kind: 'blocked', reason: null } });
    expect(start?.state).not.toHaveProperty('onPress');
  });

  it('exposes the viewing phase on the shell model', () => {
    const state = createViewingState();
    const model = createUndercoverRoomShellModel({
      roomCode: '1234',
      isSubmitting: false,
      pendingActionKey: null,
      viewer: { userId: 'host', isHost: true, seat: getUndercoverUserSeat(state, 'host') },
      capabilities: createUndercoverRoomCapabilities({
        state,
        isHost: true,
        mySeat: 0,
        requestTakeSeat: vi.fn(),
        requestMoveSeat: vi.fn(),
        leaveSeat: vi.fn(),
        kickSeat: vi.fn(),
        clearSeats: vi.fn(),
        fillBots: vi.fn(),
        configureGame: vi.fn(),
        shareRoom: vi.fn(),
        openProfile: vi.fn(),
        takeOverBots: createBotTakeoverCapability(true, vi.fn()),
      }),
      onBack: vi.fn(),
      onTitlePress: vi.fn(),
      onTitleLongPress: vi.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: vi.fn(),
      connection: {
        status: { kind: 'live' as const },
        pendingDurableCount: 0,
        onRetryNow: vi.fn(),
      },
      state,
      revision: 3,
      controlledSeat: null,
      selectedSeat: null,
      isSelecting: false,
      seatsVisuallyDisabled: false,
      onSeatPress: vi.fn(),
      onBotSeatLongPress: vi.fn(),
      seatConfirmation: null,
      profile: null,
      share: {
        isVisible: false,
        roomCode: '1234',
        roomUrl: 'https://example.test/1234',
        open: vi.fn(),
        close: vi.fn(),
        copyLink: vi.fn(async () => undefined),
        shareImage: vi.fn(async () => undefined),
      },
      controls,
      review: null,
      release: vi.fn(),
    });
    expect(model.phase).toBe('viewing');
  });
});

it('clears the self-hint once every seat has viewed', () => {
  const viewing = createViewingState();
  const roundId = viewing.round!.roundId;
  const session = { dispatch: vi.fn() } as unknown as UndercoverRoomSession;
  const { result, rerender, unmount } = renderHook(
    ({ currentState }: { currentState: UndercoverState }) =>
      useUndercoverRoundControls({
        state: currentState,
        userId: 'host',
        controlledSeat: null,
        submit: submitVia(session),
        isSubmitting: false,
      }),
    { initialProps: { currentState: viewing } },
  );
  // 本人未确认：底部只出一处提示，指向查看按钮（展示契约 self-hint 态）。
  expect(
    createUndercoverPlayerActions(
      result.current,
      viewing,
      { userId: 'host', isHost: true, seat: getUndercoverUserSeat(viewing, 'host') },
      null,
    ),
  ).toMatchObject({
    message: '请点击「查看词卡」',
  });
  const viewingBottom = createUndercoverPlayerActions(
    result.current,
    viewing,
    { userId: 'host', isHost: true, seat: getUndercoverUserSeat(viewing, 'host') },
    null,
  );
  expect(viewingBottom.actions).toMatchObject([
    {
      key: 'card',
      label: '查看词卡',
      testID: TESTIDS.roomViewIdentityButton,
      state: { kind: 'ready' },
      isPending: true,
    },
  ]);
  let state = dispatch(viewing, { type: 'undercover.role.viewed', roundId });
  state = dispatch(state, { type: 'undercover.bots.markAllBotsViewed', roundId });
  expect(state.round!.confirmedSeats).toHaveLength(6);
  rerender({ currentState: state });
  expect(
    createUndercoverPlayerActions(
      result.current,
      state,
      { userId: 'host', isHost: true, seat: getUndercoverUserSeat(state, 'host') },
      null,
    ),
  ).toMatchObject({ message: null });
  unmount();
});

describe('createUndercoverHostManagement task body', () => {
  const buildFor = (state: UndercoverState, review = reviewEntryFor(state)) => {
    const session = { dispatch: vi.fn() } as unknown as UndercoverRoomSession;
    const { result } = renderHook(() =>
      useUndercoverRoundControls({
        state: state,
        userId: 'host',
        controlledSeat: null,
        submit: submitVia(session),
        isSubmitting: false,
      }),
    );
    const shareRoom = vi.fn();
    const capabilities = createUndercoverRoomCapabilities({
      state,
      isHost: true,
      mySeat: 0,
      requestTakeSeat: vi.fn(),
      requestMoveSeat: vi.fn(),
      leaveSeat: vi.fn(),
      kickSeat: vi.fn(),
      clearSeats: vi.fn(),
      fillBots: vi.fn(),
      configureGame: vi.fn(),
      shareRoom,
      openProfile: vi.fn(),
      takeOverBots: createBotTakeoverCapability(true, vi.fn()),
    });
    const model = createUndercoverHostManagement({
      state,
      capabilities,
      controls: result.current,
      review,
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

  it('blocks the round start in a non-full lobby with a seat-count reason', () => {
    const { model } = buildFor(lobbyState(false));
    const step = hostTaskBody(model);
    expect(step).toMatchObject({ action: { key: 'assign-roles', label: '分配角色' } });
    if (step?.kind !== 'action' || step.action.state.kind !== 'blocked')
      throw new Error('expected a blocked task action');
    expect(step.action.state.reason).toBe('座位尚未坐满（还差 5 人）');
    // The panel caption renders the same player-facing reason; the
    // bot-mentioning command-failure copy must never reach it.
    const startAction = model.actions.find((action) => action.key === 'assign-roles');
    if (startAction?.state.kind !== 'blocked') throw new Error('expected a blocked start action');
    expect(startAction.state.reason).toBe('座位尚未坐满（还差 5 人）');
    expect(startAction.state.reason).not.toContain('机器人');
  });

  it('offers the round start once the room is full and gates its press with a confirm', () => {
    vi.mocked(confirmAction).mockClear();
    const { model } = buildFor(lobbyState(true));
    const step = hostTaskBody(model);
    if (step?.kind !== 'action' || step.action.state.kind !== 'ready')
      throw new Error('expected a ready task action');
    step.action.state.onPress();
    expect(confirmAction).toHaveBeenCalledWith({
      label: '分配角色？',
      body: '将为每位玩家分配词卡',
      onConfirm: expect.any(Function) as unknown,
    });
  });

  it('blocks game start while cards are unviewed, then offers it once all are confirmed', () => {
    const viewing = createViewingState();
    const blockedBuild = buildFor(viewing);
    expect(blockedBuild.model.pendingActionKeys).toEqual([]);
    const blocked = hostTaskBody(blockedBuild.model);
    expect(blocked).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (blocked?.kind !== 'action' || blocked.action.state.kind !== 'blocked')
      throw new Error('expected a blocked task action');
    expect(blocked.action.state.reason).toBe('0/6 位玩家已查看词卡，等待剩余玩家');

    const roundId = viewing.round!.roundId;
    let confirmed = dispatch(viewing, { type: 'undercover.role.viewed', roundId });
    expect(buildFor(confirmed).model.pendingActionKeys).toEqual(['start-game']);
    confirmed = dispatch(confirmed, { type: 'undercover.bots.markAllBotsViewed', roundId });
    const ready = hostTaskBody(buildFor(confirmed).model);
    if (ready?.kind !== 'action' || ready.action.state.kind !== 'ready')
      throw new Error('expected a ready task action');
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
    const ready = hostTaskBody(buildFor(state).model);
    if (ready?.kind !== 'action' || ready.action.state.kind !== 'ready')
      throw new Error('expected a ready task action');
    expect(ready).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
  });

  it('offers review and a destructive restart after a completed round', () => {
    const { model } = buildFor(createEndedState());
    expect(model.task).toEqual({ kind: 'choice', actionKeys: ['review', 'restart'] });
    expect(model.actions.map((action) => action.key)).toEqual(['review', 'restart']);
    const body = hostTaskBody(model);
    if (body?.kind !== 'choice') throw new Error('expected a choice task body');
    expect(body.actions.map((action) => action.label)).toEqual(['本局复盘', '重新开始']);
    const restart = body.actions[1];
    if (restart?.state.kind !== 'ready') throw new Error('Expected enabled restart');
    restart.state.onPress();
    expect(confirmAction).toHaveBeenCalledWith({
      label: '重新开始？',
      body: expect.stringContaining('本局已结算') as unknown,
      tone: 'danger',
      confirmText: '重新开始',
      onConfirm: expect.any(Function) as unknown,
    });
  });

  it('fails fast when an ended round reaches the host panel without its review', () => {
    expect(() => buildFor(createEndedState(), null)).toThrow(
      '[FAIL-FAST] Undercover ended host has no review entry',
    );
  });
});

describe('createUndercoverPlayerActions phase messages (PR-B G-1/G-7/G-9)', () => {
  const idleControls: UndercoverRoundControls = {
    isSubmitting: false,
    controlledSeat: null,
    card: null,
    canViewCard: false,
    shouldConfirm: false,
    openCard: vi.fn(),
    closeCard: vi.fn(),
    confirmCard: vi.fn(),
    markAllBotsViewed: vi.fn(),
    begin: vi.fn(),
    isSelecting: false,
    selectedSeat: null,
    reveal: vi.fn(),
    selectSeat: vi.fn(),
    beginSelection: vi.fn(),
    cancelRevelation: vi.fn(),
    cancelSelection: vi.fn(),
    start: vi.fn(),
    retry: vi.fn(),
    restart: vi.fn(),
    allowRepeated: vi.fn(),
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
      createUndercoverPlayerActions(
        idleControls,
        state,
        { userId: 'u1', isHost: false, seat: 2 },
        null,
      ).message,
    ).toBe('等待房主开始游戏');
    expect(
      createUndercoverPlayerActions(
        idleControls,
        state,
        { userId: 'host', isHost: true, seat: 0 },
        null,
      ).message,
    ).toBeNull();
    expect(
      createUndercoverPlayerActions(
        idleControls,
        state,
        { userId: 'u1', isHost: false, seat: null },
        null,
      ).message,
    ).toBeNull();
  });

  it('shows the preparing status while words are prepared', () => {
    const state = dispatch(createLobbyState(), {
      type: 'undercover.roles.assign',
      shouldAllowRepeated: false,
    });
    expect(state.phase).toBe('preparing');
    expect(
      createUndercoverPlayerActions(
        idleControls,
        state,
        { userId: 'u1', isHost: false, seat: 2 },
        null,
      ).message,
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
    const player = { userId: 'u1', isHost: false, seat: 2 };
    const host = { userId: 'host', isHost: true, seat: 0 };
    expect(
      createUndercoverPlayerActions(idleControls, failed('selectionFailed'), player, null).message,
    ).toBe('词语准备失败，等待房主处理');
    expect(
      createUndercoverPlayerActions(idleControls, failed('inventoryEmpty'), player, null).message,
    ).toBe('暂无可用词语，等待房主处理');
    expect(
      createUndercoverPlayerActions(idleControls, failed('inventoryExhausted'), player, null)
        .message,
    ).toBe('该类别的新词已用完，等待房主处理');
    expect(
      createUndercoverPlayerActions(idleControls, failed('inventoryExhausted'), host, null).message,
    ).toBe('该类别的新词已用完');
  });

  it('keeps the speaking order resident for everyone during ongoing', () => {
    const state = createOngoingState();
    expect(state.phase).toBe('ongoing');
    if (state.phase !== 'ongoing') throw new Error('Expected ongoing');
    const expected = `本轮从 ${state.round.speakingStartSeat + 1} 号起按座位顺序发言`;
    expect(
      createUndercoverPlayerActions(
        idleControls,
        state,
        { userId: 'u1', isHost: false, seat: 2 },
        null,
      ).message,
    ).toBe(expected);
    expect(
      createUndercoverPlayerActions(
        idleControls,
        state,
        { userId: 'host', isHost: true, seat: 0 },
        null,
      ).message,
    ).toBe(expected);
  });

  it('offers the review to seats and spectators of a concluded round; the host uses the task card', () => {
    const ended = createEndedState();
    const review = reviewEntryFor(ended);
    const reviewButton = {
      key: 'review',
      label: '本局复盘',
      audience: 'anyone',
      testID: TESTIDS.roomReviewOpenButton,
      state: { kind: 'ready' },
    };
    for (const viewer of [
      { userId: 'u1', isHost: false, seat: 2 },
      { userId: 'visitor', isHost: false, seat: null },
    ]) {
      expect(createUndercoverPlayerActions(idleControls, ended, viewer, review)).toMatchObject({
        actions: [reviewButton],
      });
    }
    expect(
      createUndercoverPlayerActions(
        idleControls,
        ended,
        { userId: 'host', isHost: true, seat: 0 },
        review,
      ),
    ).toMatchObject({ actions: [] });
  });

  it('fails fast when an ended round reaches the bottom panel without its review', () => {
    expect(() =>
      createUndercoverPlayerActions(
        idleControls,
        createEndedState(),
        { userId: 'u1', isHost: false, seat: 2 },
        null,
      ),
    ).toThrow('[FAIL-FAST] Undercover ended round has no review entry');
  });
});
