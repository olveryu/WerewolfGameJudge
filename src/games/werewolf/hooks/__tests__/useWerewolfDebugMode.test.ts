/**
 * useWerewolfDebugMode.test - Unit tests for Host debug bot-control hook
 *
 * Verifies effectiveSeat/effectiveRole derivation, isDebugMode flag,
 * fillWithBots flow (leave seat → fill), and markAllBotsViewed guard.
 */

import { act, renderHook } from '@testing-library/react-native';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';

import { useWerewolfDebugMode } from '@/games/werewolf/hooks/useWerewolfDebugMode';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { LocalGameState, LocalPlayer } from '@/types/GameStateTypes';

type MockFacade = Pick<
  IGameFacade,
  | 'isHostPlayer'
  | 'getMySeat'
  | 'leaveSeat'
  | 'fillWithBots'
  | 'markAllBotsViewed'
  | 'markAllBotsGroupConfirmed'
>;

function createMockFacade(overrides: Partial<{ [K in keyof MockFacade]: MockFacade[K] }> = {}) {
  return {
    isHostPlayer: jest.fn<boolean, []>(() => true),
    getMySeat: jest.fn<number | null, []>(() => 1),
    leaveSeat: jest.fn().mockResolvedValue({ success: true }),
    fillWithBots: jest.fn<Promise<ActionResult>, []>().mockResolvedValue({ success: true }),
    markAllBotsViewed: jest.fn<Promise<ActionResult>, []>().mockResolvedValue({ success: true }),
    markAllBotsGroupConfirmed: jest
      .fn<Promise<ActionResult>, []>()
      .mockResolvedValue({ success: true }),
    ...overrides,
  } as unknown as IGameFacade;
}

function makeGameState(
  overrides: Partial<Pick<LocalGameState, 'players' | 'debugMode'>> = {},
): LocalGameState {
  const players = new Map<number, LocalPlayer | null>();
  players.set(1, {
    userId: 'u1',
    seat: 1,
    role: 'wolf',
    hasViewedRole: false,
  });
  players.set(2, {
    userId: 'u2',
    seat: 2,
    role: 'seer',
    hasViewedRole: false,
  });
  return {
    players,
    debugMode: { botsEnabled: false },
    ...overrides,
  } as unknown as LocalGameState;
}

describe('useWerewolfDebugMode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('effectiveSeat defaults to mySeat when no controlled seat', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 3, null));

    expect(result.current.effectiveSeat).toBe(3);
    expect(result.current.controlledSeat).toBeNull();
  });

  it('effectiveSeat uses controlledSeat when set', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, makeGameState()));

    act(() => {
      result.current.takeOverBot(2);
    });

    expect(result.current.effectiveSeat).toBe(2);
    expect(result.current.effectiveRole).toBe('seer');
  });

  it('effectiveRole is null when gameState is null', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, null));

    expect(result.current.effectiveRole).toBeNull();
  });

  it('effectiveRole is derived from gameState.players', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, makeGameState()));

    expect(result.current.effectiveRole).toBe('wolf');
  });

  it('effectiveRole is null when seat not in players map', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 99, makeGameState()));

    expect(result.current.effectiveRole).toBeNull();
  });

  it('isDebugMode reflects gameState.debugMode.botsEnabled', () => {
    const facade = createMockFacade();
    const stateWithBots = makeGameState({ debugMode: { botsEnabled: true } });
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, stateWithBots));

    expect(result.current.isDebugMode).toBe(true);
  });

  it('isDebugMode is false when debugMode is absent', () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, makeGameState()));

    expect(result.current.isDebugMode).toBe(false);
  });

  // --- fillWithBots ---

  it('fillWithBots leaves seat first if hosted is seated, then fills', async () => {
    const facade = createMockFacade({
      getMySeat: jest.fn<number | null, []>(() => 1),
    });
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, null));

    let res: ActionResult | undefined;
    await act(async () => {
      res = await result.current.fillWithBots();
    });

    expect(facade.leaveSeat).toHaveBeenCalled();
    expect(facade.fillWithBots).toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });

  it('fillWithBots skips leaveSeat when host is not seated', async () => {
    const facade = createMockFacade({
      getMySeat: jest.fn<number | null, []>(() => null),
    });
    const { result } = renderHook(() => useWerewolfDebugMode(facade, null, null));

    await act(async () => {
      await result.current.fillWithBots();
    });

    expect(facade.leaveSeat).not.toHaveBeenCalled();
    expect(facade.fillWithBots).toHaveBeenCalled();
  });

  it('fillWithBots returns failure when not host', async () => {
    const facade = createMockFacade({
      isHostPlayer: jest.fn<boolean, []>(() => false),
    });
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, null));

    let res: ActionResult | undefined;
    await act(async () => {
      res = await result.current.fillWithBots();
    });

    expect(res).toEqual({ success: false, reason: 'host_only' });
    expect(facade.leaveSeat).not.toHaveBeenCalled();
  });

  it('fillWithBots returns the leave-seat rejection without filling bots', async () => {
    const facade = createMockFacade({
      getMySeat: jest.fn<number | null, []>(() => 1),
      leaveSeat: jest.fn().mockResolvedValue({ success: false, reason: 'game_in_progress' }),
    });
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, null));

    let res: ActionResult | undefined;
    await act(async () => {
      res = await result.current.fillWithBots();
    });

    expect(res).toEqual({ success: false, reason: 'game_in_progress' });
    expect(facade.fillWithBots).not.toHaveBeenCalled();
  });

  it('fillWithBots propagates an unexpected leave-seat exception', async () => {
    const facade = createMockFacade({
      getMySeat: jest.fn<number | null, []>(() => 1),
      leaveSeat: jest.fn().mockRejectedValue(new Error('leave failed')),
    });
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, null));

    await expect(result.current.fillWithBots()).rejects.toThrow('leave failed');
    expect(facade.fillWithBots).not.toHaveBeenCalled();
  });

  // --- markAllBotsViewed ---

  it('markAllBotsViewed calls facade method', async () => {
    const facade = createMockFacade();
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, null));

    let res: ActionResult | undefined;
    await act(async () => {
      res = await result.current.markAllBotsViewed();
    });

    expect(facade.markAllBotsViewed).toHaveBeenCalled();
    expect(res).toEqual({ success: true });
  });

  it('markAllBotsViewed returns failure when not host', async () => {
    const facade = createMockFacade({
      isHostPlayer: jest.fn<boolean, []>(() => false),
    });
    const { result } = renderHook(() => useWerewolfDebugMode(facade, 1, null));

    let res: ActionResult | undefined;
    await act(async () => {
      res = await result.current.markAllBotsViewed();
    });

    expect(res).toEqual({ success: false, reason: 'host_only' });
  });
});
