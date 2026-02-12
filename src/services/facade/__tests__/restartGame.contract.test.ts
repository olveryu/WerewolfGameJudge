/**
 * restartGame 行为契约测试
 *
 * PR9: 对齐 v1 行为
 *
 * 验收标准：
 * 1. 广播顺序：先 GAME_RESTARTED，再 STATE_UPDATE
 * 2. 状态重置：
 *    - status → 'seated'（不是 'unseated'）
 *    - players 保留，但 role/hasViewedRole 清除
 *    - 夜晚状态清除（actions, wolfVotes, currentStepId, etc.）
 * 3. 权限检查：仅 Host 可调用
 */

import { gameReducer } from '@/services/engine/reducer/gameReducer';
import type { PlayerJoinAction } from '@/services/engine/reducer/types';
import { GameStore } from '@/services/engine/store';
import { GameFacade } from '@/services/facade/GameFacade';
import type { BroadcastPlayer, HostBroadcast } from '@/services/protocol/types';

// Mock BroadcastService (constructor mock — DI 测试直接注入，此处仅防止真实 import)
jest.mock('../../transport/BroadcastService', () => ({
  BroadcastService: jest.fn().mockImplementation(() => ({})),
}));

// P0-1: Mock AudioService
jest.mock('../../infra/AudioService', () => ({
  __esModule: true,
  AudioService: jest.fn(() => ({
    playNightAudio: jest.fn().mockResolvedValue(undefined),
    playNightEndAudio: jest.fn().mockResolvedValue(undefined),
    playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
    playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
    preloadForRoles: jest.fn().mockResolvedValue(undefined),
    clearPreloaded: jest.fn(),
    cleanup: jest.fn(),
  })),
}));

