/**
 * messageRouter Unit Tests
 *
 * 测试 PlayerMessage/HostBroadcast 路由分发的具体行为：
 * - Host 端：SEAT_ACTION_REQUEST 处理 → 入座/离座 → 发送 ACK
 * - Player 端：STATE_UPDATE 应用 → SEAT_ACTION_ACK 解析 pending promise
 * - 守卫：non-host / non-player 不处理
 *
 * 与 playerMessageRouterCoverage.contract.test.ts 的区别：
 * - contract test 验证"所有 type 都有 case"（覆盖性 + 不 throw）
 * - 本文件验证"每个 case 的具体行为正确"（功能性）
 *
 * ✅ 使用真实 handler + reducer（纯函数），只 mock IO 依赖
 */

import type { MessageRouterContext } from '@/services/facade/messageRouter';
import {
  hostHandlePlayerMessage,
  playerHandleHostBroadcast,
} from '@/services/facade/messageRouter';
import type { PendingSeatAction } from '@/services/facade/seatActions';
import { REASON_INVALID_ACTION, REASON_SEAT_TAKEN } from '@/services/protocol/reasonCodes';
import type { BroadcastGameState, HostBroadcast, PlayerMessage } from '@/services/protocol/types';
import { facadeLog } from '@/utils/logger';

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

function createMockRouterCtx(overrides?: Partial<MessageRouterContext>): MessageRouterContext {
  const state = createTestState();
  const mockStore = {
    getState: jest.fn(() => state),
    setState: jest.fn(),
    getRevision: jest.fn(() => 0),
    dispatch: jest.fn(),
    applySnapshot: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    destroy: jest.fn(),
  };

  return {
    store: mockStore as unknown as MessageRouterContext['store'],
    broadcastService: {
      broadcastAsHost: jest.fn(() => Promise.resolve()),
      sendToHost: jest.fn(() => Promise.resolve()),
      markAsLive: jest.fn(),
    } as unknown as MessageRouterContext['broadcastService'],
    isHost: true,
    myUid: 'host-uid',
    getMySeatNumber: jest.fn(() => null),
    broadcastCurrentState: jest.fn(() => Promise.resolve()),
    findSeatByUid: jest.fn(() => null),
    generateRequestId: jest.fn(() => 'mock-req-id'),
    handleViewedRole: jest.fn(() => Promise.resolve({ success: true })),
    handleAction: jest.fn(() => Promise.resolve({ success: true })),
    handleWolfVote: jest.fn(() => Promise.resolve({ success: true })),
    handleRevealAck: jest.fn(() => Promise.resolve({ success: true })),
    handleWolfRobotHunterStatusViewed: jest.fn(() => Promise.resolve({ success: true })),
    ...overrides,
  };
}

function createPendingRef(): { current: PendingSeatAction | null } {
  return { current: null };
}

// =============================================================================
// Host: SEAT_ACTION_REQUEST handling
// =============================================================================

