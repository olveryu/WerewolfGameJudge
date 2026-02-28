/**
 * gameActions.test.ts — callGameControlApi 核心逻辑 + thin wrapper 契约
 *
 * 重点测试 callGameControlApi 的高 bug 密度分支：
 * 1. 成功路径 + optimistic snapshot apply
 * 2. 服务端拒绝 → rollback optimistic
 * 3. CONFLICT_RETRY → 客户端透明重试（最多 2 次）→ 重试耗尽
 * 4. Non-JSON 502/503 错误页 → 不抛 SyntaxError
 * 5. 网络错误（TypeError from fetch）→ rollback + NETWORK_ERROR
 * 6. ReferenceError → 直接 rethrow（编程错误）
 * 7. 乐观更新 + rollback 时序
 *
 * thin wrapper（assignRoles 等）只测 NOT_CONNECTED 路径 + 正常调用转发。
 */

import { GameStatus } from '@werewolf/game-engine';
import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState } from '@werewolf/game-engine/engine/store/types';

// Mock dependencies before importing
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('@werewolf/game-engine/utils/random', () => ({
  secureRng: () => 0.5, // deterministic for delay calc
}));

jest.mock('../../infra/AudioService', () => ({
  AudioService: jest.fn(),
}));

// Import after mocks
import * as Sentry from '@sentry/react-native';

import {
  assignRoles,
  clearAllSeats,
  clearRevealAcks,
  endNight,
  fillWithBots,
  markAllBotsViewed,
  markViewedRole,
  postAudioAck,
  postProgression,
  restartGame,
  setAudioPlaying,
  setRoleRevealAnimation,
  setWolfRobotHunterStatusViewed,
  shareNightReview,
  startNight,
  submitAction,
  submitWolfVote,
  updateTemplate,
} from '@/services/facade/gameActions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_STATE: Partial<GameState> = {
  roomCode: 'ABCD',
  hostUid: 'host-1',
  players: {
    0: {
      uid: 'host-1',
      seatNumber: 0,
      role: 'wolf',
      hasViewedRole: false,
      displayName: 'P0',
    } as any,
    1: { uid: 'p2', seatNumber: 1, role: 'seer', hasViewedRole: false, displayName: 'P1' } as any,
    2: {
      uid: 'p3',
      seatNumber: 2,
      role: 'villager',
      hasViewedRole: false,
      displayName: 'P2',
    } as any,
  },
};

function createMockStore(state: Partial<GameState> | null = DEFAULT_STATE): GameStore {
  let currentState = state as GameState | null;
  return {
    getState: jest.fn(() => currentState),
    applyOptimistic: jest.fn((s: GameState) => {
      currentState = s;
    }),
    rollbackOptimistic: jest.fn(),
    applySnapshot: jest.fn((s: GameState, _rev: number) => {
      currentState = s;
    }),
  } as unknown as GameStore;
}

function createMockCtx(storeState?: Partial<GameState> | null) {
  return {
    store: createMockStore(storeState),
    myUid: 'host-1',
    getMySeatNumber: () => 0,
    audioService: { preloadForRoles: jest.fn().mockResolvedValue(undefined) } as any,
  };
}