describe('restartGame Contract', () => {
  let facade: GameFacade;
  let mockBroadcastService: {
    joinRoom: jest.Mock;
    broadcastAsHost: jest.Mock;
    sendToHost: jest.Mock;
    leaveRoom: jest.Mock;
    markAsLive: jest.Mock;
  };
  let broadcastCalls: HostBroadcast[] = [];

  const mockTemplate = {
    id: 'test-template',
    name: 'Test Template',
    numberOfPlayers: 4,
    roles: ['wolf', 'wolf', 'seer', 'villager'] as ('wolf' | 'seer' | 'villager')[],
  };

  beforeEach(() => {
    // 使用 fake timers 加速 5 秒音频延迟
    jest.useFakeTimers();

    broadcastCalls = [];

    mockBroadcastService = {
      joinRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn((msg: HostBroadcast) => {
        broadcastCalls.push(msg);
        return Promise.resolve();
      }),
      sendToHost: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      markAsLive: jest.fn(),
    };

    // DI: 直接注入 mock
    facade = new GameFacade({
      store: new GameStore(),
      broadcastService: mockBroadcastService as any,
      audioService: {
        playNightAudio: jest.fn().mockResolvedValue(undefined),
        playNightEndAudio: jest.fn().mockResolvedValue(undefined),
        playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
        playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
        preloadForRoles: jest.fn().mockResolvedValue(undefined),
        clearPreloaded: jest.fn(),
        cleanup: jest.fn(),
      } as any,
      hostStateCache: {
        saveState: jest.fn(),
        loadState: jest.fn().mockResolvedValue(null),
        getState: jest.fn().mockReturnValue(null),
        clearState: jest.fn(),
      } as any,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ===========================================================================
  // Helper: 通过 reducer 填充所有座位（避免直接修改 state）
  // ===========================================================================

  function fillAllSeatsViaReducer(): void {
    let state = facade.getState()!;

    for (let i = 0; i < mockTemplate.numberOfPlayers; i++) {
      const player: BroadcastPlayer = {
        uid: i === 0 ? 'host-uid' : `player-${i}`,
        seatNumber: i,
        displayName: `Player ${i}`,
        avatarUrl: undefined,
        role: null,
        hasViewedRole: false,
      };

      const action: PlayerJoinAction = {
        type: 'PLAYER_JOIN',
        payload: { seat: i, player },
      };

      state = gameReducer(state, action);
    }

    // 写回 store（test-only: 访问私有 store）
    (facade as any).store.setState(state);
  }

  // ===========================================================================
  // Helper: 初始化到 ongoing 状态
  // ===========================================================================

  async function setupToOngoingState(): Promise<void> {
    // 1. 初始化 Host
    await facade.initializeAsHost('1234', 'host-uid', mockTemplate);

    // 2. 通过 reducer 填充所有座位（避免直接修改 state）
    fillAllSeatsViaReducer();

    // 3. 分配角色
    await facade.assignRoles();

    // 4. 标记所有人已看牌
    for (let i = 0; i < mockTemplate.numberOfPlayers; i++) {
      await facade.markViewedRole(i);
    }

    // 5. 开始游戏（使用 runAllTimersAsync 加速 5 秒音频延迟）
    const startNightPromise = facade.startNight();
    await jest.runAllTimersAsync();
    await startNightPromise;

    // 清除之前的广播记录
    broadcastCalls = [];
  }

  // ===========================================================================
  // 契约测试
  // ===========================================================================

  describe('Broadcast Order', () => {
    it('should broadcast GAME_RESTARTED before STATE_UPDATE', async () => {
      await setupToOngoingState();

      // 验证当前状态是 ongoing
      expect(facade.getState()?.status).toBe('ongoing');

      // 调用 restartGame
      const result = await facade.restartGame();
      expect(result.success).toBe(true);

      // 验证广播顺序
      expect(broadcastCalls.length).toBeGreaterThanOrEqual(2);
      expect(broadcastCalls[0].type).toBe('GAME_RESTARTED');
      expect(broadcastCalls[1].type).toBe('STATE_UPDATE');
    });
  });

  describe('State Reset', () => {
    it('should reset status to "seated" (not "unseated")', async () => {
      await setupToOngoingState();

      await facade.restartGame();

      const state = facade.getState()!;
      expect(state.status).toBe('seated');
    });

    it('should keep players but clear roles and hasViewedRole', async () => {
      await setupToOngoingState();

      // 验证重置前有角色
      const stateBefore = facade.getState()!;
      expect(stateBefore.players[0]?.role).not.toBeNull();
      expect(stateBefore.players[0]?.hasViewedRole).toBe(true);

      await facade.restartGame();

      const stateAfter = facade.getState()!;
      // 玩家仍然存在
      expect(stateAfter.players[0]).not.toBeNull();
      expect(stateAfter.players[0]?.uid).toBe('host-uid');
      // 但角色已清除
      expect(stateAfter.players[0]?.role).toBeNull();
      expect(stateAfter.players[0]?.hasViewedRole).toBe(false);
    });

    it('should clear night state fields', async () => {
      await setupToOngoingState();

      await facade.restartGame();

      const state = facade.getState()!;
      expect(state.currentStepId).toBeUndefined();
      expect(state.actions).toBeUndefined();
      expect(state.currentNightResults).toBeUndefined();
      expect(state.witchContext).toBeUndefined();
      expect(state.seerReveal).toBeUndefined();
      expect(state.psychicReveal).toBeUndefined();
      expect(state.confirmStatus).toBeUndefined();
      expect(state.isAudioPlaying).toBe(false);
    });

    it('should reset currentStepIndex to 0', async () => {
      await setupToOngoingState();

      await facade.restartGame();

      const state = facade.getState()!;
      expect(state.currentStepIndex).toBe(0);
    });
  });

  describe('Permission Check', () => {
    it('should reject non-host calls', async () => {
      await setupToOngoingState();

      // 模拟变成非 Host
      (facade as unknown as { isHost: boolean }).isHost = false;

      const result = await facade.restartGame();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('host_only');
    });

    it('should allow host calls', async () => {
      await setupToOngoingState();

      const result = await facade.restartGame();

      expect(result.success).toBe(true);
    });
  });

  describe('Broadcast Content', () => {
    it('should broadcast STATE_UPDATE with reset state', async () => {
      await setupToOngoingState();

      await facade.restartGame();

      const stateUpdate = broadcastCalls.find((c) => c.type === 'STATE_UPDATE');
      expect(stateUpdate).toBeDefined();

      if (stateUpdate?.type === 'STATE_UPDATE') {
        expect(stateUpdate.state.status).toBe('seated');
        expect(stateUpdate.state.players[0]?.role).toBeNull();
        expect(stateUpdate.revision).toBeGreaterThan(0);
      }
    });
  });

  describe('Idempotency', () => {
    it('should be callable multiple times without error', async () => {
      await setupToOngoingState();

      const result1 = await facade.restartGame();
      expect(result1.success).toBe(true);

      const result2 = await facade.restartGame();
      expect(result2.success).toBe(true);

      const state = facade.getState()!;
      expect(state.status).toBe('seated');
    });
  });
});
