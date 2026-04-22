/**
 * defineGameAction.test.ts — Factory unit tests.
 *
 * Verifies:
 * 1. Simple action (no extra args) → debug-log + callApiWithRetry
 * 2. Action with body builder → extra fields merged into request
 * 3. needsUserId guard → userId included / NOT_CONNECTED when missing
 * 4. after hook fires on success / failure
 * 5. NOT_CONNECTED when roomCode is null
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('@werewolf/game-engine/utils/random', () => ({
  secureRng: () => 0.5,
}));

jest.mock('../../infra/AudioService', () => ({
  AudioService: jest.fn(),
}));

// Import after mocks
import type { GameActionsContext } from '@/services/facade/gameActions';

import { defineGameAction } from '../defineGameAction';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockStore(roomCode: string | null = 'ABCD'): GameStore {
  const state = roomCode ? ({ roomCode } as unknown) : null;
  return {
    getState: jest.fn(() => state),
    applySnapshot: jest.fn(),
  } as unknown as GameStore;
}

function createMockCtx(
  overrides: Partial<{ roomCode: string | null; myUserId: string | null }> = {},
): GameActionsContext {
  return {
    store: createMockStore('roomCode' in overrides ? overrides.roomCode! : 'ABCD'),
    myUserId: 'myUserId' in overrides ? overrides.myUserId! : 'user-1',
    getMySeat: () => 0,
    audioService: {} as GameActionsContext['audioService'],
  };
}

function mockFetchSuccess(result: Record<string, unknown> = { success: true }) {
  return jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(result),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('defineGameAction', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Basic: no-arg action
  // ─────────────────────────────────────────────────────────────────────────

  it('calls API with roomCode for a simple action', async () => {
    global.fetch = mockFetchSuccess();
    const action = defineGameAction({ name: 'test', path: '/game/test' });

    const result = await action(createMockCtx());

    expect(result.success).toBe(true);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ roomCode: 'ABCD' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Body builder
  // ─────────────────────────────────────────────────────────────────────────

  it('merges body builder fields into request', async () => {
    global.fetch = mockFetchSuccess();
    const action = defineGameAction<[number, string]>({
      name: 'withBody',
      path: '/game/action',
      body: (seat, role) => ({ seat, role }),
    });

    await action(createMockCtx(), 3, 'wolf');

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ roomCode: 'ABCD', seat: 3, role: 'wolf' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // needsUserId
  // ─────────────────────────────────────────────────────────────────────────

  it('includes userId when needsUserId is true', async () => {
    global.fetch = mockFetchSuccess();
    const action = defineGameAction<[number]>({
      name: 'viewRole',
      path: '/game/view-role',
      needsUserId: true,
      body: (seat) => ({ seat }),
    });

    await action(createMockCtx({ myUserId: 'player-42' }), 5);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ roomCode: 'ABCD', userId: 'player-42', seat: 5 });
  });

  it('returns NOT_CONNECTED when needsUserId and myUserId is null', async () => {
    const action = defineGameAction({
      name: 'viewRole',
      path: '/game/view-role',
      needsUserId: true,
    });

    const result = await action(createMockCtx({ myUserId: null }));

    expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NOT_CONNECTED guard
  // ─────────────────────────────────────────────────────────────────────────

  it('returns NOT_CONNECTED when roomCode is null', async () => {
    const action = defineGameAction({ name: 'test', path: '/game/test' });

    const result = await action(createMockCtx({ roomCode: null }));

    expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // after hook
  // ─────────────────────────────────────────────────────────────────────────

  it('calls after hook with result on success', async () => {
    global.fetch = mockFetchSuccess({ success: true });
    const afterFn = jest.fn();
    const action = defineGameAction({ name: 'test', path: '/game/test', after: afterFn });
    const ctx = createMockCtx();

    await action(ctx);

    expect(afterFn).toHaveBeenCalledWith(ctx, expect.objectContaining({ success: true }));
  });

  it('calls after hook with result on failure', async () => {
    global.fetch = mockFetchSuccess({ success: false, reason: 'BAD' });
    const afterFn = jest.fn();
    const action = defineGameAction({ name: 'test', path: '/game/test', after: afterFn });
    const ctx = createMockCtx();

    await action(ctx);

    expect(afterFn).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ success: false, reason: 'BAD' }),
    );
  });
});
