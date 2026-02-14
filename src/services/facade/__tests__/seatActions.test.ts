/**
 * seatActions Unit Tests (HTTP API 版本)
 *
 * 测试座位操作编排层（迁移后）：
 * - 统一 HTTP API 调用（Host / Player 不再有区别）
 * - takeSeat / takeSeatWithAck → fetch POST /api/game/seat
 * - leaveSeat / leaveSeatWithAck → fetch POST /api/game/seat
 * - NOT_CONNECTED guard（无 roomCode / uid 时）
 * - NETWORK_ERROR 处理
 *
 * ✅ mock `fetch`（HTTP 调用），只验证编排逻辑
 * ❌ 不 mock handler（服务端逻辑不在此处）
 */

import type { SeatActionsContext } from '@/services/facade/seatActions';
import {
  leaveSeat,
  leaveSeatWithAck,
  takeSeat,
  takeSeatWithAck,
} from '@/services/facade/seatActions';

jest.mock('../../../utils/logger', () => ({
  facadeLog: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockCtx(overrides?: Partial<SeatActionsContext>): SeatActionsContext {
  return {
    myUid: 'test-uid',
    getRoomCode: () => 'ABCD',
    ...overrides,
  };
}

/** 创建 mock fetch response */
function mockFetchSuccess(body: Record<string, unknown> = { success: true }): jest.Mock {
  return jest.fn().mockResolvedValue({
    json: () => Promise.resolve(body),
  });
}

function mockFetchFailure(reason: string): jest.Mock {
  return jest.fn().mockResolvedValue({
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
  // takeSeatWithAck
  // ===========================================================================

  describe('takeSeatWithAck', () => {
    it('should call fetch with correct params', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      const result = await takeSeatWithAck(ctx, 2, 'Alice', 'https://avatar.url');

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/seat'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: 'ABCD',
            action: 'sit',
            uid: 'test-uid',
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

      const result = await takeSeatWithAck(ctx, 0, 'Alice');

      expect(result).toEqual({ success: false, reason: 'seat_taken' });
    });

    it('should return NOT_CONNECTED when roomCode is null', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx({ getRoomCode: () => null });

      const result = await takeSeatWithAck(ctx, 0, 'Alice');

      expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return NOT_CONNECTED when myUid is null', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx({ myUid: null });

      const result = await takeSeatWithAck(ctx, 0, 'Alice');

      expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return NETWORK_ERROR on fetch failure', async () => {
      global.fetch = mockFetchNetworkError();
      const ctx = createMockCtx();

      const result = await takeSeatWithAck(ctx, 0, 'Alice');

      expect(result).toEqual({ success: false, reason: 'NETWORK_ERROR' });
    });

    it('should handle game_in_progress reason', async () => {
      global.fetch = mockFetchFailure('game_in_progress');
      const ctx = createMockCtx();

      const result = await takeSeatWithAck(ctx, 0, 'Alice');

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should handle invalid_seat reason', async () => {
      global.fetch = mockFetchFailure('invalid_seat');
      const ctx = createMockCtx();

      const result = await takeSeatWithAck(ctx, 999, 'Alice');

      expect(result).toEqual({ success: false, reason: 'invalid_seat' });
    });

    it('should omit displayName and avatarUrl when not provided', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      await takeSeatWithAck(ctx, 1);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.displayName).toBeUndefined();
      expect(body.avatarUrl).toBeUndefined();
    });
  });

  // ===========================================================================
  // takeSeat (boolean wrapper)
  // ===========================================================================

  describe('takeSeat', () => {
    it('should return true on success', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      const result = await takeSeat(ctx, 0, 'Alice');

      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      global.fetch = mockFetchFailure('seat_taken');
      const ctx = createMockCtx();

      const result = await takeSeat(ctx, 0, 'Alice');

      expect(result).toBe(false);
    });

    it('should return false on NOT_CONNECTED', async () => {
      const ctx = createMockCtx({ getRoomCode: () => null });

      const result = await takeSeat(ctx, 0, 'Alice');

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // leaveSeatWithAck
  // ===========================================================================

  describe('leaveSeatWithAck', () => {
    it('should call fetch with standup action', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      const result = await leaveSeatWithAck(ctx);

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/seat'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            roomCode: 'ABCD',
            action: 'standup',
            uid: 'test-uid',
          }),
        }),
      );
    });

    it('should return reason on server rejection', async () => {
      global.fetch = mockFetchFailure('game_in_progress');
      const ctx = createMockCtx();

      const result = await leaveSeatWithAck(ctx);

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should return NOT_CONNECTED when roomCode is null', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx({ getRoomCode: () => null });

      const result = await leaveSeatWithAck(ctx);

      expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return NETWORK_ERROR on fetch failure', async () => {
      global.fetch = mockFetchNetworkError();
      const ctx = createMockCtx();

      const result = await leaveSeatWithAck(ctx);

      expect(result).toEqual({ success: false, reason: 'NETWORK_ERROR' });
    });
  });

  // ===========================================================================
  // leaveSeat (boolean wrapper)
  // ===========================================================================

  describe('leaveSeat', () => {
    it('should return true on success', async () => {
      global.fetch = mockFetchSuccess();
      const ctx = createMockCtx();

      const result = await leaveSeat(ctx);

      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      global.fetch = mockFetchFailure('not_seated');
      const ctx = createMockCtx();

      const result = await leaveSeat(ctx);

      expect(result).toBe(false);
    });
  });
});
