/**
 * useGameActions — unit tests for game control & player night actions hook.
 *
 * Verifies facade delegation, non-host guards, notifyIfFailed alerting,
 * and derived state queries (getLastNightInfo, hasWolfVoted).
 */

import { act, renderHook } from '@testing-library/react-native';

import type { BgmControlState } from '@/hooks/useBgmControl';
import type { DebugModeState } from '@/hooks/useDebugMode';
import { useGameActions } from '@/hooks/useGameActions';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { LocalGameState } from '@/types/GameStateTypes';

// Mock showAlert
const mockShowAlert = jest.fn<void, [string, string]>();
jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: (...args: unknown[]) => mockShowAlert(...(args as [string, string])),
}));

// Toast is mapped via moduleNameMapper → __mocks__/sonner-native.ts
import { toast } from 'sonner-native';

// ---- Factory helpers ----

type MutationResult = { success: boolean; reason?: string };

type MockFacade = {
  [K in keyof IGameFacade]: jest.Mock;
};

function createMockFacade(overrides: Partial<MockFacade> = {}): MockFacade {
  return {
    isHostPlayer: jest.fn(() => true),
    updateTemplate: jest
      .fn<Promise<MutationResult>, [unknown]>()
      .mockResolvedValue({ success: true }),
    assignRoles: jest.fn<Promise<MutationResult>, []>().mockResolvedValue({ success: true }),
    startNight: jest.fn<Promise<MutationResult>, []>().mockResolvedValue({ success: true }),
    restartGame: jest.fn<Promise<MutationResult>, []>().mockResolvedValue({ success: true }),
    clearAllSeats: jest.fn<Promise<MutationResult>, []>().mockResolvedValue({ success: true }),
    shareNightReview: jest
      .fn<Promise<MutationResult>, [number[]]>()
      .mockResolvedValue({ success: true }),
    setAudioPlaying: jest
      .fn<Promise<MutationResult>, [boolean]>()
      .mockResolvedValue({ success: true }),
    markViewedRole: jest
      .fn<Promise<MutationResult>, [number]>()
      .mockResolvedValue({ success: true }),
    submitAction: jest
      .fn<Promise<MutationResult>, [number, string, number | null, unknown]>()
      .mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn<Promise<MutationResult>, []>().mockResolvedValue({ success: true }),
    sendWolfRobotHunterStatusViewed: jest
      .fn<Promise<MutationResult>, [number]>()
      .mockResolvedValue({ success: true }),
    postProgression: jest.fn<Promise<MutationResult>, []>().mockResolvedValue({ success: true }),
    ...overrides,
  } as MockFacade;
}

function createMockBgm(): Pick<BgmControlState, 'startBgmIfEnabled' | 'stopBgm'> {
  return { startBgmIfEnabled: jest.fn(), stopBgm: jest.fn() };
}

interface MockDebugOverrides {
  controlledSeat?: number | null;
  effectiveSeat?: number | null;
  effectiveRole?: string | null;
  setControlledSeat?: jest.Mock;
}

function createMockDebug(
  overrides: MockDebugOverrides = {},
): Pick<
  DebugModeState,
  'controlledSeat' | 'effectiveSeat' | 'effectiveRole' | 'setControlledSeat'
> {
  return {
    controlledSeat: null,
    effectiveSeat: 1,
    effectiveRole: 'wolf',
    setControlledSeat: jest.fn(),
    ...overrides,
  } as Pick<
    DebugModeState,
    'controlledSeat' | 'effectiveSeat' | 'effectiveRole' | 'setControlledSeat'
  >;
}

type GameActionsDeps = Parameters<typeof useGameActions>[0];

interface MockDepsOverrides {
  facade?: MockFacade;
  bgm?: Pick<BgmControlState, 'startBgmIfEnabled' | 'stopBgm'>;
  debug?: Pick<
    DebugModeState,
    'controlledSeat' | 'effectiveSeat' | 'effectiveRole' | 'setControlledSeat'
  >;
  mySeat?: number | null;
  gameState?: Partial<LocalGameState> | null;
}

function createDeps(overrides: MockDepsOverrides = {}): GameActionsDeps {
  const { gameState, ...rest } = overrides;
  return {
    facade: createMockFacade(),
    bgm: createMockBgm(),
    debug: createMockDebug(),
    mySeat: 1,
    gameState: null,
    ...rest,
    ...(gameState !== undefined && { gameState: gameState as LocalGameState | null }),
  } as unknown as GameActionsDeps;
}

// ---- Tests ----

