import { FIB_MAX_PLAYERS, type FibState } from '@game-judge/game-engine/games/fibking/public';

import { createBotTakeoverCapability } from '@/features/room/model/RoomCapabilities';
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { fibReview } from '@/games/fibking/review/fibReview';
import {
  createFibBoardInfoSections,
  createFibHostManagement,
  createFibPlayerActions,
  createFibRoomCapabilities,
  createFibRoomShellModel,
  createFibSeatDataSource,
  getFibProfileTarget,
  getFibSeatTapIntent,
} from '@/games/fibking/room/fibRoomAdapter';
import { hostTaskBody } from '@/test-utils/hostTask';
import { TESTIDS } from '@/testids';
import { alertStore } from '@/utils/alert';

/** The entry the room derives for this state from the real review contribution. */
function reviewEntryFor(state: FibState): RoomReviewEntry | null {
  const availability = fibReview.resolve({
    state,
    viewer: { userId: 'host', isHost: true, seat: 0 },
    roomCode: '4321',
  });
  return availability.kind === 'available' ? { isEnabled: true, onPress: vi.fn() } : null;
}

const callbacks = {
  requestTakeSeat: vi.fn(),
  requestMoveSeat: vi.fn(),
  leaveSeat: vi.fn(),
  kickSeat: vi.fn(),
  clearSeats: vi.fn(),
  fillBots: vi.fn(),
  configureGame: vi.fn(),
  openProfile: vi.fn(),
  takeOverBots: createBotTakeoverCapability(true, vi.fn()),
  shareRoom: vi.fn(),
};

function createLobby(numberOfPlayers = 8): Extract<FibState, { phase: 'lobby' }> {
  return {
    gameType: 'fibking',
    roomCode: '4321',
    hostUserId: 'host',
    phase: 'lobby',
    numberOfPlayers,
    roster: {
      0: {
        userId: 'host',
        seat: 0,
        profile: { displayName: '房主' },
      },
    },
    usedWords: [],
    reviewCompletedUserIds: [],
    pendingRound: null,
    preparationFailure: null,
    round: null,
  };
}

/** Returns the state with explicit bot occupants on the given seats. */
function withBotSeats<T extends FibState>(state: T, seats: readonly number[]): T {
  const roster: Record<number, FibState['roster'][number]> = { ...state.roster };
  for (const seat of seats) roster[seat] = { seat, kind: 'bot' };
  return { ...state, roster };
}

function createOngoing(): Extract<FibState, { phase: 'ongoing' }> {
  return {
    ...withBotSeats(createLobby(4), [1, 2, 3]),
    phase: 'ongoing',
    usedWords: ['山谷'],
    pendingRound: null,
    round: {
      roundId: 'round-1',
      word: '山谷',
      definition: {
        coreMeaning: '两山之间低洼而且狭长的自然地形区域。',
        usageNote: '常用于描述山地之间可供河流或道路穿行的低地。',
      },
      source: 'local',
      roles: { guesserSeat: 1, honestSeat: 2 },
      viewedSeats: [0, 1, 2, 3],
      guesses: [],
    },
  };
}

function createViewing(viewedSeats: readonly number[]): Extract<FibState, { phase: 'viewing' }> {
  const ongoing = createOngoing();
  return { ...ongoing, phase: 'viewing', round: { ...ongoing.round, viewedSeats } };
}

