/**
 * seatActions Unit Tests
 *
 * 测试座位操作编排层：
 * - Host 路径：handler → reducer → store → broadcast
 * - Player 路径：broadcast request → ACK/timeout 处理
 * - 公共 API 路由（Host vs Player）
 *
 * ✅ 使用真实 handler 和 reducer（纯函数），只 mock IO 依赖
 * ❌ 不 mock handler（seatHandler.test.ts 已独立测试纯函数逻辑）
 */

import {
  hostProcessJoinSeat,
  hostProcessLeaveMySeat,
  leaveSeat,
  leaveSeatWithAck,
  type PendingSeatAction,
  playerSendSeatActionWithAck,
  type SeatActionsContext,
  takeSeat,
  takeSeatWithAck,
} from '@/services/facade/seatActions';
import {
  REASON_GAME_IN_PROGRESS,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_SEATED,
  REASON_SEAT_TAKEN,
  REASON_TIMEOUT,
} from '@/services/protocol/reasonCodes';
import type { BroadcastGameState } from '@/services/protocol/types';

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

function createTestState(overrides?: Partial<BroadcastGameState>): BroadcastGameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-uid',
    status: 'unseated',
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    ...overrides,
  } as BroadcastGameState;
}

function createMockCtx(overrides?: Partial<SeatActionsContext>): SeatActionsContext {
  const state = createTestState();
  return {
    store: {
      getState: jest.fn(() => state),
      setState: jest.fn(),
    } as unknown as SeatActionsContext['store'],
    broadcastService: {
      sendToHost: jest.fn(() => Promise.resolve()),
      broadcastAsHost: jest.fn(() => Promise.resolve()),
    } as unknown as SeatActionsContext['broadcastService'],
    isHost: true,
    myUid: 'host-uid',
    getMySeatNumber: jest.fn(() => null),
    broadcastCurrentState: jest.fn(() => Promise.resolve()),
    findSeatByUid: jest.fn(() => null),
    generateRequestId: jest.fn(() => 'test-req-id'),
    ...overrides,
  };
}

function createPendingRef(): { current: PendingSeatAction | null } {
  return { current: null };
}

// =============================================================================
// Host Path
// =============================================================================

