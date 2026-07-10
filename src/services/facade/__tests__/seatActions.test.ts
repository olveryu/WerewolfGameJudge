/**
 * seatActions Unit Tests (HTTP API version)
 *
 * Tests seat operation orchestration layer (post-migration):
 * - Unified HTTP API calls (Host / Player no longer distinguished)
 * - takeSeat / leaveSeat -> fetch POST /game/seat with reason-preserving results
 * - NOT_CONNECTED guard (when roomCode / userId missing)
 * - NETWORK_ERROR handling
 *
 * Via mock fetch (HTTP calls), only verifies orchestration logic; does not mock handler (server logic is elsewhere).
 */

import type { SeatActionsContext } from '@/services/facade/seatActions';
import { leaveSeat, takeSeat } from '@/services/facade/seatActions';

import { buildApiCommandSuccess, buildApiTestState } from './apiTestState';

jest.mock('../../../utils/logger', () => ({
  facadeLog: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// fetchWithRetry passthrough: tests mock global.fetch directly,
// so bypass network-layer retry to avoid delays and timer interference.
jest.mock('@/services/cloudflare/cfFetch', () => ({
  ...jest.requireActual<typeof import('@/services/cloudflare/cfFetch')>(
    '@/services/cloudflare/cfFetch',
  ),
  fetchWithRetry: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockCtx(overrides?: Partial<SeatActionsContext>): SeatActionsContext {
  return {
    myUserId: 'test-uid',
    getRoomCode: () => 'ABCD',
    ...overrides,
  };
}

/** Create mock fetch response */
function mockFetchSuccess(body: Record<string, unknown> = buildApiCommandSuccess()): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  });
}

function mockFetchFailure(reason: string): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve({ success: false, reason }),
  });
}

function mockFetchNetworkError(): jest.Mock {
  return jest.fn().mockRejectedValue(new Error('Network request failed'));
}

// =============================================================================
// Tests
// =============================================================================

describe('seatActions (HTTP API)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // takeSeat
  // ===========================================================================

  describe('takeSeat', () => {
    it('should call fetch with correct params', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      const result = await takeSeat(ctx, 2, {
        displayName: 'Alice',
        avatarUrl: 'https://avatar.url',
      });

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/seat'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-region': 'us-west-1',
            'x-request-id': expect.any(String) as string,
          }) as Record<string, string>,
          body: JSON.stringify({
            roomCode: 'ABCD',
            action: 'sit',
            userId: 'test-uid',
            seat: 2,
            displayName: 'Alice',
            avatarUrl: 'https://avatar.url',
          }),
        }),
      );
    });

    it('should return reason on server rejection', async () => {
      global.fetch = mockFetchFailure('seat_taken');
      const ctx = createMockCtx();

      const result = await takeSeat(ctx, 0, { displayName: 'Alice' });

      expect(result).toEqual({ success: false, reason: 'seat_taken' });
    });

    it('should return NOT_CONNECTED when roomCode is null', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx({ getRoomCode: () => null });

      const result = await takeSeat(ctx, 0, { displayName: 'Alice' });

      expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return NOT_CONNECTED when myUserId is null', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx({ myUserId: null });

      const result = await takeSeat(ctx, 0, { displayName: 'Alice' });

      expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return NETWORK_ERROR on fetch failure', async () => {
      global.fetch = mockFetchNetworkError();
      const ctx = createMockCtx();

      const result = await takeSeat(ctx, 0, { displayName: 'Alice' });

      expect(result).toEqual({ success: false, reason: 'NETWORK_ERROR' });
    });

    it('should handle game_in_progress reason', async () => {
      global.fetch = mockFetchFailure('game_in_progress');
      const ctx = createMockCtx();

      const result = await takeSeat(ctx, 0, { displayName: 'Alice' });

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should handle invalid_seat reason', async () => {
      global.fetch = mockFetchFailure('invalid_seat');
      const ctx = createMockCtx();

      const result = await takeSeat(ctx, 999, { displayName: 'Alice' });

      expect(result).toEqual({ success: false, reason: 'invalid_seat' });
    });

    it('should omit displayName and avatarUrl when not provided', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      await takeSeat(ctx, 1);

      const body = JSON.parse(
        (jest.mocked(global.fetch).mock.calls[0]![1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(body.displayName).toBeUndefined();
      expect(body.avatarUrl).toBeUndefined();
    });
  });

  // ===========================================================================
  // leaveSeat
  // ===========================================================================

  describe('leaveSeat', () => {
    it('should call fetch with standup action', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      const result = await leaveSeat(ctx);

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/seat'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            roomCode: 'ABCD',
            action: 'standup',
            userId: 'test-uid',
          }),
        }),
      );
    });

    it('should return reason on server rejection', async () => {
      global.fetch = mockFetchFailure('game_in_progress');
      const ctx = createMockCtx();

      const result = await leaveSeat(ctx);

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should return NOT_CONNECTED when roomCode is null', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx({ getRoomCode: () => null });

      const result = await leaveSeat(ctx);

      expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return NETWORK_ERROR on fetch failure', async () => {
      global.fetch = mockFetchNetworkError();
      const ctx = createMockCtx();

      const result = await leaveSeat(ctx);

      expect(result).toEqual({ success: false, reason: 'NETWORK_ERROR' });
    });
  });

  // ===========================================================================
  // Server Response (store.applySnapshot)
  // ===========================================================================

  describe('server response (store.applySnapshot)', () => {
    function createMockStore(currentState: Record<string, unknown> | null = null) {
      return {
        getState: jest.fn().mockReturnValue(currentState),
        applySnapshot: jest.fn(),
      };
    }

    it('should call store.applySnapshot when response contains state + revision', async () => {
      const mockState = buildApiTestState();
      global.fetch = mockFetchSuccess(buildApiCommandSuccess(mockState, 5));
      const mockStore = createMockStore({ roomCode: 'ABCD', players: { 1: null } });
      const ctx = createMockCtx({ store: mockStore as unknown as SeatActionsContext['store'] });

      await takeSeat(ctx, 2, { displayName: 'Alice' });

      expect(mockStore.applySnapshot).toHaveBeenCalledWith(mockState, 5);
    });

    it('should fail fast when a successful response omits its snapshot', async () => {
      global.fetch = mockFetchSuccess({ success: true });
      const mockStore = createMockStore({ roomCode: 'ABCD', players: {} });
      const ctx = createMockCtx({ store: mockStore as unknown as SeatActionsContext['store'] });

      await expect(takeSeat(ctx, 2, { displayName: 'Alice' })).rejects.toThrow(
        'Successful RoomCommandResult must contain snapshot',
      );

      expect(mockStore.applySnapshot).not.toHaveBeenCalled();
    });

    it('should NOT crash when ctx has no store', async () => {
      const state = buildApiTestState({ roomCode: 'X' });
      global.fetch = mockFetchSuccess(buildApiCommandSuccess(state));
      const ctx = createMockCtx(); // no store

      const result = await takeSeat(ctx, 2, { displayName: 'Alice' });

      expect(result).toEqual({ success: true });
    });

    it('should call store.applySnapshot on leaveSeat response', async () => {
      const mockState = buildApiTestState();
      global.fetch = mockFetchSuccess(buildApiCommandSuccess(mockState, 3));
      const mockStore = createMockStore({
        roomCode: 'ABCD',
        players: { 1: { userId: 'test-uid', seat: 1 } },
      });
      const ctx = createMockCtx({ store: mockStore as unknown as SeatActionsContext['store'] });

      await leaveSeat(ctx);

      expect(mockStore.applySnapshot).toHaveBeenCalledWith(mockState, 3);
    });
  });
});