describe('messageRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Host: SEAT_ACTION_REQUEST', () => {
    it('should send success ACK when sit succeeds', async () => {
      const ctx = createMockRouterCtx();
      const msg: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-1',
        action: 'sit',
        seat: 0,
        uid: 'player-uid',
        displayName: 'Alice',
      };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(ctx.broadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SEAT_ACTION_ACK',
          requestId: 'req-1',
          toUid: 'player-uid',
          success: true,
          seat: 0,
        }),
      );
    });

    it('should update store with player data on successful sit', async () => {
      const ctx = createMockRouterCtx();
      const msg: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-1',
        action: 'sit',
        seat: 1,
        uid: 'player-uid',
        displayName: 'Bob',
        avatarUrl: 'https://avatar.url',
      };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(ctx.store.setState).toHaveBeenCalled();
      const newState = (ctx.store.setState as jest.Mock).mock.calls[0][0] as BroadcastGameState;
      expect(newState.players[1]).toMatchObject({
        uid: 'player-uid',
        displayName: 'Bob',
        avatarUrl: 'https://avatar.url',
      });
    });

    it('should send failure ACK when seat is taken', async () => {
      const state = createTestState({
        players: {
          0: { uid: 'existing', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockRouterCtx({
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
          getRevision: jest.fn(() => 0),
          applySnapshot: jest.fn(),
          subscribe: jest.fn(() => jest.fn()),
          destroy: jest.fn(),
          dispatch: jest.fn(),
        } as unknown as MessageRouterContext['store'],
      });
      const msg: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-2',
        action: 'sit',
        seat: 0,
        uid: 'new-player',
        displayName: 'Charlie',
      };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(ctx.broadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SEAT_ACTION_ACK',
          requestId: 'req-2',
          toUid: 'new-player',
          success: false,
          reason: REASON_SEAT_TAKEN,
        }),
      );
    });

    it('should send success ACK when standup succeeds', async () => {
      const state = createTestState({
        players: {
          0: { uid: 'player-uid', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const ctx = createMockRouterCtx({
        store: {
          getState: jest.fn(() => state),
          setState: jest.fn(),
          getRevision: jest.fn(() => 0),
          applySnapshot: jest.fn(),
          subscribe: jest.fn(() => jest.fn()),
          destroy: jest.fn(),
          dispatch: jest.fn(),
        } as unknown as MessageRouterContext['store'],
        findSeatByUid: jest.fn(() => 0),
      });
      const msg: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-3',
        action: 'standup',
        seat: 0,
        uid: 'player-uid',
      };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(ctx.broadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SEAT_ACTION_ACK',
          requestId: 'req-3',
          toUid: 'player-uid',
          success: true,
        }),
      );
    });

    it('should not process when not host', async () => {
      const ctx = createMockRouterCtx({ isHost: false });
      const msg: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-1',
        action: 'sit',
        seat: 0,
        uid: 'player-uid',
      };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(ctx.broadcastService.broadcastAsHost).not.toHaveBeenCalled();
      expect(ctx.store.setState).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Player: STATE_UPDATE handling
  // =============================================================================

  describe('Player: STATE_UPDATE', () => {
    it('should apply snapshot and mark as live', () => {
      const ctx = createMockRouterCtx({ isHost: false });
      const newState = createTestState({ roomCode: 'ROOM' });
      const msg: HostBroadcast = {
        type: 'STATE_UPDATE',
        state: newState,
        revision: 5,
      };
      const pendingRef = createPendingRef();

      playerHandleHostBroadcast(ctx, msg, pendingRef);

      expect(ctx.store.applySnapshot).toHaveBeenCalledWith(newState, 5);
      expect(ctx.broadcastService.markAsLive).toHaveBeenCalled();
    });

    it('should warn on dual host detection', () => {
      const currentState = createTestState({ hostUid: 'host-A' });
      const ctx = createMockRouterCtx({
        isHost: false,
        store: {
          getState: jest.fn(() => currentState),
          applySnapshot: jest.fn(),
          getRevision: jest.fn(() => 0),
          setState: jest.fn(),
          subscribe: jest.fn(() => jest.fn()),
          destroy: jest.fn(),
          dispatch: jest.fn(),
        } as unknown as MessageRouterContext['store'],
      });
      const newState = createTestState({ hostUid: 'host-B' });
      const msg: HostBroadcast = {
        type: 'STATE_UPDATE',
        state: newState,
        revision: 1,
      };
      const pendingRef = createPendingRef();

      playerHandleHostBroadcast(ctx, msg, pendingRef);

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[DUAL_HOST_DETECTED] Received STATE_UPDATE from different hostUid',
        expect.objectContaining({
          knownHostUid: 'host-A',
          receivedHostUid: 'host-B',
        }),
      );
      // Should still apply snapshot
      expect(ctx.store.applySnapshot).toHaveBeenCalled();
    });

    it('should not handle STATE_UPDATE when is host', () => {
      const ctx = createMockRouterCtx({ isHost: true });
      const msg: HostBroadcast = {
        type: 'STATE_UPDATE',
        state: createTestState(),
        revision: 1,
      };
      const pendingRef = createPendingRef();

      playerHandleHostBroadcast(ctx, msg, pendingRef);

      expect(ctx.store.applySnapshot).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Player: SEAT_ACTION_ACK handling
  // =============================================================================

  describe('Player: SEAT_ACTION_ACK', () => {
    it('should resolve pending promise on matching ACK', () => {
      const ctx = createMockRouterCtx({ isHost: false, myUid: 'player-uid' });
      const resolveHandler = jest.fn();
      const pendingRef: { current: PendingSeatAction | null } = {
        current: {
          requestId: 'req-1',
          resolve: resolveHandler,
          reject: jest.fn(),
          timeoutHandle: setTimeout(() => {}, 60000),
        },
      };

      const msg: HostBroadcast = {
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-1',
        toUid: 'player-uid',
        success: true,
        seat: 0,
      };

      playerHandleHostBroadcast(ctx, msg, pendingRef);

      expect(resolveHandler).toHaveBeenCalledWith({ success: true, reason: undefined });
      expect(pendingRef.current).toBeNull();

      clearTimeout(pendingRef.current as unknown as ReturnType<typeof setTimeout>);
    });

    it('should resolve with reason on failed ACK', () => {
      const ctx = createMockRouterCtx({ isHost: false, myUid: 'player-uid' });
      const resolveHandler = jest.fn();
      const timeoutHandle = setTimeout(() => {}, 60000);
      const pendingRef: { current: PendingSeatAction | null } = {
        current: {
          requestId: 'req-1',
          resolve: resolveHandler,
          reject: jest.fn(),
          timeoutHandle,
        },
      };

      const msg: HostBroadcast = {
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-1',
        toUid: 'player-uid',
        success: false,
        seat: 0,
        reason: REASON_SEAT_TAKEN,
      };

      playerHandleHostBroadcast(ctx, msg, pendingRef);

      expect(resolveHandler).toHaveBeenCalledWith({
        success: false,
        reason: REASON_SEAT_TAKEN,
      });

      clearTimeout(timeoutHandle);
    });

    it('should ignore ACK for different toUid', () => {
      const ctx = createMockRouterCtx({ isHost: false, myUid: 'player-uid' });
      const resolveHandler = jest.fn();
      const timeoutHandle = setTimeout(() => {}, 60000);
      const pendingRef: { current: PendingSeatAction | null } = {
        current: {
          requestId: 'req-1',
          resolve: resolveHandler,
          reject: jest.fn(),
          timeoutHandle,
        },
      };

      const msg: HostBroadcast = {
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-1',
        toUid: 'other-player',
        success: true,
        seat: 0,
      };

      playerHandleHostBroadcast(ctx, msg, pendingRef);

      expect(resolveHandler).not.toHaveBeenCalled();
      expect(pendingRef.current).not.toBeNull();

      clearTimeout(timeoutHandle);
    });

    it('should warn on mismatched requestId', () => {
      const ctx = createMockRouterCtx({ isHost: false, myUid: 'player-uid' });
      const resolveHandler = jest.fn();
      const timeoutHandle = setTimeout(() => {}, 60000);
      const pendingRef: { current: PendingSeatAction | null } = {
        current: {
          requestId: 'req-1',
          resolve: resolveHandler,
          reject: jest.fn(),
          timeoutHandle,
        },
      };

      const msg: HostBroadcast = {
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-WRONG',
        toUid: 'player-uid',
        success: true,
        seat: 0,
      };

      playerHandleHostBroadcast(ctx, msg, pendingRef);

      expect(resolveHandler).not.toHaveBeenCalled();
      expect(facadeLog.warn).toHaveBeenCalledWith(
        'Received ACK for unknown request',
        expect.objectContaining({ requestId: 'req-WRONG' }),
      );

      clearTimeout(timeoutHandle);
    });

    it('should ignore ACK when no pending action', () => {
      const ctx = createMockRouterCtx({ isHost: false, myUid: 'player-uid' });
      const pendingRef = createPendingRef();

      const msg: HostBroadcast = {
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-1',
        toUid: 'player-uid',
        success: true,
        seat: 0,
      };

      // Should not throw
      playerHandleHostBroadcast(ctx, msg, pendingRef);
    });
  });
});