describe('FibKing room adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows room sharing through identity viewing but not during play', () => {
    for (const [state, expected] of [
      [createLobby(), true],
      [createViewing([]), true],
      [createOngoing(), false],
    ] as const) {
      const capabilities = createFibRoomCapabilities({
        state,
        isHost: false,
        mySeat: 0,
        ...callbacks,
      });
      expect(capabilities.canShareRoom.isAllowed).toBe(expected);
    }
  });

  it('gates begin on the viewing checkpoint and offers the scaffold while bots are unmarked', () => {
    const markAllBotsViewed = vi.fn();
    const build = (state: FibState) =>
      createFibHostManagement({
        state,
        isCommandSubmitting: false,
        capabilities: createFibRoomCapabilities({
          state,
          isHost: true,
          mySeat: 0,
          ...callbacks,
        }),
        startRound: vi.fn(),
        markAllBotsViewed,
        beginRound: vi.fn(),
        isGuessing: false,
        toggleGuessMode: vi.fn(),
        revealRound: vi.fn(),
        redrawRound: vi.fn(),

        restartGame: vi.fn(),
        review: reviewEntryFor(state),
      });
    const flowActions = (state: FibState) =>
      build(state)?.actions.filter((action) =>
        ['start-game', 'mark-bots-viewed'].includes(action.key),
      ) ?? [];

    const pending = flowActions(createViewing([0]));
    expect(build(createViewing([])).pendingActionKeys).toEqual([]);
    expect(build(createViewing([0])).pendingActionKeys).toEqual(['start-game']);
    expect(pending.map((action) => action.key)).toEqual(['start-game', 'mark-bots-viewed']);
    expect(pending[0]).toEqual(
      expect.objectContaining({
        label: '开始游戏',
        state: { kind: 'blocked', reason: '1/4 位玩家已查看身份，等待剩余玩家' },
      }),
    );
    expect(pending[1]).toEqual(expect.objectContaining({ label: '标记机器人已查看' }));

    const ready = flowActions(createViewing([0, 1, 2, 3]));
    expect(ready.map((action) => action.key)).toEqual(['start-game']);
    expect(ready[0]).toMatchObject({ label: '开始游戏', state: { kind: 'ready' } });
  });

  it('tracks identity pending for the controlled seat, not the host or spectator', () => {
    const state = createViewing([0, 2]);
    const make = (viewerSeat: number | null) =>
      createFibPlayerActions({
        state,
        isHost: true,
        viewerSeat,
        isSubmitting: false,
        openIdentity: vi.fn(),
        review: null,
      }).actions[0];
    expect(make(1)?.isPending).toBe(true);
    expect(make(2)?.isPending).toBe(false);
    expect(make(null)?.isPending).toBe(false);
  });

  it('locks host actions while a command is submitting', () => {
    const build = (state: FibState) =>
      createFibHostManagement({
        state,
        isCommandSubmitting: true,
        capabilities: createFibRoomCapabilities({
          state,
          isHost: true,
          mySeat: 0,
          ...callbacks,
        }),
        startRound: vi.fn(),
        markAllBotsViewed: vi.fn(),
        beginRound: vi.fn(),
        isGuessing: false,
        toggleGuessMode: vi.fn(),
        revealRound: vi.fn(),
        redrawRound: vi.fn(),

        restartGame: vi.fn(),
        review: reviewEntryFor(state),
      });

    // Full lobby: the start action is lock-disabled with no reason and
    // a loading state (the room IS full — the lock blocks it, not seats).
    const fullLobby = withBotSeats(createLobby(4), [1, 2, 3]);
    const lobbyStart = build(fullLobby)?.actions.find((action) => action.key === 'assign-roles');
    expect(lobbyStart).toMatchObject({
      label: '分配角色',
      state: { kind: 'busy' },
    });
    expect(lobbyStart?.state).not.toHaveProperty('onPress');

    // Ongoing: every pending-aware flow/danger action drops its handler.
    const ongoingActions = build(createOngoing())?.actions ?? [];
    expect(ongoingActions.map((action) => action.key)).toEqual([
      'guess-seat',
      'reveal-round',
      'redraw-round',
      'restart',
    ]);
    expect(ongoingActions.map((action) => action.state.kind)).toEqual([
      'blocked',
      'blocked',
      'blocked',
      'busy',
    ]);
  });

  it('derives shared lobby operations without a Fib-specific header implementation', () => {
    const state = createLobby();
    const capabilities = createFibRoomCapabilities({
      state,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });

    expect(capabilities.canMoveSeat.isAllowed).toBe(true);
    expect(capabilities.canLeaveSeat.isAllowed).toBe(true);
    expect(capabilities.canKickSeat.isAllowed).toBe(true);
    expect(capabilities.canClearSeats.isAllowed).toBe(true);
    expect(capabilities.canFillBots.isAllowed).toBe(true);
    expect(capabilities.canConfigureGame.isAllowed).toBe(true);
    expect(capabilities.canShareRoom.isAllowed).toBe(true);
    // 接管无阶段条件：大厅里房主也可接管机器人（用户裁决）。
    expect(capabilities.canTakeOverBots.isAllowed).toBe(true);
  });

  it('executes profile leave and kick directly through the shared capabilities', () => {
    const capabilities = createFibRoomCapabilities({
      state: createLobby(),
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    if (!capabilities.canLeaveSeat.isAllowed || !capabilities.canKickSeat.isAllowed) {
      throw new Error('Expected FibKing profile seat operations to be executable');
    }

    capabilities.canLeaveSeat.execute();
    capabilities.canKickSeat.execute(2);

    expect(callbacks.leaveSeat).toHaveBeenCalledTimes(1);
    expect(callbacks.kickSeat).toHaveBeenCalledWith(2);
  });

  it('locks seat mutation during a round while retaining profile and bot-control capabilities', () => {
    const capabilities = createFibRoomCapabilities({
      state: createOngoing(),
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });

    expect(capabilities.canTakeSeat.isAllowed).toBe(false);
    expect(capabilities.canMoveSeat.isAllowed).toBe(false);
    expect(capabilities.canLeaveSeat.isAllowed).toBe(false);
    expect(capabilities.canKickSeat.isAllowed).toBe(false);
    expect(capabilities.canClearSeats.isAllowed).toBe(false);
    expect(capabilities.canFillBots.isAllowed).toBe(false);
    expect(capabilities.canConfigureGame.isAllowed).toBe(false);
    expect(capabilities.canShareRoom.isAllowed).toBe(false);
    expect(capabilities.canViewProfiles.isAllowed).toBe(true);
    expect(capabilities.canTakeOverBots.isAllowed).toBe(true);
  });

  it('projects sparse human seats and bot seats at the product maximum', () => {
    const state = withBotSeats(
      createLobby(FIB_MAX_PLAYERS),
      Array.from({ length: FIB_MAX_PLAYERS - 1 }, (_, index) => index + 1),
    ) satisfies FibState;
    const source = createFibSeatDataSource({
      state,
      revision: 7,
      myUserId: 'host',
      controlledSeat: FIB_MAX_PLAYERS - 1,
    });

    expect(source.count).toBe(FIB_MAX_PLAYERS);
    expect(source.getSeat(0)).toMatchObject({
      player: { occupant: { kind: 'human', userId: 'host' } },
      isSelf: true,
    });
    expect(source.getSeat(FIB_MAX_PLAYERS - 1)).toMatchObject({
      player: { occupant: { kind: 'bot', seat: FIB_MAX_PLAYERS - 1 } },
      highlight: 'controlled',
    });
    // Exactly one human is seated; every other seat is an explicit bot.
    expect(
      Object.values(state.roster).filter((occupant) => occupant != null && 'userId' in occupant),
    ).toHaveLength(1);
  });

  it('shows the viewed badge per seat only during the viewing stage (B-1)', () => {
    const viewingSource = createFibSeatDataSource({
      state: createViewing([0, 2]),
      revision: 1,
      myUserId: 'host',
      controlledSeat: null,
    });
    expect(viewingSource.getSeat(0).showReadyBadge).toBe(true);
    expect(viewingSource.getSeat(1).showReadyBadge).toBe(false);
    expect(viewingSource.getSeat(2).showReadyBadge).toBe(true);
    expect(viewingSource.getSeat(3).showReadyBadge).toBe(false);

    // The record survives into ongoing, but the badge belongs to the
    // viewing stage only.
    const ongoingSource = createFibSeatDataSource({
      state: createOngoing(),
      revision: 2,
      myUserId: 'host',
      controlledSeat: null,
    });
    expect(ongoingSource.getSeat(0).showReadyBadge).toBe(false);
  });

  it('reveals only the public guesser label during play and every role after reveal', () => {
    const ongoing = createOngoing();
    const ongoingSource = createFibSeatDataSource({
      state: ongoing,
      revision: 1,
      myUserId: 'host',
      controlledSeat: null,
    });
    expect(ongoingSource.getSeat(1).secondaryLabel).toBe('大聪明');
    expect(ongoingSource.getSeat(2).secondaryLabel).toBeNull();
    expect(ongoingSource.getSeat(3).secondaryLabel).toBeNull();

    const ended = { ...ongoing, phase: 'ended' as const };
    const endedSource = createFibSeatDataSource({
      state: ended,
      revision: 2,
      myUserId: 'host',
      controlledSeat: null,
    });
    expect(endedSource.getSeat(1).secondaryLabel).toBe('大聪明');
    expect(endedSource.getSeat(2).secondaryLabel).toBe('老实人');
    expect(endedSource.getSeat(3).secondaryLabel).toBe('瞎掰王');
  });

  it('represents bot seats as the same shared profile target kind used by the room shell', () => {
    const ongoing = createOngoing();
    expect(getFibProfileTarget(ongoing, 0)).toEqual({
      seat: 0,
      occupant: { kind: 'human', userId: 'host' },
      rosterName: '房主',
    });
    expect(getFibProfileTarget(ongoing, 3)).toEqual({
      seat: 3,
      occupant: { kind: 'bot', seat: 3 },
      rosterName: '机器人4号',
    });
  });

  it('projects a kicked bot seat as empty without changing other bot seats', () => {
    const state = withBotSeats(createLobby(4), [1, 3]) satisfies FibState;
    const source = createFibSeatDataSource({
      state,
      revision: 2,
      myUserId: 'host',
      controlledSeat: null,
    });

    expect(getFibProfileTarget(state, 2)).toBeNull();
    expect(source.getSeat(2).player).toBeNull();
    expect(source.getSeat(3).player).toMatchObject({ occupant: { kind: 'bot', seat: 3 } });
  });

  it('routes a lobby bot seat through the shared profile intent', () => {
    const lobby = withBotSeats(createLobby(4), [1, 2, 3]) satisfies FibState;

    expect(getFibSeatTapIntent({ state: lobby, seat: 2, currentSeat: null })).toEqual({
      kind: 'profile',
      target: {
        seat: 2,
        occupant: { kind: 'bot', seat: 2 },
        rosterName: '机器人3号',
      },
    });
  });

  it('routes a genuinely empty lobby seat through the shared take intent', () => {
    expect(getFibSeatTapIntent({ state: createLobby(4), seat: 2, currentSeat: null })).toEqual({
      kind: 'take',
      seat: 2,
    });
  });

  it('keeps the public result beside the review once the answer is out; the host review is on the task card', () => {
    const ended = { ...createOngoing(), phase: 'ended' as const };
    const review = reviewEntryFor(ended);
    const viewResult = {
      label: '查看结果',
      testID: TESTIDS.fibViewResultButton,
      category: 'resource',
      state: { kind: 'ready' },
    };
    for (const viewer of [
      { isHost: false, viewerSeat: 1 },
      { isHost: false, viewerSeat: null },
    ]) {
      const actions = createFibPlayerActions({
        state: ended,
        ...viewer,
        openIdentity: vi.fn(),
        isSubmitting: false,
        review,
      });
      expect(actions.actions).toMatchObject([
        { ...viewResult },
        {
          key: 'review',
          label: '本局复盘',
          audience: 'anyone',
          category: 'resource',
          testID: TESTIDS.roomReviewOpenButton,
          state: { kind: 'ready' },
        },
      ]);
    }
    const hostActions = createFibPlayerActions({
      state: ended,
      isHost: true,
      viewerSeat: 0,
      openIdentity: vi.fn(),
      isSubmitting: false,
      review,
    });
    expect(hostActions.actions).toHaveLength(1);
    expect(hostActions.actions[0]).toMatchObject(viewResult);
    expect(() =>
      createFibPlayerActions({
        state: ended,
        isHost: false,
        viewerSeat: 1,
        openIdentity: vi.fn(),
        isSubmitting: false,
        review: null,
      }),
    ).toThrow('[FAIL-FAST] FibKing ended round has no review entry');
  });

  it('derives discoverable Host management tasks from Fib phases', async () => {
    const startRound = vi.fn();
    const revealRound = vi.fn();
    const redrawRound = vi.fn();
    const restartGame = vi.fn();
    const lobby = createLobby();
    const lobbyCapabilities = createFibRoomCapabilities({
      state: lobby,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const lobbyManagement = createFibHostManagement({
      review: null,
      state: lobby,
      isCommandSubmitting: false,
      capabilities: lobbyCapabilities,
      startRound,
      markAllBotsViewed: vi.fn(),
      beginRound: vi.fn(),
      isGuessing: false,
      toggleGuessMode: vi.fn(),
      revealRound,
      redrawRound,

      restartGame,
    });

    expect(lobbyManagement?.actions).toMatchObject([
      {
        label: '分配角色',
        state: { kind: 'blocked', reason: '座位尚未坐满（还差 7 人）' },
      },
      { label: '房间设置', state: { kind: 'ready' } },
      { label: '填充机器人', state: { kind: 'ready' } },
      { label: '清空座位', state: { kind: 'ready' } },
    ]);
    const startAction = lobbyManagement?.actions[0];
    if (startAction?.state.kind !== 'blocked') throw new Error('Expected a disabled Fib start');
    expect(lobbyManagement.task).toMatchObject({
      kind: 'action',
      actionKey: 'assign-roles',
    });

    const ongoing = createOngoing();
    const ongoingCapabilities = createFibRoomCapabilities({
      state: ongoing,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const ongoingManagement = createFibHostManagement({
      review: null,
      state: ongoing,
      isCommandSubmitting: false,
      capabilities: ongoingCapabilities,
      startRound,
      markAllBotsViewed: vi.fn(),
      beginRound: vi.fn(),
      isGuessing: false,
      toggleGuessMode: vi.fn(),
      revealRound,
      redrawRound,

      restartGame,
    });
    const ongoingActions = ongoingManagement?.actions;
    expect(ongoingActions).toMatchObject([
      { label: '大聪明选人', state: { kind: 'ready' } },
      { label: '公布答案', state: { kind: 'ready' } },
      { label: '重新抽词', state: { kind: 'ready' } },
      { label: '重新开始', category: 'danger', state: { kind: 'ready' } },
    ]);
    const revealAction = ongoingActions?.[1];
    const redrawAction = ongoingActions?.[2];
    const abandonAction = ongoingActions?.[3];
    if (
      revealAction?.state.kind !== 'ready' ||
      redrawAction?.state.kind !== 'ready' ||
      abandonAction?.state.kind !== 'ready'
    ) {
      throw new Error('Expected enabled ongoing Fib Host actions');
    }
    revealAction.state.onPress();
    redrawAction.state.onPress();
    abandonAction.state.onPress();
    expect(revealRound).toHaveBeenCalledTimes(1);
    expect(redrawRound).toHaveBeenCalledTimes(1);
    expect(restartGame).not.toHaveBeenCalled();
    expect(alertStore.getSnapshot()?.message).toContain('不结算完成奖励');
    await alertStore
      .getSnapshot()
      ?.buttons.find((button) => button.text === '取消')
      ?.onPress?.();
    expect(restartGame).not.toHaveBeenCalled();
    await alertStore
      .getSnapshot()
      ?.buttons.find((button) => button.text === '重新开始')
      ?.onPress?.();
    expect(restartGame).toHaveBeenCalledTimes(1);

    const ended = { ...ongoing, phase: 'ended' as const };
    const endedCapabilities = createFibRoomCapabilities({
      state: ended,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const endedManagement = createFibHostManagement({
      review: reviewEntryFor(ended),
      state: ended,
      isCommandSubmitting: false,
      capabilities: endedCapabilities,
      startRound,
      markAllBotsViewed: vi.fn(),
      beginRound: vi.fn(),
      isGuessing: false,
      toggleGuessMode: vi.fn(),
      revealRound,
      redrawRound,

      restartGame,
    });
    expect(endedManagement.actions.map((action) => action.key)).toEqual(['review', 'restart']);
    expect(endedManagement.task).toEqual({ kind: 'choice', actionKeys: ['review', 'restart'] });
    const endAction = endedManagement?.actions.find((action) => action.key === 'restart');
    if (endAction?.state.kind !== 'ready') throw new Error('Expected enabled restart action');
    endAction.state.onPress();
    expect(alertStore.getSnapshot()?.message).toContain('本局已结算');
    expect(alertStore.getSnapshot()?.message).toContain('可能无法查看复盘');
    await alertStore
      .getSnapshot()
      ?.buttons.find((button) => button.text === '重新开始')
      ?.onPress?.();
    expect(restartGame).toHaveBeenCalledTimes(2);
  });

  it('keeps Fib player actions limited to the current player', () => {
    const openIdentity = vi.fn();
    const common = {
      isHost: true,
      viewerSeat: 0,
      isSubmitting: false,
      openIdentity,
      review: null,
    };

    const lobby = createFibPlayerActions({ state: createLobby(), ...common });
    expect(lobby.actions).toEqual([]);

    const ongoing = createOngoing();
    const ongoingActions = createFibPlayerActions({ state: ongoing, ...common });
    expect(ongoingActions.actions).toMatchObject([
      {
        label: '查看身份',
        category: 'resource',
        testID: TESTIDS.roomViewIdentityButton,
        state: { kind: 'ready' },
      },
    ]);
    const identityAction = ongoingActions.actions[0];
    if (identityAction?.state.kind !== 'ready') throw new Error('Expected enabled identity action');
    identityAction.state.onPress();
    expect(openIdentity).toHaveBeenCalledTimes(1);
  });

  it('offers recovery actions after preparation fails', async () => {
    const startRound = vi.fn();
    const restartGame = vi.fn();
    const failed: FibState = {
      ...withBotSeats(createLobby(4), [1, 2, 3]),
      phase: 'preparationFailed',
      pendingRound: null,
      preparationFailure: {
        roundId: 'round-1',
        requestedAt: 1,
        failedAt: 8_001,
        failureCode: 'selectionFailed',
      },
      round: null,
    };
    const common = {
      viewerSeat: null,
      openIdentity: vi.fn(),
      isSubmitting: false,
      review: null,
    };

    const capabilities = createFibRoomCapabilities({
      state: failed,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const hostManagement = createFibHostManagement({
      state: failed,
      isCommandSubmitting: false,
      capabilities,
      startRound,
      markAllBotsViewed: vi.fn(),
      beginRound: vi.fn(),
      isGuessing: false,
      toggleGuessMode: vi.fn(),
      restartGame,
      revealRound: vi.fn(),
      redrawRound: vi.fn(),
      review: null,
    });
    expect(hostManagement?.actions).toMatchObject([
      { label: '重新准备', state: { kind: 'ready' } },
      { label: '重新开始', category: 'danger', state: { kind: 'ready' } },
    ]);
    const retryAction = hostManagement?.actions[0];
    const returnLobbyAction = hostManagement?.actions[1];
    if (retryAction?.state.kind !== 'ready' || returnLobbyAction?.state.kind !== 'ready') {
      throw new Error('Expected enabled Fib preparation recovery actions');
    }
    retryAction.state.onPress();
    returnLobbyAction.state.onPress();
    expect(startRound).toHaveBeenCalledTimes(1);
    expect(restartGame).not.toHaveBeenCalled();
    await alertStore
      .getSnapshot()
      ?.buttons.find((button) => button.text === '重新开始')
      ?.onPress?.();
    expect(restartGame).toHaveBeenCalledTimes(1);

    const playerActions = createFibPlayerActions({ state: failed, isHost: false, ...common });
    expect(playerActions.actions).toEqual([]);
    expect(playerActions.message).toBe('词语准备失败，等待房主重新准备');
  });

  it('does not expose host progression actions to a non-host', () => {
    const openIdentity = vi.fn();

    const lobby = createFibPlayerActions({
      state: createLobby(),
      isHost: false,
      viewerSeat: null,
      openIdentity,
      isSubmitting: false,
      review: null,
    });
    expect(lobby.actions).toEqual([]);
    expect(lobby.message).toBeNull();

    const ongoingPlayer = createFibPlayerActions({
      state: createOngoing(),
      isHost: false,
      viewerSeat: 0,
      openIdentity,
      isSubmitting: false,
      review: null,
    });
    expect(ongoingPlayer.actions).toMatchObject([
      {
        label: '查看身份',
        category: 'resource',
        testID: TESTIDS.roomViewIdentityButton,
        state: { kind: 'ready' },
      },
    ]);

    const ongoingSpectator = createFibPlayerActions({
      state: createOngoing(),
      isHost: false,
      viewerSeat: null,
      openIdentity,
      isSubmitting: false,
      review: null,
    });
    expect(ongoingSpectator.actions).toMatchObject([
      {
        label: '查看题目',
        category: 'resource',
        testID: TESTIDS.roomViewIdentityButton,
        state: { kind: 'ready' },
      },
    ]);
  });
});

describe('createFibHostManagement task body', () => {
  beforeEach(() => vi.clearAllMocks());

  const build = (state: FibState, review = reviewEntryFor(state), isGuessing = false) =>
    createFibHostManagement({
      state,
      isCommandSubmitting: false,
      capabilities: createFibRoomCapabilities({ state, isHost: true, mySeat: 0, ...callbacks }),
      startRound: vi.fn(),
      markAllBotsViewed: vi.fn(),
      beginRound: vi.fn(),
      isGuessing,
      toggleGuessMode: vi.fn(),
      revealRound: vi.fn(),
      redrawRound: vi.fn(),

      restartGame: vi.fn(),
      review,
    });

  it('blocks the round start in a non-full lobby', () => {
    const step = hostTaskBody(build(createLobby(4)));
    expect(step).toMatchObject({ action: { key: 'assign-roles', label: '分配角色' } });
    if (step?.kind !== 'action') throw new Error('expected an action task body');
    expect(step.action.state).toEqual({
      kind: 'blocked',
      reason: '座位尚未坐满（还差 3 人）',
    });
  });

  it('offers the round start once every seat is taken', () => {
    const step = hostTaskBody(build(withBotSeats(createLobby(4), [1, 2, 3])));
    expect(step).toMatchObject({ action: { key: 'assign-roles', label: '分配角色' } });
    if (step?.kind !== 'action' || step.action.state.kind !== 'ready')
      throw new Error('expected a ready action task body');
  });

  it('blocks game start until every seat has viewed, then offers it', () => {
    const blocked = hostTaskBody(build(createViewing([0])));
    expect(blocked).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
    if (blocked?.kind !== 'action') throw new Error('expected an action task body');
    expect(blocked.action.state).toEqual({
      kind: 'blocked',
      reason: '1/4 位玩家已查看身份，等待剩余玩家',
    });

    const ready = hostTaskBody(build(createViewing([0, 1, 2, 3])));
    if (ready?.kind !== 'action' || ready.action.state.kind !== 'ready')
      throw new Error('expected a ready action task body');
  });

  it('offers re-preparation directly after a failed preparation', () => {
    const failed: FibState = {
      ...withBotSeats(createLobby(4), [1, 2, 3]),
      phase: 'preparationFailed',
      pendingRound: null,
      preparationFailure: {
        roundId: 'round-1',
        requestedAt: 1,
        failedAt: 8_001,
        failureCode: 'selectionFailed',
      },
      round: null,
    };
    const model = build(failed);
    expect(model.pendingActionKeys).toEqual([]);
    expect(model.hasPendingDecision).toBe(true);
    const step = hostTaskBody(model);
    expect(step).toMatchObject({ action: { key: 'retry-preparation', label: '重新准备' } });
    if (step?.kind !== 'action' || step.action.state.kind !== 'ready')
      throw new Error('expected a ready action task body');
  });

  it('marks guessing as the ongoing task, without marking the selection or optional reveal', () => {
    const ongoing = createOngoing();
    const model = build(ongoing);
    expect(model.pendingActionKeys).toEqual(['guess-seat']);
    expect(hostTaskBody(model)).toMatchObject({
      kind: 'action',
      action: { key: 'guess-seat', label: '大聪明选人' },
    });
    const selecting = build(ongoing, null, true);
    expect(selecting.pendingActionKeys).toEqual([]);
    expect(hostTaskBody(selecting)).toMatchObject({
      kind: 'message',
      escape: { key: 'guess-seat', label: '取消选人' },
    });
  });

  it('closes an ended round on the review and restart actions', () => {
    const body = hostTaskBody(build({ ...createOngoing(), phase: 'ended' }));
    if (body?.kind !== 'choice') throw new Error('expected a choice task body');
    expect(body.actions.map((action) => action.label)).toEqual(['本局复盘', '重新开始']);
  });

  it('fails fast when an ended round reaches the host panel without its review', () => {
    expect(() => build({ ...createOngoing(), phase: 'ended' }, null)).toThrow(
      '[FAIL-FAST] FibKing ended host has no review entry',
    );
  });
});

describe('createFibBoardInfoSections', () => {
  it('builds the guesser / honest / fibber sections with fibber count N-2', () => {
    const sections = createFibBoardInfoSections(4);
    expect(sections.map((section) => section.title)).toEqual(['大聪明', '老实人', '瞎掰王']);
    expect(sections.map((section) => section.items[0]?.count)).toEqual([1, 1, 2]);
    expect(createFibBoardInfoSections(6)[2]?.items[0]?.count).toBe(4);
  });
});

describe('createFibRoomShellModel', () => {
  it('assembles the shell from the hook projections (AU-01 characterization)', () => {
    const state = createLobby(4);
    const capabilities = createFibRoomCapabilities({
      state,
      isHost: true,
      mySeat: null,
      ...callbacks,
    });
    const seatSource = createFibSeatDataSource({
      state,
      revision: 1,
      myUserId: 'host',
      controlledSeat: null,
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
    const playerActions = {
      message: null,
      progress: null,
      actions: [],
      group: null,
    };
    const connection = {
      status: { kind: 'live' as const },
      pendingDurableCount: 0,
      onRetryNow: vi.fn(),
    };
    const onBack = vi.fn();
    const onSeatPress = vi.fn();
    const model = createFibRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'host', isHost: true, seat: 0 },
      capabilities,
      onBack,
      onTitlePress: vi.fn(),
      onTitleLongPress: vi.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: { normalDraws: 3, goldenDraws: 2 },
      onUserActionPress: vi.fn(),
      connection,
      state,
      seatSource,
      seatsVisuallyDisabled: true,
      onSeatPress,
      onBotSeatLongPress: null,
      seatConfirmation: null,
      profile: null,
      share,
      playerActions,
      buildHostManagement: () => null,
      controlledSeat: null,
    });
    expect(model.roomCode).toBe('1234');
    expect(model.capabilities).toBe(capabilities);
    expect(model.header.onBack).toBe(onBack);
    expect(model.header.userAction?.ticketCount).toBe(5);
    expect(model.connection).toBe(connection);
    expect(model.seats).toEqual({
      source: seatSource,
      visuallyDisabled: true,
      onSeatPress,
      onBotSeatLongPress: null,
    });
    expect(model.share).toBe(share);
    expect(model.playerActions).toBe(playerActions);
    expect(model.hostManagement).toBeNull();
    expect(model.controlledSeat).toBeNull();
    // The shell phase anchor carries the FibState phase verbatim.
    expect(model.phase).toBe('lobby');
  });

  it('exposes the ongoing phase on the shell model', () => {
    const state = createOngoing();
    const model = createFibRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'host', isHost: true, seat: 0 },
      capabilities: createFibRoomCapabilities({ state, isHost: true, mySeat: null, ...callbacks }),
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
      seatSource: createFibSeatDataSource({
        state,
        revision: 1,
        myUserId: 'host',
        controlledSeat: null,
      }),
      seatsVisuallyDisabled: false,
      onSeatPress: vi.fn(),
      onBotSeatLongPress: null,
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
      playerActions: {
        message: null,
        progress: null,
        actions: [],
        group: null,
      },
      buildHostManagement: () => null,
      controlledSeat: null,
    });
    expect(model.phase).toBe('ongoing');
  });
});