describe('seatActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hostProcessJoinSeat', () => {
    it('should succeed when seat is available', () => {
      const ctx = createMockCtx();

      const result = hostProcessJoinSeat(ctx, 0, 'player-1', 'Alice');

      expect(result.success).toBe(true);
      expect(ctx.store.setState).toHaveBeenCalled();
      expect(ctx.broadcastCurrentState).toHaveBeenCalled();
    });

    it('should update store with player at correct seat', () => {
      const ctx = createMockCtx();

      hostProcessJoinSeat(ctx, 1, 'player-1', 'Alice', 'https://avatar.url');

      const newState = (ctx.store.setState as jest.Mock).mock.calls[0][0] as BroadcastGameState;
      expect(newState.players[1]).toMatchObject({
        uid: 'player-1',
        seatNumber: 1,
        displayName: 'Alice',
        avatarUrl: 'https://avatar.url',
      });
    });

    it('should fail when seat is taken by another player', () => {
      const state = createTestState({
        players: {
          0: { uid: 'other', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockCtx({
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });

      const result = hostProcessJoinSeat(ctx, 0, 'player-1', 'Alice');

      expect(result.success).toBe(false);
      expect(result.reason).toBe(REASON_SEAT_TAKEN);
      expect(ctx.store.setState).not.toHaveBeenCalled();
      // Still broadcasts to sync state on failure
      expect(ctx.broadcastCurrentState).toHaveBeenCalled();
    });

    it('should fail when state is null', () => {
      const ctx = createMockCtx({
        store: {
          getState: jest.fn(() => null),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });

      const result = hostProcessJoinSeat(ctx, 0, 'player-1', 'Alice');

      expect(result.success).toBe(false);
    });

    it('should fail when uid is null', () => {
      const ctx = createMockCtx();

      const result = hostProcessJoinSeat(ctx, 0, null, 'Alice');

      expect(result.success).toBe(false);
      expect(result.reason).toBe(REASON_NOT_AUTHENTICATED);
    });

    it('should fail when game is in progress', () => {
      const state = createTestState({ status: 'ongoing' });
      const ctx = createMockCtx({
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });

      const result = hostProcessJoinSeat(ctx, 0, 'player-1', 'Alice');

      expect(result.success).toBe(false);
      expect(result.reason).toBe(REASON_GAME_IN_PROGRESS);
    });

    it('should handle seat switching (leave old seat, join new)', () => {
      const state = createTestState({
        players: {
          0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockCtx({
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });

      const result = hostProcessJoinSeat(ctx, 1, 'player-1', 'Alice');

      expect(result.success).toBe(true);
      const newState = (ctx.store.setState as jest.Mock).mock.calls[0][0] as BroadcastGameState;
      expect(newState.players[0]).toBeNull(); // old seat cleared
      expect(newState.players[1]).toMatchObject({ uid: 'player-1', seatNumber: 1 });
    });

    it('should allow re-sitting on the same seat (no-op join)', () => {
      const state = createTestState({
        players: {
          0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockCtx({
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });

      const result = hostProcessJoinSeat(ctx, 0, 'player-1', 'Alice');

      expect(result.success).toBe(true);
    });
  });

  describe('hostProcessLeaveMySeat', () => {
    it('should succeed when player is seated', () => {
      const state = createTestState({
        players: {
          0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockCtx({
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
        findSeatByUid: jest.fn(() => 0),
      });

      const result = hostProcessLeaveMySeat(ctx, 'player-1');

      expect(result.success).toBe(true);
      expect(ctx.store.setState).toHaveBeenCalled();
      const newState = (ctx.store.setState as jest.Mock).mock.calls[0][0] as BroadcastGameState;
      expect(newState.players[0]).toBeNull();
      expect(ctx.broadcastCurrentState).toHaveBeenCalled();
    });

    it('should fail when player is not seated', () => {
      const ctx = createMockCtx({
        findSeatByUid: jest.fn(() => null),
      });

      const result = hostProcessLeaveMySeat(ctx, 'player-1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe(REASON_NOT_SEATED);
    });

    it('should fail when uid is empty', () => {
      const ctx = createMockCtx();

      const result = hostProcessLeaveMySeat(ctx, '');

      expect(result.success).toBe(false);
      expect(result.reason).toBe(REASON_NOT_AUTHENTICATED);
    });

    it('should broadcast on failure too', () => {
      const ctx = createMockCtx({
        findSeatByUid: jest.fn(() => null),
      });

      hostProcessLeaveMySeat(ctx, 'player-1');

      expect(ctx.broadcastCurrentState).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Player Path
  // =============================================================================

  describe('playerSendSeatActionWithAck', () => {
    it('should send correct SEAT_ACTION_REQUEST message', async () => {
      const ctx = createMockCtx({ isHost: false, myUid: 'player-1' });
      const pendingRef = createPendingRef();

      const promise = playerSendSeatActionWithAck(
        ctx,
        'sit',
        2,
        pendingRef,
        'Alice',
        'https://avatar.url',
      );

      expect(ctx.broadcastService.sendToHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SEAT_ACTION_REQUEST',
          requestId: 'test-req-id',
          action: 'sit',
          seat: 2,
          uid: 'player-1',
          displayName: 'Alice',
          avatarUrl: 'https://avatar.url',
        }),
      );

      // Clean up: resolve pending
      pendingRef.current!.resolve({ success: true });
      await promise;
    });

    it('should create pending action with correct requestId', async () => {
      const ctx = createMockCtx({ isHost: false, myUid: 'player-1' });
      const pendingRef = createPendingRef();

      const promise = playerSendSeatActionWithAck(ctx, 'sit', 0, pendingRef);

      expect(pendingRef.current).not.toBeNull();
      expect(pendingRef.current!.requestId).toBe('test-req-id');

      pendingRef.current!.resolve({ success: true });
      await promise;
    });

    it('should timeout after 5 seconds with REASON_TIMEOUT', async () => {
      jest.useFakeTimers();
      try {
        const ctx = createMockCtx({ isHost: false, myUid: 'player-1' });
        const pendingRef = createPendingRef();

        const promise = playerSendSeatActionWithAck(ctx, 'sit', 0, pendingRef);

        await jest.advanceTimersByTimeAsync(5000);

        const result = await promise;

        expect(result).toEqual({ success: false, reason: REASON_TIMEOUT });
        expect(pendingRef.current).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('should send REQUEST_STATE for self-recovery after timeout', async () => {
      jest.useFakeTimers();
      try {
        const ctx = createMockCtx({ isHost: false, myUid: 'player-1' });
        const pendingRef = createPendingRef();

        const promise = playerSendSeatActionWithAck(ctx, 'sit', 0, pendingRef);

        await jest.advanceTimersByTimeAsync(5000);
        await promise;

        // sendToHost called twice: SEAT_ACTION_REQUEST + REQUEST_STATE
        expect(ctx.broadcastService.sendToHost).toHaveBeenCalledTimes(2);
        expect(ctx.broadcastService.sendToHost).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'REQUEST_STATE', uid: 'player-1' }),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('should cancel old pending request when new one arrives', async () => {
      const ctx = createMockCtx({
        isHost: false,
        myUid: 'player-1',
        generateRequestId: jest.fn(() => 'req-1'),
      });
      const pendingRef = createPendingRef();

      // First request
      const promise1 = playerSendSeatActionWithAck(ctx, 'sit', 0, pendingRef);
      expect(pendingRef.current!.requestId).toBe('req-1');

      // Second request overrides first
      (ctx.generateRequestId as jest.Mock).mockReturnValue('req-2');
      const promise2 = playerSendSeatActionWithAck(ctx, 'sit', 1, pendingRef);

      // First should resolve with CANCELLED
      const result1 = await promise1;
      expect(result1.success).toBe(false);

      // Second should still be pending
      expect(pendingRef.current!.requestId).toBe('req-2');

      // Clean up
      pendingRef.current!.resolve({ success: true });
      await promise2;
    });
  });

  // =============================================================================
  // Public API
  // =============================================================================

  describe('takeSeatWithAck', () => {
    it('should use host path when isHost=true', async () => {
      const ctx = createMockCtx({ isHost: true });
      const pendingRef = createPendingRef();

      const result = await takeSeatWithAck(ctx, pendingRef, 0, 'Alice');

      expect(result.success).toBe(true);
      expect(ctx.broadcastService.sendToHost).not.toHaveBeenCalled();
      expect(ctx.store.setState).toHaveBeenCalled();
    });

    it('should use player path when isHost=false', async () => {
      const ctx = createMockCtx({ isHost: false, myUid: 'player-1' });
      const pendingRef = createPendingRef();

      const promise = takeSeatWithAck(ctx, pendingRef, 0, 'Alice');

      expect(ctx.broadcastService.sendToHost).toHaveBeenCalled();

      pendingRef.current!.resolve({ success: true });
      const result = await promise;
      expect(result.success).toBe(true);
    });
  });

  describe('takeSeat', () => {
    it('should return true on success', async () => {
      const ctx = createMockCtx({ isHost: true });
      const pendingRef = createPendingRef();

      const result = await takeSeat(ctx, pendingRef, 0, 'Alice');

      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      const state = createTestState({
        players: {
          0: { uid: 'other', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockCtx({
        isHost: true,
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });
      const pendingRef = createPendingRef();

      const result = await takeSeat(ctx, pendingRef, 0, 'Alice');

      expect(result).toBe(false);
    });
  });

  describe('leaveSeatWithAck', () => {
    it('should use host path when isHost=true', async () => {
      const state = createTestState({
        players: {
          0: { uid: 'host-uid', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockCtx({
        isHost: true,
        findSeatByUid: jest.fn(() => 0),
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });
      const pendingRef = createPendingRef();

      const result = await leaveSeatWithAck(ctx, pendingRef);

      expect(result.success).toBe(true);
      expect(ctx.broadcastService.sendToHost).not.toHaveBeenCalled();
    });

    it('should use player path when isHost=false', async () => {
      const ctx = createMockCtx({ isHost: false, myUid: 'player-1' });
      const pendingRef = createPendingRef();

      const promise = leaveSeatWithAck(ctx, pendingRef);

      expect(ctx.broadcastService.sendToHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SEAT_ACTION_REQUEST',
          action: 'standup',
        }),
      );

      pendingRef.current!.resolve({ success: true });
      const result = await promise;
      expect(result.success).toBe(true);
    });
  });

  describe('leaveSeat', () => {
    it('should return true on success', async () => {
      const state = createTestState({
        players: {
          0: { uid: 'host-uid', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockCtx({
        isHost: true,
        findSeatByUid: jest.fn(() => 0),
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
        } as unknown as SeatActionsContext['store'],
      });
      const pendingRef = createPendingRef();

      const result = await leaveSeat(ctx, pendingRef);

      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      const ctx = createMockCtx({
        isHost: true,
        findSeatByUid: jest.fn(() => null),
      });
      const pendingRef = createPendingRef();

      const result = await leaveSeat(ctx, pendingRef);

      expect(result).toBe(false);
    });
  });
});
