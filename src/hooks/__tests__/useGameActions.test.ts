/**
 * useGameActions — unit tests for game control & player night actions hook.
 *
 * Verifies facade delegation, non-host guards, notifyIfFailed alerting,
 * and derived state queries (getLastNightInfo, hasWolfVoted).
 */

import { act, renderHook } from '@testing-library/react-native';

import { useGameActions } from '@/hooks/useGameActions';

// Mock showAlert
const mockShowAlert = jest.fn();
jest.mock('@/utils/alert', () => ({
  showAlert: (...args: unknown[]) => mockShowAlert(...args),
}));

// ---- Factory helpers ----

function createMockFacade(overrides: Record<string, unknown> = {}) {
  return {
    isHostPlayer: jest.fn(() => true),
    updateTemplate: jest.fn().mockResolvedValue({ success: true }),
    assignRoles: jest.fn().mockResolvedValue({ success: true }),
    startNight: jest.fn().mockResolvedValue({ success: true }),
    restartGame: jest.fn().mockResolvedValue({ success: true }),
    clearAllSeats: jest.fn().mockResolvedValue({ success: true }),
    shareNightReview: jest.fn().mockResolvedValue({ success: true }),
    setRoleRevealAnimation: jest.fn().mockResolvedValue({ success: true }),
    setAudioPlaying: jest.fn().mockResolvedValue({ success: true }),
    markViewedRole: jest.fn().mockResolvedValue({ success: true }),
    submitAction: jest.fn().mockResolvedValue({ success: true }),
    submitWolfVote: jest.fn().mockResolvedValue({ success: true }),
    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    sendWolfRobotHunterStatusViewed: jest.fn().mockResolvedValue({ success: true }),
    postProgression: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function createMockBgm() {
  return { startBgmIfEnabled: jest.fn(), stopBgm: jest.fn() };
}

function createMockDebug(overrides: Record<string, unknown> = {}) {
  return {
    controlledSeat: null,
    effectiveSeat: 1,
    effectiveRole: 'wolf',
    setControlledSeat: jest.fn(),
    ...overrides,
  };
}

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    facade: createMockFacade(),
    bgm: createMockBgm(),
    debug: createMockDebug(),
    mySeatNumber: 1,
    gameState: null,
    ...overrides,
  } as any;
}

// ---- Tests ----

describe('useGameActions - game control', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updateTemplate should call facade.updateTemplate', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.updateTemplate({ roles: [] } as any));

    expect(deps.facade.updateTemplate).toHaveBeenCalledWith({ roles: [] });
  });

  it('updateTemplate should skip when not host', async () => {
    const deps = createDeps({ facade: createMockFacade({ isHostPlayer: jest.fn(() => false) }) });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.updateTemplate({ roles: [] } as any));

    expect(deps.facade.updateTemplate).not.toHaveBeenCalled();
  });

  it('assignRoles should call facade and notify on failure', async () => {
    const facade = createMockFacade({
      assignRoles: jest.fn().mockResolvedValue({ success: false, reason: '人数不足' }),
    });
    const deps = createDeps({ facade });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.assignRoles());

    expect(mockShowAlert).toHaveBeenCalledWith('分配角色失败', '人数不足');
  });

  it('assignRoles should NOT alert on success', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.assignRoles());

    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it('startGame should start BGM and call facade.startNight', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.startGame());

    expect(deps.bgm.startBgmIfEnabled).toHaveBeenCalled();
    expect(deps.facade.startNight).toHaveBeenCalled();
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

  it('setRoleRevealAnimation should call facade for host', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.setRoleRevealAnimation('flip' as any));

    expect(deps.facade.setRoleRevealAnimation).toHaveBeenCalledWith('flip');
  });

  it('setAudioPlaying should return host_only reason when not host', async () => {
    const deps = createDeps({ facade: createMockFacade({ isHostPlayer: jest.fn(() => false) }) });
    const { result } = renderHook(() => useGameActions(deps));

    let res: any;
    await act(async () => {
      res = await result.current.setAudioPlaying(true);
    });

    expect(res).toEqual({ success: false, reason: 'host_only' });
    expect(deps.facade.setAudioPlaying).not.toHaveBeenCalled();
  });

  it('postProgression should call facade for host', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.postProgression());

    expect(deps.facade.postProgression).toHaveBeenCalled();
  });

  it('postProgression should skip for non-host', async () => {
    const deps = createDeps({ facade: createMockFacade({ isHostPlayer: jest.fn(() => false) }) });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.postProgression());

    expect(deps.facade.postProgression).not.toHaveBeenCalled();
  });
});

describe('useGameActions - player night actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('viewedRole should use mySeatNumber when no controlled seat', async () => {
    const deps = createDeps({ mySeatNumber: 3 });
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
      mySeatNumber: null,
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

  it('submitWolfVote should use effectiveSeat', async () => {
    const deps = createDeps({ debug: createMockDebug({ effectiveSeat: 3 }) });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitWolfVote(6));

    expect(deps.facade.submitWolfVote).toHaveBeenCalledWith(3, 6);
  });

  it('submitWolfVote should skip when effectiveSeat is null', async () => {
    const deps = createDeps({ debug: createMockDebug({ effectiveSeat: null }) });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.submitWolfVote(6));

    expect(deps.facade.submitWolfVote).not.toHaveBeenCalled();
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
    const deps = createDeps({ gameState: { lastNightDeaths: [], wolfVotes: new Map() } });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜');
  });

  it('getLastNightInfo should return "昨夜平安夜" when lastNightDeaths is null/undefined', () => {
    const deps = createDeps({ gameState: { lastNightDeaths: null, wolfVotes: new Map() } });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜平安夜');
  });

  it('getLastNightInfo should format death list (0-indexed → 1-indexed)', () => {
    const deps = createDeps({
      gameState: { lastNightDeaths: [0, 2, 5], wolfVotes: new Map() },
    });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.getLastNightInfo()).toBe('昨夜死亡: 1号, 3号, 6号');
  });

  it('hasWolfVoted should return false when no gameState', () => {
    const deps = createDeps({ gameState: null });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.hasWolfVoted(1)).toBe(false);
  });

  it('hasWolfVoted should check wolfVotes map', () => {
    const wolfVotes = new Map([[3, 5]]);
    const deps = createDeps({ gameState: { lastNightDeaths: [], wolfVotes } });
    const { result } = renderHook(() => useGameActions(deps));

    expect(result.current.hasWolfVoted(3)).toBe(true);
    expect(result.current.hasWolfVoted(1)).toBe(false);
  });
});

describe('useGameActions - notifyIfFailed', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should alert with default reason when reason is missing', async () => {
    const facade = createMockFacade({
      clearAllSeats: jest.fn().mockResolvedValue({ success: false }),
    });
    const deps = createDeps({ facade });
    const { result } = renderHook(() => useGameActions(deps));

    await act(() => result.current.clearAllSeats());

    expect(mockShowAlert).toHaveBeenCalledWith('全员起立失败', '请稍后重试');
  });
});
