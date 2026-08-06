import {
  FIB_PREPARATION_STAGES,
  FIB_STATE_VERSION,
  type FibState,
} from '@game-judge/game-engine/games/fibking/public';

import {
  createFibBottomActions,
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
      catalogEntryId: 'fib-0001',
      catalogVersion: 1,
      word: '山谷',
      definition: {
        coreMeaning: '两山之间低洼狭长的地带。',
        usageNote: '常用于描述由地形围合形成的狭长低地。',
      },
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

  it('uses next round as the sole ended host progression action', () => {
    const ongoing = createOngoing();
    const ended = { ...ongoing, phase: 'ended' as const };
    const actions = createFibBottomActions({
      state: ended,
      isHost: true,
      hasPerspective: true,
      startRound: jest.fn(),
      cancelPreparing: jest.fn(),
      revealRound: jest.fn(),
      openIdentity: jest.fn(),
      configureGame: jest.fn(),
      onStartDisabled: jest.fn(),
    });

    expect(actions.layout.primary).toMatchObject([
      { label: '下一轮', testID: TESTIDS.fibNextRoundButton, isEnabled: true },
    ]);
    expect(actions.layout.secondary).toMatchObject([
      { label: '查看结果', testID: TESTIDS.fibViewResultButton, isEnabled: true },
    ]);
    expect(JSON.stringify(actions)).not.toContain('重新开始');
    expect(createFibStatusRibbon(ended)).toMatchObject({ text: '本轮答案已公布' });
  });

  it('derives the complete host bottom-action matrix from Fib phases', () => {
    const startRound = jest.fn();
    const cancelPreparing = jest.fn();
    const revealRound = jest.fn();
    const openIdentity = jest.fn();
    const configureGame = jest.fn();
    const onStartDisabled = jest.fn();
    const common = {
      isHost: true,
      hasPerspective: true,
      startRound,
      cancelPreparing,
      revealRound,
      openIdentity,
      configureGame,
      onStartDisabled,
    };

    const lobby = createFibBottomActions({ state: createLobby(), ...common });
    expect(lobby.layout.primary).toMatchObject([
      {
        label: '开始本轮',
        testID: TESTIDS.fibStartRoundButton,
        isEnabled: false,
        disabledReason: '座位尚未坐满',
      },
    ]);
    expect(lobby.layout.ghost).toMatchObject([
      { label: '房间设置', testID: TESTIDS.fibConfigureButton, isEnabled: true },
    ]);

    const ongoing = createOngoing();
    const preparing: FibState = {
      ...createLobby(4),
      phase: 'preparing',
      fillEmptySeatsWithBots: true,
      pendingRound: {
        roundId: 'round-1',
        requestedAt: 1,
        stage: FIB_PREPARATION_STAGES.queued,
      },
      preparationFailure: null,
      round: null,
    };
    const preparingActions = createFibBottomActions({ state: preparing, ...common });
    expect(preparingActions.layout.ghost).toMatchObject([
      {
        label: '取消准备',
        testID: TESTIDS.fibCancelPreparingButton,
        isEnabled: true,
      },
    ]);
    expect(createFibStatusRibbon(preparing)).toMatchObject({ text: '词语任务已排队' });
    expect(
      createFibStatusRibbon({
        ...preparing,
        pendingRound: {
          ...preparing.pendingRound,
          stage: FIB_PREPARATION_STAGES.selectingWord,
        },
      }),
    ).toMatchObject({ text: '正在选择本轮词语' });

    const preparationFailed: FibState = {
      ...createLobby(4),
      phase: 'preparationFailed',
      fillEmptySeatsWithBots: true,
      pendingRound: null,
      preparationFailure: {
        roundId: 'round-1',
        requestedAt: 1,
        failedAt: 2,
        failureCode: 'unexpected-error',
      },
      round: null,
    };
    const failedActions = createFibBottomActions({ state: preparationFailed, ...common });
    expect(failedActions.layout.primary).toMatchObject([
      {
        label: '重新准备',
        testID: TESTIDS.fibStartRoundButton,
        isEnabled: true,
      },
    ]);
    expect(failedActions.layout.ghost).toMatchObject([
      {
        label: '返回大厅',
        testID: TESTIDS.fibCancelPreparingButton,
        isEnabled: true,
      },
    ]);
    expect(createFibStatusRibbon(preparationFailed)).toMatchObject({
      text: '词语准备失败：词语准备出现异常',
    });

    const ongoingActions = createFibBottomActions({ state: ongoing, ...common });
    expect(ongoingActions.layout.primary).toMatchObject([
      {
        label: '公布答案',
        testID: TESTIDS.fibRevealRoundButton,
        isEnabled: true,
      },
    ]);
    expect(ongoingActions.layout.secondary).toMatchObject([
      {
        label: '查看身份',
        testID: TESTIDS.fibViewIdentityButton,
        isEnabled: true,
      },
    ]);
  });

  it('does not expose host progression actions to a non-host', () => {
    const callbacks = {
      startRound: jest.fn(),
      cancelPreparing: jest.fn(),
      revealRound: jest.fn(),
      openIdentity: jest.fn(),
      configureGame: jest.fn(),
      onStartDisabled: jest.fn(),
    };

    const lobby = createFibBottomActions({
      state: createLobby(),
      isHost: false,
      hasPerspective: false,
      ...callbacks,
    });
    expect(lobby.layout).toEqual({ primary: [], secondary: [], ghost: [] });
    expect(lobby.message).toBe('等待房主开始本轮');

    const ongoing = createFibBottomActions({
      state: createOngoing(),
      isHost: false,
      hasPerspective: true,
      ...callbacks,
    });
    expect(ongoing.layout.primary).toEqual([]);
    expect(ongoing.layout.secondary).toMatchObject([
      {
        label: '查看身份',
        testID: TESTIDS.fibViewIdentityButton,
        isEnabled: true,
      },
    ]);
  });
});