describe('useGameActions - game control', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updateTemplate should call facade.updateTemplate', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.updateTemplate({ name: '', numberOfPlayers: 0, roles: [] }));

    expect(deps.facade.updateTemplate).toHaveBeenCalledWith({
      name: '',
      numberOfPlayers: 0,
      roles: [],
    });
  });

  it('updateTemplate should skip when not host', async () => {
    const deps = createDeps({ facade: createMockFacade({ isHostPlayer: jest.fn(() => false) }) });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.updateTemplate({ name: '', numberOfPlayers: 0, roles: [] }));

    expect(deps.facade.updateTemplate).not.toHaveBeenCalled();
  });

  it('assignRoles should call facade and toast on failure', async () => {
    const facade = createMockFacade({
      assignRoles: jest.fn().mockResolvedValue({ success: false, reason: 'role_count_mismatch' }),
    });
    const deps = createDeps({ facade });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.assignRoles());

    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('分配角色失败', {
      description: '角色数量与座位数不匹配',
    });
  });

  it('assignRoles should NOT alert on success', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.assignRoles());

    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('startGame should call facade.startNight (BGM driven by gameStatus effect)', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.startGame());

    expect(deps.facade.startNight).toHaveBeenCalled();
    // BGM is no longer started imperatively here — useBgmControl's reactive
    // effect starts BGM when gameStatus transitions to Ongoing.
    expect(deps.bgm.startBgmIfEnabled).not.toHaveBeenCalled();
  });

  it('restartGame should stop BGM, clear debug seat, and call facade', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.restartGame());

    expect(deps.bgm.stopBgm).toHaveBeenCalled();
    expect(deps.debug.setControlledSeat).toHaveBeenCalledWith(null);
    expect(deps.facade.restartGame).toHaveBeenCalled();
  });

  it('clearAllSeats should call facade', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.clearAllSeats());

    expect(deps.facade.clearAllSeats).toHaveBeenCalled();
  });

  it('shareNightReview should call facade with allowedSeats', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.shareNightReview([1, 3, 5]));

    expect(deps.facade.shareNightReview).toHaveBeenCalledWith([1, 3, 5]);
  });

  it('setAudioPlaying should return host_only reason when not host', async () => {
    const deps = createDeps({ facade: createMockFacade({ isHostPlayer: jest.fn(() => false) }) });
    const { result } = renderHook(() => useGameActions(deps));

    let res: { success: boolean; reason?: string } | undefined;
    await act(async () => {
      res = await result.current.setAudioPlaying(true);
    });

    expect(res).toEqual({ success: false, reason: 'host_only' });
    expect(deps.facade.setAudioPlaying).not.toHaveBeenCalled();
  });

  it('postProgression should return true on success for host', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.postProgression();
    });

    expect(deps.facade.postProgression).toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  it('postProgression should return false on failure for host', async () => {
    const deps = createDeps({
      facade: createMockFacade({
        postProgression: jest.fn().mockResolvedValue({ success: false, reason: 'NETWORK_ERROR' }),
      }),
    });
    const { result } = renderHook(() => useGameActions(deps));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.postProgression();
    });

    expect(deps.facade.postProgression).toHaveBeenCalled();
    expect(ok).toBe(false);
  });

  it('postProgression should return false for non-host', async () => {
    const deps = createDeps({ facade: createMockFacade({ isHostPlayer: jest.fn(() => false) }) });
    const { result } = renderHook(() => useGameActions(deps));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.postProgression();
    });

    expect(deps.facade.postProgression).not.toHaveBeenCalled();
    expect(ok).toBe(false);
  });
});

describe('useGameActions - player night actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('viewedRole should use mySeat when no controlled seat', async () => {
    const deps = createDeps({ mySeat: 3 });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.viewedRole());

    expect(deps.facade.markViewedRole).toHaveBeenCalledWith(3);
  });

  it('viewedRole should use debug.controlledSeat when set', async () => {
    const deps = createDeps({ debug: createMockDebug({ controlledSeat: 5 }) });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.viewedRole());

    expect(deps.facade.markViewedRole).toHaveBeenCalledWith(5);
  });

  it('viewedRole should skip when both seats are null', async () => {
    const deps = createDeps({
      mySeat: null,
      debug: createMockDebug({ controlledSeat: null }),
    });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.viewedRole());

    expect(deps.facade.markViewedRole).not.toHaveBeenCalled();
  });

  it('submitAction should use effectiveSeat and effectiveRole', async () => {
    const deps = createDeps({
      debug: createMockDebug({ effectiveSeat: 2, effectiveRole: 'seer' }),
    });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitAction(4));

    expect(deps.facade.submitAction).toHaveBeenCalledWith(2, 'seer', 4, undefined);
  });

  it('submitAction should skip when effectiveSeat is null', async () => {
    const deps = createDeps({ debug: createMockDebug({ effectiveSeat: null }) });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitAction(4));

    expect(deps.facade.submitAction).not.toHaveBeenCalled();
  });

  it('submitRevealAck should call facade', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitRevealAck());

    expect(deps.facade.submitRevealAck).toHaveBeenCalled();
  });

  it('sendWolfRobotHunterStatusViewed should call facade with seat', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.sendWolfRobotHunterStatusViewed(7));

    expect(deps.facade.sendWolfRobotHunterStatusViewed).toHaveBeenCalledWith(7);
  });
});

