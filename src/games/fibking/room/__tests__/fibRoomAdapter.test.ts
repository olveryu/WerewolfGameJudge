import {
  FIB_MAX_PLAYERS,
  FIB_STATE_VERSION,
  type FibState,
} from '@game-judge/game-engine/games/fibking/public';

import { resolveHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
import {
  createFibBoardInfoSections,
  createFibBottomActions,
  createFibHostManagement,
  createFibRoomCapabilities,
  createFibRoomShellModel,
  createFibSeatDataSource,
  getFibProfileTarget,
  getFibSeatTapIntent,
} from '@/games/fibking/room/fibRoomAdapter';
import { TESTIDS } from '@/testids';

const callbacks = {
  requestTakeSeat: jest.fn(),
  requestMoveSeat: jest.fn(),
  leaveSeat: jest.fn(),
  kickSeat: jest.fn(),
  clearSeats: jest.fn(),
  fillBots: jest.fn(),
  configureGame: jest.fn(),
  openProfile: jest.fn(),
  takeOverBot: jest.fn(),
  shareRoom: jest.fn(),
};

function createLobby(numberOfPlayers = 8): Extract<FibState, { phase: 'lobby' }> {
  return {
    gameType: 'fibking',
    stateVersion: FIB_STATE_VERSION,
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
  beforeEach(() => jest.clearAllMocks());

  it('gates begin on the viewing checkpoint and offers the scaffold while bots are unmarked', () => {
    const markAllBotsViewed = jest.fn();
    const build = (state: FibState) =>
      createFibHostManagement({
        state,
        isHost: true,
        isCommandSubmitting: false,
        capabilities: createFibRoomCapabilities({
          state,
          isHost: true,
          mySeat: 0,
          ...callbacks,
        }),
        startRound: jest.fn(),
        markAllBotsViewed,
        beginRound: jest.fn(),
        isGuessing: false,
        toggleGuessMode: jest.fn(),
        cancelPreparing: jest.fn(),
        revealRound: jest.fn(),
        redrawRound: jest.fn(),
        abandonGame: jest.fn(),
        endGame: jest.fn(),
      });
    const flowActions = (state: FibState) =>
      build(state)?.sections.find((section) => section.key === 'current-flow')?.actions ?? [];

    const pending = flowActions(createViewing([0]));
    expect(pending.map((action) => action.key)).toEqual(['start-game', 'mark-bots-viewed']);
    expect(pending[0]).toEqual(
      expect.objectContaining({
        label: '开始游戏',
        isEnabled: false,
        disabledReason: '还有玩家未查看身份',
      }),
    );
    expect(pending[1]).toEqual(expect.objectContaining({ label: '标记机器人已查看' }));

    const ready = flowActions(createViewing([0, 1, 2, 3]));
    expect(ready.map((action) => action.key)).toEqual(['start-game']);
    expect(ready[0]).toEqual(expect.objectContaining({ label: '开始游戏', isEnabled: true }));
  });

  it('locks host actions while a command is submitting', () => {
    const build = (state: FibState) =>
      createFibHostManagement({
        state,
        isHost: true,
        isCommandSubmitting: true,
        capabilities: createFibRoomCapabilities({
          state,
          isHost: true,
          mySeat: 0,
          ...callbacks,
        }),
        startRound: jest.fn(),
        markAllBotsViewed: jest.fn(),
        beginRound: jest.fn(),
        isGuessing: false,
        toggleGuessMode: jest.fn(),
        cancelPreparing: jest.fn(),
        revealRound: jest.fn(),
        redrawRound: jest.fn(),
        abandonGame: jest.fn(),
        endGame: jest.fn(),
      });

    // Full lobby: the start action is lock-disabled with no reason and
    // a loading state (the room IS full — the lock blocks it, not seats).
    const fullLobby = withBotSeats(createLobby(4), [1, 2, 3]);
    const lobbyStart = build(fullLobby)?.sections.find((section) => section.key === 'current-flow')
      ?.actions[0];
    expect(lobbyStart).toMatchObject({
      label: '开始本轮',
      isEnabled: false,
      disabledReason: null,
      isLoading: true,
    });
    expect(lobbyStart).not.toHaveProperty('onPress');

    // Ongoing: every pending-aware flow/danger action drops its handler.
    const ongoingActions =
      build(createOngoing())?.sections.flatMap((section) => section.actions) ?? [];
    expect(ongoingActions.map((action) => action.key)).toEqual([
      'guess-seat',
      'reveal-round',
      'redraw-round',
      'abandon-game',
    ]);
    for (const action of ongoingActions) {
      expect(action).toMatchObject({ isEnabled: false, disabledReason: null });
      expect(action).not.toHaveProperty('onPress');
    }
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
      player: { kind: 'human', userId: 'host' },
      isSelf: true,
    });
    expect(source.getSeat(FIB_MAX_PLAYERS - 1)).toMatchObject({
      player: { kind: 'bot' },
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
      userId: 'host',
      occupantKind: 'human',
      rosterName: '房主',
    });
    expect(getFibProfileTarget(ongoing, 3)).toEqual({
      seat: 3,
      userId: 'fib-bot:4321:3',
      occupantKind: 'bot',
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
    expect(source.getSeat(3).player).toMatchObject({ kind: 'bot' });
  });

  it('routes a lobby bot seat through the shared profile intent', () => {
    const lobby = withBotSeats(createLobby(4), [1, 2, 3]) satisfies FibState;

    expect(getFibSeatTapIntent({ state: lobby, seat: 2, currentSeat: null })).toEqual({
      kind: 'profile',
      target: {
        seat: 2,
        userId: 'fib-bot:4321:2',
        occupantKind: 'bot',
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

  it('keeps the personal result action after the answer is revealed', () => {
    const ongoing = createOngoing();
    const ended = { ...ongoing, phase: 'ended' as const };
    const actions = createFibBottomActions({
      state: ended,
      isHost: true,
      viewerSeat: null,
      openIdentity: jest.fn(),
    });

    expect(actions.layout.primary).toEqual([]);
    expect(actions.layout.secondary).toMatchObject([
      { label: '查看结果', testID: TESTIDS.fibViewResultButton, isEnabled: true },
    ]);
    expect(actions.layout.ghost).toEqual([]);
  });

  it('derives discoverable Host management tasks from Fib phases', () => {
    const startRound = jest.fn();
    const revealRound = jest.fn();
    const redrawRound = jest.fn();
    const abandonGame = jest.fn();
    const endGame = jest.fn();
    const lobby = createLobby();
    const lobbyCapabilities = createFibRoomCapabilities({
      state: lobby,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const lobbyManagement = createFibHostManagement({
      state: lobby,
      isHost: true,
      isCommandSubmitting: false,
      capabilities: lobbyCapabilities,
      startRound,
      markAllBotsViewed: jest.fn(),
      beginRound: jest.fn(),
      isGuessing: false,
      toggleGuessMode: jest.fn(),
      cancelPreparing: jest.fn(),
      revealRound,
      redrawRound,
      abandonGame,
      endGame,
    });

    expect(lobbyManagement?.sections.flatMap((section) => section.actions)).toMatchObject([
      { label: '开始本轮', isEnabled: false, disabledReason: '座位尚未坐满（还差 7 人）' },
      { label: '房间设置', isEnabled: true },
      { label: '填充机器人', isEnabled: true },
      { label: '清空座位', isEnabled: true },
    ]);
    const startAction = lobbyManagement?.sections[0]?.actions[0];
    if (startAction?.isEnabled !== false) throw new Error('Expected a disabled Fib start');
    expect(startAction).not.toHaveProperty('onPress');
    expect(startAction.isPrimary).toBe(true);

    const ongoing = createOngoing();
    const ongoingCapabilities = createFibRoomCapabilities({
      state: ongoing,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const ongoingManagement = createFibHostManagement({
      state: ongoing,
      isHost: true,
      isCommandSubmitting: false,
      capabilities: ongoingCapabilities,
      startRound,
      markAllBotsViewed: jest.fn(),
      beginRound: jest.fn(),
      isGuessing: false,
      toggleGuessMode: jest.fn(),
      cancelPreparing: jest.fn(),
      revealRound,
      redrawRound,
      abandonGame,
      endGame,
    });
    expect(ongoingManagement?.sections.map((section) => section.title)).toEqual([
      '当前流程',
      '危险操作',
    ]);
    const ongoingActions = ongoingManagement?.sections.flatMap((section) => section.actions);
    expect(ongoingActions).toMatchObject([
      { label: '大聪明选人', isEnabled: true },
      { label: '公布答案', isEnabled: true },
      { label: '重新抽词', isEnabled: true },
      { label: '放弃游戏', isEnabled: true },
    ]);
    const revealAction = ongoingActions?.[1];
    const redrawAction = ongoingActions?.[2];
    const abandonAction = ongoingActions?.[3];
    if (
      revealAction?.isEnabled !== true ||
      redrawAction?.isEnabled !== true ||
      abandonAction?.isEnabled !== true
    ) {
      throw new Error('Expected enabled ongoing Fib Host actions');
    }
    revealAction.onPress();
    redrawAction.onPress();
    abandonAction.onPress();
    expect(revealRound).toHaveBeenCalledTimes(1);
    expect(redrawRound).toHaveBeenCalledTimes(1);
    expect(abandonGame).toHaveBeenCalledTimes(1);

    const ended = { ...ongoing, phase: 'ended' as const };
    const endedCapabilities = createFibRoomCapabilities({
      state: ended,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const endedManagement = createFibHostManagement({
      state: ended,
      isHost: true,
      isCommandSubmitting: false,
      capabilities: endedCapabilities,
      startRound,
      markAllBotsViewed: jest.fn(),
      beginRound: jest.fn(),
      isGuessing: false,
      toggleGuessMode: jest.fn(),
      cancelPreparing: jest.fn(),
      revealRound,
      redrawRound,
      abandonGame,
      endGame,
    });
    expect(endedManagement?.sections.map((section) => section.title)).toEqual([
      '当前流程',
      '危险操作',
    ]);
    const endAction = endedManagement?.sections[1]?.actions[0];
    if (endAction?.isEnabled !== true) throw new Error('Expected enabled end-game action');
    endAction.onPress();
    expect(endGame).toHaveBeenCalledTimes(1);
  });

  it('keeps Fib bottom actions limited to the current player', () => {
    const openIdentity = jest.fn();
    const common = {
      isHost: true,
      viewerSeat: 0,
      openIdentity,
    };

    const lobby = createFibBottomActions({ state: createLobby(), ...common });
    expect(lobby.layout).toEqual({ primary: [], secondary: [], ghost: [] });

    const ongoing = createOngoing();
    const ongoingActions = createFibBottomActions({ state: ongoing, ...common });
    expect(ongoingActions.layout.primary).toEqual([]);
    expect(ongoingActions.layout.secondary).toEqual([]);
    // Tier contract: the persistent view-identity tool lives in the ghost tier.
    expect(ongoingActions.layout.ghost).toMatchObject([
      {
        label: '查看身份',
        variant: 'ghost',
        testID: TESTIDS.fibViewIdentityButton,
        isEnabled: true,
      },
    ]);
    const identityAction = ongoingActions.layout.ghost[0];
    if (identityAction?.isEnabled !== true) throw new Error('Expected enabled identity action');
    identityAction.onPress();
    expect(openIdentity).toHaveBeenCalledTimes(1);
  });

  it('offers recovery actions after preparation fails', () => {
    const startRound = jest.fn();
    const cancelPreparing = jest.fn();
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
      openIdentity: jest.fn(),
    };

    const capabilities = createFibRoomCapabilities({
      state: failed,
      isHost: true,
      mySeat: 0,
      ...callbacks,
    });
    const hostManagement = createFibHostManagement({
      state: failed,
      isHost: true,
      isCommandSubmitting: false,
      capabilities,
      startRound,
      markAllBotsViewed: jest.fn(),
      beginRound: jest.fn(),
      isGuessing: false,
      toggleGuessMode: jest.fn(),
      cancelPreparing,
      endGame: jest.fn(),
      revealRound: jest.fn(),
      redrawRound: jest.fn(),
      abandonGame: jest.fn(),
    });
    expect(hostManagement?.sections[0]?.actions).toMatchObject([
      { label: '重新准备', isEnabled: true },
      { label: '返回大厅', isEnabled: true },
    ]);
    const retryAction = hostManagement?.sections[0]?.actions[0];
    const returnLobbyAction = hostManagement?.sections[0]?.actions[1];
    if (retryAction?.isEnabled !== true || returnLobbyAction?.isEnabled !== true) {
      throw new Error('Expected enabled Fib preparation recovery actions');
    }
    retryAction.onPress();
    returnLobbyAction.onPress();
    expect(startRound).toHaveBeenCalledTimes(1);
    expect(cancelPreparing).toHaveBeenCalledTimes(1);

    const playerActions = createFibBottomActions({ state: failed, isHost: false, ...common });
    expect(playerActions.layout).toEqual({ primary: [], secondary: [], ghost: [] });
    expect(playerActions.message).toBe('词语准备失败，等待房主重新准备');
  });

  it('does not expose host progression actions to a non-host', () => {
    const openIdentity = jest.fn();

    const lobby = createFibBottomActions({
      state: createLobby(),
      isHost: false,
      viewerSeat: null,
      openIdentity,
    });
    expect(lobby.layout).toEqual({ primary: [], secondary: [], ghost: [] });
    expect(lobby.message).toBeNull();

    const ongoingPlayer = createFibBottomActions({
      state: createOngoing(),
      isHost: false,
      viewerSeat: 0,
      openIdentity,
    });
    expect(ongoingPlayer.layout.primary).toEqual([]);
    expect(ongoingPlayer.layout.secondary).toEqual([]);
    expect(ongoingPlayer.layout.ghost).toMatchObject([
      {
        label: '查看身份',
        variant: 'ghost',
        testID: TESTIDS.fibViewIdentityButton,
        isEnabled: true,
      },
    ]);

    const ongoingSpectator = createFibBottomActions({
      state: createOngoing(),
      isHost: false,
      viewerSeat: null,
      openIdentity,
    });
    expect(ongoingSpectator.layout.secondary).toEqual([]);
    expect(ongoingSpectator.layout.ghost).toMatchObject([
      {
        label: '查看题目',
        variant: 'ghost',
        testID: TESTIDS.fibViewIdentityButton,
        isEnabled: true,
      },
    ]);
  });
});

describe('createFibHostManagement console primary', () => {
  beforeEach(() => jest.clearAllMocks());

  const build = (state: FibState) =>
    createFibHostManagement({
      state,
      isHost: true,
      isCommandSubmitting: false,
      capabilities: createFibRoomCapabilities({ state, isHost: true, mySeat: 0, ...callbacks }),
      startRound: jest.fn(),
      markAllBotsViewed: jest.fn(),
      beginRound: jest.fn(),
      isGuessing: false,
      toggleGuessMode: jest.fn(),
      cancelPreparing: jest.fn(),
      revealRound: jest.fn(),
      redrawRound: jest.fn(),
      abandonGame: jest.fn(),
      endGame: jest.fn(),
    });

  it('blocks the round start in a non-full lobby and offers room sharing as the remedy', () => {
    const step = resolveHostConsolePrimary(build(createLobby(4))!);
    expect(step).toMatchObject({ actionKey: 'start-game', label: '开始本轮' });
    if (step?.kind !== 'blocked') throw new Error('expected a blocked console primary');
    expect(step.reason).toBe('座位尚未坐满（还差 3 人）');
    expect(step.remedy?.label).toBe('分享房间');
    step.remedy?.onPress();
    expect(callbacks.shareRoom).toHaveBeenCalledTimes(1);
  });

  it('offers the round start once every seat is taken', () => {
    const step = resolveHostConsolePrimary(build(withBotSeats(createLobby(4), [1, 2, 3]))!);
    expect(step).toMatchObject({ actionKey: 'start-game', label: '开始本轮' });
    if (step?.kind !== 'ready') throw new Error('expected a ready console primary');
  });

  it('blocks game start until every seat has viewed, then offers it', () => {
    const blocked = resolveHostConsolePrimary(build(createViewing([0]))!);
    expect(blocked).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
    if (blocked?.kind !== 'blocked') throw new Error('expected a blocked console primary');
    expect(blocked.reason).toBe('还有玩家未查看身份');
    expect(blocked.remedy).toBeNull();

    const ready = resolveHostConsolePrimary(build(createViewing([0, 1, 2, 3]))!);
    if (ready?.kind !== 'ready') throw new Error('expected a ready console primary');
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
    const step = resolveHostConsolePrimary(build(failed)!);
    expect(step).toMatchObject({ actionKey: 'retry-preparation', label: '重新准备' });
    if (step?.kind !== 'ready') throw new Error('expected a ready console primary');
  });

  it('has no console primary while a round is ongoing', () => {
    expect(resolveHostConsolePrimary(build(createOngoing())!)).toBeNull();
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
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    };
    const bottomActions = {
      kind: 'stacked' as const,
      message: null,
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    };
    const connection = {
      status: 'live' as const,
      pendingCommandCount: 0,
      onManualReconnect: jest.fn(),
    };
    const onBack = jest.fn();
    const onSeatPress = jest.fn();
    const model = createFibRoomShellModel({
      roomCode: '1234',
      capabilities,
      onBack,
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: { normalDraws: 3, goldenDraws: 2 },
      onUserActionPress: jest.fn(),
      connection,
      state,
      seatSource,
      seatsVisuallyDisabled: true,
      onSeatPress,
      onBotSeatLongPress: null,
      seatConfirmation: null,
      profile: null,
      share,
      bottomActions,
      hostManagement: null,
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
    expect(model.bottomActions).toBe(bottomActions);
    expect(model.hostManagement).toBeNull();
    expect(model.controlledSeat).toBeNull();
    // The shell phase anchor carries the FibState phase verbatim.
    expect(model.phase).toBe('lobby');
  });

  it('exposes the ongoing phase on the shell model', () => {
    const state = createOngoing();
    const model = createFibRoomShellModel({
      roomCode: '1234',
      capabilities: createFibRoomCapabilities({ state, isHost: true, mySeat: null, ...callbacks }),
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
      seatSource: createFibSeatDataSource({
        state,
        revision: 1,
        myUserId: 'host',
        controlledSeat: null,
      }),
      seatsVisuallyDisabled: false,
      onSeatPress: jest.fn(),
      onBotSeatLongPress: null,
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
      bottomActions: {
        kind: 'stacked' as const,
        message: null,
        progress: null,
        layout: { primary: [], secondary: [], ghost: [] },
      },
      hostManagement: null,
      controlledSeat: null,
    });
    expect(model.phase).toBe('ongoing');
  });
});