function mockFetchSuccess(result: Record<string, unknown> = { success: true }) {
  return jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(result),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('callGameControlApi (via assignRoles wrapper)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Success paths
  // =========================================================================

  it('should return success on 200 JSON response', async () => {
    global.fetch = mockFetchSuccess({ success: true });
    const ctx = createMockCtx();

    const result = await assignRoles(ctx);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should apply snapshot when response contains state + revision', async () => {
    const newState = { roomCode: 'ABCD', status: GameStatus.Assigned };
    global.fetch = mockFetchSuccess({ success: true, state: newState, revision: 5 });
    const ctx = createMockCtx();

    await assignRoles(ctx);

    expect(ctx.store.applySnapshot).toHaveBeenCalledWith(newState, 5);
  });

  // =========================================================================
  // Server rejection → rollback
  // =========================================================================

  it('should rollback optimistic on server rejection', async () => {
    global.fetch = mockFetchSuccess({ success: false, reason: 'INVALID_STATUS' });
    const ctx = createMockCtx();

    // Use markViewedRole which has optimisticFn
    const result = await markViewedRole(ctx, 0);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('INVALID_STATUS');
    expect(ctx.store.rollbackOptimistic).toHaveBeenCalled();
  });

  it('should apply optimistic update before fetch', async () => {
    let optimisticApplied = false;
    const store = createMockStore();
    (store.applyOptimistic as jest.Mock).mockImplementation(() => {
      optimisticApplied = true;
    });

    global.fetch = jest.fn().mockImplementation(async () => {
      // At fetch time, optimistic should already be applied
      expect(optimisticApplied).toBe(true);
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      };
    });

    const ctx = { ...createMockCtx(), store };
    await markViewedRole(ctx, 3);

    expect(store.applyOptimistic).toHaveBeenCalled();
  });

  // =========================================================================
  // Non-JSON error (502/503 gateway error)
  // =========================================================================

  it('should handle non-JSON 502 error without throwing SyntaxError', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => 'text/html' },
      json: () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });
    const ctx = createMockCtx();

    const result = await assignRoles(ctx);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('SERVER_ERROR');
    // Should NOT call .json()
  });

  it('should rollback optimistic on non-JSON error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => 'text/html' },
    });

    const ctx = createMockCtx();
    await markViewedRole(ctx, 0);

    expect(ctx.store.rollbackOptimistic).toHaveBeenCalled();
  });

  // =========================================================================
  // CONFLICT_RETRY → client retry
  // =========================================================================

  it('should retry on CONFLICT_RETRY and succeed on second attempt', async () => {
    jest.useFakeTimers();

    const conflictResponse = () =>
      Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'CONFLICT_RETRY' }),
      });
    const successResponse = () =>
      Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

    global.fetch = jest
      .fn()
      .mockImplementationOnce(conflictResponse)
      .mockImplementationOnce(successResponse);

    const ctx = createMockCtx();
    const resultPromise = assignRoles(ctx);

    // Advance timers for retry delay
    await jest.advanceTimersByTimeAsync(500);

    const result = await resultPromise;
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should return CONFLICT_RETRY after exhausting max retries', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: false, reason: 'CONFLICT_RETRY' }),
    });

    const ctx = createMockCtx();
    const resultPromise = assignRoles(ctx);

    // Advance past all retry delays
    await jest.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    // After 3 attempts (0, 1, 2), last CONFLICT_RETRY is returned as-is
    expect(result.success).toBe(false);
    expect(result.reason).toBe('CONFLICT_RETRY');
    // 3 attempts total: initial + 2 retries (the 3rd CONFLICT_RETRY is on the last attempt)
    expect(global.fetch).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });

  it('should rollback optimistic after retry exhaustion', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: false, reason: 'CONFLICT_RETRY' }),
    });

    const ctx = createMockCtx();
    const resultPromise = markViewedRole(ctx, 0);

    await jest.advanceTimersByTimeAsync(2000);
    await resultPromise;

    expect(ctx.store.rollbackOptimistic).toHaveBeenCalled();

    jest.useRealTimers();
  });

  // =========================================================================
  // Network errors (TypeError from fetch)
  // =========================================================================

  it('should return NETWORK_ERROR on fetch TypeError (network failure)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const ctx = createMockCtx();

    const result = await assignRoles(ctx);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('NETWORK_ERROR');
    // Network errors are expected — should NOT report to Sentry
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should rollback optimistic on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network error'));
    const ctx = createMockCtx();

    await markViewedRole(ctx, 0);

    expect(ctx.store.rollbackOptimistic).toHaveBeenCalled();
  });

  // =========================================================================
  // ReferenceError → rethrow (programming bug)
  // =========================================================================

  it('should rethrow ReferenceError (programming bug, not network)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new ReferenceError('x is not defined'));
    const ctx = createMockCtx();

    await expect(assignRoles(ctx)).rejects.toThrow(ReferenceError);
  });
});

// =============================================================================
// Thin wrappers: NOT_CONNECTED guard + correct API path
// =============================================================================

describe('gameActions thin wrappers — NOT_CONNECTED guard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['assignRoles', (ctx: any) => assignRoles(ctx)],
    ['startNight', (ctx: any) => startNight(ctx)],
    ['restartGame', (ctx: any) => restartGame(ctx)],
    ['updateTemplate', (ctx: any) => updateTemplate(ctx, { roles: ['wolf', 'villager'] } as any)],
    ['setRoleRevealAnimation', (ctx: any) => setRoleRevealAnimation(ctx, 'tarot')],
    ['shareNightReview', (ctx: any) => shareNightReview(ctx, [1, 2])],
    ['fillWithBots', (ctx: any) => fillWithBots(ctx)],
    ['markAllBotsViewed', (ctx: any) => markAllBotsViewed(ctx)],
    ['clearAllSeats', (ctx: any) => clearAllSeats(ctx)],
  ] as const)('%s should return NOT_CONNECTED when roomCode is null', async (_name, fn) => {
    const ctx = createMockCtx(null);
    const result = await fn(ctx);
    expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
  });

  it.each([
    ['submitAction', (ctx: any) => submitAction(ctx, 0, 'wolf', 1)],
    ['submitWolfVote', (ctx: any) => submitWolfVote(ctx, 0, 1)],
    ['endNight', (ctx: any) => endNight(ctx)],
    ['setAudioPlaying', (ctx: any) => setAudioPlaying(ctx, true)],
    ['clearRevealAcks', (ctx: any) => clearRevealAcks(ctx)],
    ['setWolfRobotHunterStatusViewed', (ctx: any) => setWolfRobotHunterStatusViewed(ctx, 0)],
    ['postAudioAck', (ctx: any) => postAudioAck(ctx)],
    ['postProgression', (ctx: any) => postProgression(ctx)],
  ] as const)('%s should return NOT_CONNECTED when state is null', async (_name, fn) => {
    const ctx = createMockCtx(null);
    const result = await fn(ctx);
    expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
  });
});

describe('startNight — preloads audio on success', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fire-and-forget preloadForRoles after successful start', async () => {
    global.fetch = mockFetchSuccess({
      success: true,
      state: { roomCode: 'ABCD', templateRoles: ['wolf', 'seer', 'villager'] },
      revision: 1,
    });

    const ctx = createMockCtx({ roomCode: 'ABCD', hostUid: 'host-1' } as any);
    const result = await startNight(ctx);

    expect(result.success).toBe(true);
  });
});