describe('useGameActions - game state queries', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getLastNightInfo should return "无信息" when no gameState', () => {
    const deps = createDeps({ gameState: null });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('无信息');
  });

  it('getLastNightInfo should return "昨夜平安夜" when no deaths', () => {
    const deps = createDeps({
      gameState: { lastNightDeaths: [], wolfVotes: new Map(), currentNightResults: {} },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜');
  });

  it('getLastNightInfo should return "昨夜平安夜" when lastNightDeaths is null/undefined', () => {
    // Testing runtime defensive behavior: lastNightDeaths can be null from legacy state
    const deps = createDeps({
      gameState: {
        lastNightDeaths: null as unknown as number[],
        wolfVotes: new Map(),
        currentNightResults: {},
      },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜');
  });

  it('getLastNightInfo should format death list (0-indexed → 1-indexed)', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [0, 2, 5],
        wolfVotes: new Map(),
        currentNightResults: {},
      },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜死亡: 1号, 3号, 6号');
  });

  it('getLastNightInfo should include silencedSeat info', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [],
        wolfVotes: new Map(),
        currentNightResults: { silencedSeat: 2 },
      },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜\n3号被禁言');
  });

  it('getLastNightInfo should include votebannedSeat info', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [],
        wolfVotes: new Map(),
        currentNightResults: { votebannedSeat: 4 },
      },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜\n5号被禁票');
  });

  it('getLastNightInfo should include both silence and voteban with deaths', () => {
    const deps = createDeps({
      gameState: {
        lastNightDeaths: [0],
        wolfVotes: new Map(),
        currentNightResults: { silencedSeat: 1, votebannedSeat: 3 },
      },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜死亡: 1号\n2号被禁言\n4号被禁票');
  });

  it('hasWolfVoted should return false when no gameState', () => {
    const deps = createDeps({ gameState: null });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.hasWolfVoted(1)).toBe(false);
  });

  it('hasWolfVoted should check wolfVotes map', () => {
    const wolfVotes = new Map([[3, 5]]);
    const deps = createDeps({
      gameState: { lastNightDeaths: [], wolfVotes, currentNightResults: {} },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.hasWolfVoted(3)).toBe(true);
    expect(result.current.hasWolfVoted(1)).toBe(false);
  });
});

describe('useGameActions - handleMutationResult', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should toast with default reason when reason is missing (toastError callback)', async () => {
    const facade = createMockFacade({
      clearAllSeats: jest.fn().mockResolvedValue({ success: false }),
    });
    const deps = createDeps({ facade });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.clearAllSeats());

    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('全员起立失败', {
      description: '请稍后重试',
    });
  });

  it('should alert on NETWORK_ERROR even without onBusinessError callback', async () => {
    const facade = createMockFacade({
      submitAction: jest.fn().mockResolvedValue({ success: false, reason: 'NETWORK_ERROR' }),
    });
    const deps = createDeps({
      facade,
      debug: createMockDebug({ effectiveSeat: 1, effectiveRole: 'wolf' }),
    });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitAction(2));

    expect(mockShowAlert).toHaveBeenCalledWith('提交行动失败', '网络异常，请检查网络后重试');
  });

  it('should alert on SERVER_ERROR even without onBusinessError callback', async () => {
    const facade = createMockFacade({
      submitAction: jest.fn().mockResolvedValue({ success: false, reason: 'SERVER_ERROR' }),
    });
    const deps = createDeps({
      facade,
      debug: createMockDebug({ effectiveSeat: 1, effectiveRole: 'wolf' }),
    });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitAction(2));

    expect(mockShowAlert).toHaveBeenCalledWith('提交行动失败', '服务暂时不可用，请稍后重试');
  });

  it('should NOT alert on business rejection without onBusinessError callback', async () => {
    const facade = createMockFacade({
      submitAction: jest.fn().mockResolvedValue({ success: false, reason: 'invalid_action' }),
    });
    const deps = createDeps({
      facade,
      debug: createMockDebug({ effectiveSeat: 1, effectiveRole: 'wolf' }),
    });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitAction(2));

    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('should show toast on business rejection with toastError callback (submitRevealAck)', async () => {
    const facade = createMockFacade({
      submitRevealAck: jest
        .fn()
        .mockResolvedValue({ success: false, reason: 'forbidden_while_audio_playing' }),
    });
    const deps = createDeps({ facade });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitRevealAck());

    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('确认揭示失败', {
      description: '请等待语音播放完毕',
    });
  });

  it('should alert on NETWORK_ERROR even with toastError callback', async () => {
    const facade = createMockFacade({
      submitRevealAck: jest.fn().mockResolvedValue({ success: false, reason: 'NETWORK_ERROR' }),
    });
    const deps = createDeps({ facade });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitRevealAck());

    expect(mockShowAlert).toHaveBeenCalledWith('确认揭示失败', '网络异常，请检查网络后重试');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
