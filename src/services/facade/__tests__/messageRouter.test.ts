/**
 * messageRouter Unit Tests (HTTP API 迁移后)
 *
 * 测试 PlayerMessage/HostBroadcast 路由分发的具体行为：
 * - Host 端：REQUEST_STATE / ACTION / WOLF_VOTE / VIEWED_ROLE 等
 * - Player 端：STATE_UPDATE 应用 → applySnapshot
 * - 守卫：non-host / non-player 不处理
 *
 * 注意：SEAT_ACTION_REQUEST/ACK 已迁移至 HTTP API，不再经过 router
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
    broadcastCurrentState: jest.fn(() => Promise.resolve()),
    handleRevealAck: jest.fn(() => Promise.resolve({ success: true })),
    handleWolfRobotHunterStatusViewed: jest.fn(() => Promise.resolve({ success: true })),
    ...overrides,
  };
}

// =============================================================================
// Player: STATE_UPDATE handling
// =============================================================================

describe('messageRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Player: STATE_UPDATE', () => {
    it('should apply snapshot and mark as live', () => {
      const ctx = createMockRouterCtx({ isHost: false });
      const newState = createTestState({ roomCode: 'ROOM' });
      const msg: HostBroadcast = {
        type: 'STATE_UPDATE',
        state: newState,
        revision: 5,
      };

      playerHandleHostBroadcast(ctx, msg);

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

      playerHandleHostBroadcast(ctx, msg);

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

      playerHandleHostBroadcast(ctx, msg);

      expect(ctx.store.applySnapshot).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Host: REQUEST_STATE handling
  // =============================================================================

  describe('Host: REQUEST_STATE', () => {
    it('should call broadcastCurrentState', async () => {
      const ctx = createMockRouterCtx();
      const msg: PlayerMessage = { type: 'REQUEST_STATE', uid: 'player-uid' };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(ctx.broadcastCurrentState).toHaveBeenCalled();
    });

    it('should not process when not host', async () => {
      const ctx = createMockRouterCtx({ isHost: false });
      const msg: PlayerMessage = { type: 'REQUEST_STATE', uid: 'player-uid' };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(ctx.broadcastCurrentState).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Host: Legacy JOIN/LEAVE (should warn)
  // =============================================================================

  describe('Host: Legacy JOIN/LEAVE', () => {
    it('JOIN should trigger facadeLog.warn with HTTP API guidance', async () => {
      const ctx = createMockRouterCtx();
      const msg: PlayerMessage = {
        type: 'JOIN',
        seat: 0,
        uid: 'player-uid',
        displayName: 'Player',
      };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[messageRouter] Legacy PlayerMessage type received',
        expect.objectContaining({
          type: 'JOIN',
          guidance: expect.stringContaining('HTTP API'),
        }),
      );
    });

    it('LEAVE should trigger facadeLog.warn with HTTP API guidance', async () => {
      const ctx = createMockRouterCtx();
      const msg: PlayerMessage = {
        type: 'LEAVE',
        seat: 0,
        uid: 'player-uid',
      };

      await hostHandlePlayerMessage(ctx, msg, 'sender');

      expect(facadeLog.warn).toHaveBeenCalledWith(
        '[messageRouter] Legacy PlayerMessage type received',
        expect.objectContaining({
          type: 'LEAVE',
          guidance: expect.stringContaining('HTTP API'),
        }),
      );
    });
  });
});
