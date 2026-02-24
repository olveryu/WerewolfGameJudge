/**
 * useDebugMode.test - Unit tests for Host debug bot-control hook
 *
 * Verifies effectiveSeat/effectiveRole derivation, isDebugMode flag,
 * fillWithBots flow (leave seat → fill), and markAllBotsViewed guard.
 */

import { act, renderHook } from '@testing-library/react-native';

import { useDebugMode } from '@/hooks/useDebugMode';

function createMockFacade(overrides: Record<string, unknown> = {}) {
  return {
    isHostPlayer: jest.fn(() => true),
    getMySeatNumber: jest.fn(() => 1),
    leaveSeat: jest.fn().mockResolvedValue(undefined),
    fillWithBots: jest.fn().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  } as any;
}

function makeGameState(overrides: Record<string, unknown> = {}) {
  const players = new Map();
  players.set(1, { role: 'wolf', seatNumber: 1 });
  players.set(2, { role: 'seer', seatNumber: 2 });
  return {
    players,
    debugMode: { botsEnabled: false },
    ...overrides,
  } as any;
}

describe('useDebugMode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('effectiveSeat defaults to mySeatNumber when no controlled seat', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useDebugMode(facade, 3, null));

    expect(result.current.effectiveSeat).toBe(3);
    expect(result.current.controlledSeat).toBeNull();
  });

  it('effectiveSeat uses controlledSeat when set', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useDebugMode(facade, 1, makeGameState()));

    act(() => {
      result.current.setControlledSeat(2);
    });

    expect(result.current.effectiveSeat).toBe(2);
    expect(result.current.effectiveRole).toBe('seer');
  });

  it('effectiveRole is null when gameState is null', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useDebugMode(facade, 1, null));

    expect(result.current.effectiveRole).toBeNull();
  });

  it('effectiveRole is derived from gameState.players', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useDebugMode(facade, 1, makeGameState()));

    expect(result.current.effectiveRole).toBe('wolf');
  });

  it('effectiveRole is null when seat not in players map', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useDebugMode(facade, 99, makeGameState()));

    expect(result.current.effectiveRole).toBeNull();
  });

  it('isDebugMode reflects gameState.debugMode.botsEnabled', () => {
    const facade = createMockFacade();
    const stateWithBots = makeGameState({ debugMode: { botsEnabled: true } });
    const { result } = renderHook(() => useDebugMode(facade, 1, stateWithBots));

    expect(result.current.isDebugMode).toBe(true);
  });

  it('isDebugMode is false when debugMode is absent', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useDebugMode(facade, 1, makeGameState()));

    expect(result.current.isDebugMode).toBe(false);
  });

  // --- fillWithBots ---

  it('fillWithBots leaves seat first if hosted is seated, then fills', async () => {
    const facade = createMockFacade({ getMySeatNumber: jest.fn(() => 1) });
    const { result } = renderHook(() => useDebugMode(facade, 1, null));

    let res: any;
    await act(async () => {
      res = await result.current.fillWithBots();
    });

    expect(facade.leaveSeat).toHaveBeenCalled();
    expect(facade.fillWithBots).toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });

  it('fillWithBots skips leaveSeat when host is not seated', async () => {
    const facade = createMockFacade({ getMySeatNumber: jest.fn(() => null) });
    const { result } = renderHook(() => useDebugMode(facade, null, null));

    await act(async () => {
      await result.current.fillWithBots();
    });

    expect(facade.leaveSeat).not.toHaveBeenCalled();
    expect(facade.fillWithBots).toHaveBeenCalled();
  });

  it('fillWithBots returns failure when not host', async () => {
    const facade = createMockFacade({ isHostPlayer: jest.fn(() => false) });
    const { result } = renderHook(() => useDebugMode(facade, 1, null));

    let res: any;
    await act(async () => {
      res = await result.current.fillWithBots();
    });

    expect(res).toEqual({ success: false, reason: 'host_only' });
    expect(facade.leaveSeat).not.toHaveBeenCalled();
  });

  it('fillWithBots handles leaveSeat failure', async () => {
    const facade = createMockFacade({
      getMySeatNumber: jest.fn(() => 1),
      leaveSeat: jest.fn().mockRejectedValue(new Error('leave failed')),
    });
    const { result } = renderHook(() => useDebugMode(facade, 1, null));

    let res: any;
    await act(async () => {
      res = await result.current.fillWithBots();
    });

    expect(res.success).toBe(false);
    expect(res.reason).toContain('failed_to_leave_seat');
  });

  // --- markAllBotsViewed ---

  it('markAllBotsViewed calls facade method', async () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useDebugMode(facade, 1, null));

    let res: any;
    await act(async () => {
      res = await result.current.markAllBotsViewed();
    });

    expect(facade.markAllBotsViewed).toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });

  it('markAllBotsViewed returns failure when not host', async () => {
    const facade = createMockFacade({ isHostPlayer: jest.fn(() => false) });
    const { result } = renderHook(() => useDebugMode(facade, 1, null));

    let res: any;
    await act(async () => {
      res = await result.current.markAllBotsViewed();
    });

    expect(res).toEqual({ success: false, reason: 'host_only' });
  });
});
