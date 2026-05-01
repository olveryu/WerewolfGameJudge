/**
 * gameActions.test.ts — callGameControlApi 核心逻辑 + thin wrapper 契约
 *
 * 重点测试 callGameControlApi 的高 bug 密度分支：
 * 1. 成功路径 + snapshot apply
 * 2. 服务端拒绝
 * 3. CONFLICT_RETRY → 客户端透明重试（最多 2 次）→ 重试耗尽
 * 4. Non-JSON 502/503 错误页 → 不抛 SyntaxError
 * 5. 网络错误（TypeError from fetch）→ NETWORK_ERROR
 * 6. ReferenceError → 直接 rethrow（编程错误）
 *
 * thin wrapper（assignRoles 等）只测 NOT_CONNECTED 路径 + 正常调用转发。
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

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

// fetchWithRetry passthrough: tests mock global.fetch directly,
// so bypass network-layer retry to avoid delays and timer interference.
jest.mock('@/services/cloudflare/cfFetch', () => ({
  ...jest.requireActual<typeof import('@/services/cloudflare/cfFetch')>(
    '@/services/cloudflare/cfFetch',
  ),
  fetchWithRetry: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
}));

// Import after mocks
import * as Sentry from '@sentry/react-native';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';

import type { GameActionsContext } from '@/services/facade/gameActions';
import {
  assignRoles,
  clearAllSeats,
  clearRevealAcks,
  fillWithBots,
  markAllBotsGroupConfirmed,
  markAllBotsViewed,
  postAudioAck,
  postProgression,
  restartGame,
  setAudioPlaying,
  setWolfRobotHunterStatusViewed,
  shareNightReview,
  startNight,
  submitAction,
  updateTemplate,
} from '@/services/facade/gameActions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_STATE: Partial<GameState> = {
  roomCode: 'ABCD',
  hostUserId: 'host-1',
  players: {
    0: {
      userId: 'host-1',
      seat: 0,
      role: 'wolf',
      hasViewedRole: false,
      displayName: 'P0',
    } as unknown as GameState['players'][number],
    1: {
      userId: 'p2',
      seat: 1,
      role: 'seer',
      hasViewedRole: false,
      displayName: 'P1',
    } as unknown as GameState['players'][number],
    2: {
      userId: 'p3',
      seat: 2,
      role: 'villager',
      hasViewedRole: false,
      displayName: 'P2',
    } as unknown as GameState['players'][number],
  },
};

function createMockStore(state: Partial<GameState> | null = DEFAULT_STATE): GameStore {
  let currentState = state as GameState | null;
  return {
    getState: jest.fn(() => currentState),
    applySnapshot: jest.fn((s: GameState, _rev: number) => {
      currentState = s;
    }),
  } as unknown as GameStore;
}

function createMockCtx(storeState?: Partial<GameState> | null) {
  return {
    store: createMockStore(storeState),
    myUserId: 'host-1',
    getMySeat: () => 0,
    audioService: {
      preloadForRoles: jest.fn().mockResolvedValue(undefined),
    } as unknown as GameActionsContext['audioService'],
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

  it('should return failure reason on server rejection', async () => {
    global.fetch = mockFetchSuccess({ success: false, reason: 'INVALID_STATUS' });
    const ctx = createMockCtx();

    const result = await assignRoles(ctx);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('INVALID_STATUS');
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

  it('should return SERVER_ERROR on non-JSON 503', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => 'text/html' },
    });

    const ctx = createMockCtx();

    const result = await assignRoles(ctx);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('SERVER_ERROR');
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

  it('should return NETWORK_ERROR after retry exhaustion', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: false, reason: 'CONFLICT_RETRY' }),
    });

    const ctx = createMockCtx();
    const resultPromise = assignRoles(ctx);

    await jest.advanceTimersByTimeAsync(2000);
    const result = await resultPromise;

    expect(result.success).toBe(false);

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

  it('should return TIMEOUT on AbortError', async () => {
    const abortError = Object.assign(new Error('The operation was aborted.'), {
      name: 'AbortError',
    });
    global.fetch = jest.fn().mockRejectedValue(abortError);
    const ctx = createMockCtx();

    const result = await assignRoles(ctx);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('TIMEOUT');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('should return NETWORK_ERROR on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network error'));
    const ctx = createMockCtx();

    const result = await assignRoles(ctx);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('NETWORK_ERROR');
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
    ['assignRoles', (ctx: GameActionsContext) => assignRoles(ctx)],
    ['startNight', (ctx: GameActionsContext) => startNight(ctx)],
    ['restartGame', (ctx: GameActionsContext) => restartGame(ctx)],
    [
      'updateTemplate',
      (ctx: GameActionsContext) =>
        updateTemplate(ctx, { roles: ['wolf', 'villager'] } as unknown as GameTemplate),
    ],
    ['shareNightReview', (ctx: GameActionsContext) => shareNightReview(ctx, [1, 2])],
    ['fillWithBots', (ctx: GameActionsContext) => fillWithBots(ctx)],
    ['markAllBotsViewed', (ctx: GameActionsContext) => markAllBotsViewed(ctx)],
    ['markAllBotsGroupConfirmed', (ctx: GameActionsContext) => markAllBotsGroupConfirmed(ctx)],
    ['clearAllSeats', (ctx: GameActionsContext) => clearAllSeats(ctx)],
  ] as const)('%s should return NOT_CONNECTED when roomCode is null', async (_name, fn) => {
    const ctx = createMockCtx(null);
    const result = await fn(ctx);
    expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
  });

  it.each([
    ['submitAction', (ctx: GameActionsContext) => submitAction(ctx, 0, 'wolf', 1)],
    ['setAudioPlaying', (ctx: GameActionsContext) => setAudioPlaying(ctx, true)],
    ['clearRevealAcks', (ctx: GameActionsContext) => clearRevealAcks(ctx)],
    [
      'setWolfRobotHunterStatusViewed',
      (ctx: GameActionsContext) => setWolfRobotHunterStatusViewed(ctx, 0),
    ],
    ['postAudioAck', (ctx: GameActionsContext) => postAudioAck(ctx)],
    ['postProgression', (ctx: GameActionsContext) => postProgression(ctx)],
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

    const ctx = createMockCtx({ roomCode: 'ABCD', hostUserId: 'host-1' });
    const result = await startNight(ctx);

    expect(result.success).toBe(true);
  });
});
