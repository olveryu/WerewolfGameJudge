import { FIB_STATE_VERSION, type FibState } from '@game-judge/game-engine/games/fibking/public';

import {
  createFibBottomActions,
  createFibHostManagement,
  createFibRoomCapabilities,
  createFibSeatDataSource,
  createFibStatusRibbon,
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
    realSeats: {
      0: {
        userId: 'host',
        seat: 0,
        profile: { displayName: '房主' },
      },
    },
    fillEmptySeatsWithBots: false,
    excludedBotSeats: [],
    usedWords: [],
    pendingRound: null,
    preparationFailure: null,
    round: null,
  };
}

function createOngoing(): Extract<FibState, { phase: 'ongoing' }> {
  return {
    ...createLobby(4),
    phase: 'ongoing',
    fillEmptySeatsWithBots: true,
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
    },
  };
}

describe('FibKing room adapter', () => {
  beforeEach(() => jest.clearAllMocks());

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
    expect(capabilities.canTakeOverBots.isAllowed).toBe(false);
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

  it('projects sparse human seats and implicit bots without materializing the configured count', () => {
    const state = {
      ...createLobby(Number.MAX_SAFE_INTEGER),
      fillEmptySeatsWithBots: true,
    } satisfies FibState;
    const source = createFibSeatDataSource({
      state,
      revision: 7,
      myUserId: 'host',
      controlledSeat: Number.MAX_SAFE_INTEGER - 1,
    });

    expect(source.count).toBe(Number.MAX_SAFE_INTEGER);
    expect(source.getSeat(0)).toMatchObject({
      player: { kind: 'human', userId: 'host' },
      isSelf: true,
    });
    expect(source.getSeat(Number.MAX_SAFE_INTEGER - 1)).toMatchObject({
      player: { kind: 'bot' },
      highlight: 'controlled',
    });
    expect(Object.keys(state.realSeats)).toEqual(['0']);
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

  it('represents implicit bots as the same shared profile target kind used by the room shell', () => {
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

  it('projects an explicitly kicked bot seat as empty without changing other implicit bots', () => {
    const state = {
      ...createLobby(4),
      fillEmptySeatsWithBots: true,
      excludedBotSeats: [2],
    } satisfies FibState;
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

  it('routes an implicit lobby bot through the shared profile intent before replacement', () => {
    const lobby = { ...createLobby(4), fillEmptySeatsWithBots: true } satisfies FibState;

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
    expect(createFibStatusRibbon(ended)).toMatchObject({ text: '本轮答案已公布' });
  });

  it('derives discoverable Host management tasks from Fib phases', () => {
    const startRound = jest.fn();
    const revealRound = jest.fn();
    const endGame = jest.fn();
    const onStartDisabled = jest.fn();
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
      cancelPreparing: jest.fn(),
      revealRound,
      endGame,
      onStartDisabled,
    });

    expect(lobbyManagement?.preview).toBe('下一步：开始本轮');
    expect(lobbyManagement?.sections.flatMap((section) => section.actions)).toMatchObject([
      { label: '开始本轮', isEnabled: false, disabledReason: '座位尚未坐满' },
      { label: '房间设置', isEnabled: true },
      { label: '填充机器人', isEnabled: true },
      { label: '清空座位', isEnabled: true },
    ]);
    const startAction = lobbyManagement?.sections[0]?.actions[0];
    if (startAction?.isEnabled !== false || startAction.onDisabledPress === null) {
      throw new Error('Expected disabled Fib start feedback');
    }
    startAction.onDisabledPress();
    expect(onStartDisabled).toHaveBeenCalledTimes(1);

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
      cancelPreparing: jest.fn(),
      revealRound,
      endGame,
      onStartDisabled,
    });
    expect(ongoingManagement?.preview).toBe('待处理：公布答案');
    const revealAction = ongoingManagement?.sections[0]?.actions[0];
    if (revealAction?.isEnabled !== true) throw new Error('Expected enabled reveal action');
    revealAction.onPress();
    expect(revealRound).toHaveBeenCalledTimes(1);

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
      cancelPreparing: jest.fn(),
      revealRound,
      endGame,
      onStartDisabled,
    });
    expect(endedManagement?.preview).toBe('下一步：下一轮');
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
    expect(ongoingActions.layout.secondary).toMatchObject([
      {
        label: '查看身份',
        testID: TESTIDS.fibViewIdentityButton,
        isEnabled: true,
      },
    ]);
    const identityAction = ongoingActions.layout.secondary[0];
    if (identityAction?.isEnabled !== true) throw new Error('Expected enabled identity action');
    identityAction.onPress();
    expect(openIdentity).toHaveBeenCalledTimes(1);
  });

  it('offers recovery actions after preparation fails', () => {
    const startRound = jest.fn();
    const cancelPreparing = jest.fn();
    const failed: FibState = {
      ...createLobby(4),
      phase: 'preparationFailed',
      fillEmptySeatsWithBots: true,
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
      cancelPreparing,
      endGame: jest.fn(),
      revealRound: jest.fn(),
      onStartDisabled: jest.fn(),
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
    expect(createFibStatusRibbon(failed)).toMatchObject({
      text: '词语准备失败',
      supportingText: '暂无可用词语，请重新准备',
    });

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
    expect(lobby.message).toBe('等待房主开始本轮');

    const ongoingPlayer = createFibBottomActions({
      state: createOngoing(),
      isHost: false,
      viewerSeat: 0,
      openIdentity,
    });
    expect(ongoingPlayer.layout.primary).toEqual([]);
    expect(ongoingPlayer.layout.secondary).toMatchObject([
      {
        label: '查看身份',
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
    expect(ongoingSpectator.layout.secondary).toMatchObject([
      {
        label: '查看题目',
        testID: TESTIDS.fibViewIdentityButton,
        isEnabled: true,
      },
    ]);
  });
});
