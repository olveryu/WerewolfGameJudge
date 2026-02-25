/**
 * restartGame 行为契约测试（HTTP API — Phase 2 migration）
 *
 * Phase 2: restartGame 已迁移到 HTTP API
 *
 * 验收标准：
 * 1. 调用正确 API endpoint（/api/game/restart）
 * 2. 传递正确 request body（roomCode）
 * 3. 权限检查：仅 Host 可调用（facade-level gate）
 * 4. 返回 API 响应
 * 5. 网络错误处理
 * 6. 服务端负责状态重置，postgres_changes 推送新状态到所有客户端
 */

import { GameStore } from '@werewolf/game-engine/engine/store';

import { GameFacade } from '@/services/facade/GameFacade';

// Mock RealtimeService (constructor mock — DI 测试直接注入，此处仅防止真实 import)
jest.mock('../../transport/RealtimeService', () => ({
  RealtimeService: jest.fn().mockImplementation(() => ({})),
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
    stop: jest.fn(),
  })),
}));

describe('restartGame Contract (HTTP API)', () => {
  let facade: GameFacade;
  let mockRealtimeService: {
    joinRoom: jest.Mock;
    leaveRoom: jest.Mock;
    markAsLive: jest.Mock;
    addStatusListener: jest.Mock;
  };

  const originalFetch = global.fetch;

  const mockTemplate = {
    id: 'test-template',
    name: 'Test Template',
    numberOfPlayers: 4,
    roles: ['wolf', 'wolf', 'seer', 'villager'] as ('wolf' | 'seer' | 'villager')[],
  };

  beforeEach(async () => {
    mockRealtimeService = {
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      markAsLive: jest.fn(),
      addStatusListener: jest.fn().mockReturnValue(() => {}),
    };

    // DI: 直接注入 mock
    facade = new GameFacade({
      store: new GameStore(),
      realtimeService: mockRealtimeService as any,
      audioService: {
        playNightAudio: jest.fn().mockResolvedValue(undefined),
        playNightEndAudio: jest.fn().mockResolvedValue(undefined),
        playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
        playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
        preloadForRoles: jest.fn().mockResolvedValue(undefined),
        clearPreloaded: jest.fn(),
        cleanup: jest.fn(),
        stop: jest.fn(),
      } as any,
      roomService: {
        upsertGameState: jest.fn().mockResolvedValue(undefined),
        getGameState: jest.fn().mockResolvedValue(null),
      } as any,
    });

    await facade.createRoom('1234', 'host-uid', mockTemplate);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // API 调用测试
  // ===========================================================================

  describe('API Call', () => {
    it('should call /api/game/restart with roomCode', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      await facade.restartGame();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/restart'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"roomCode":"1234"'),
        }),
      );
    });

    it('should return success from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.restartGame();

      expect(result.success).toBe(true);
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'host_only' }),
      });

      const result = await facade.restartGame();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('host_only');
    });

    it('should be callable multiple times', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result1 = await facade.restartGame();
      expect(result1.success).toBe(true);

      const result2 = await facade.restartGame();
      expect(result2.success).toBe(true);
    });
  });

  // ===========================================================================
  // 权限检查（facade-level gate，不依赖 API）
  // ===========================================================================

  describe('Permission Check', () => {
    it('non-host calls are now rejected server-side (no client gate)', async () => {
      // Phase 7: 客户端不再做 isHost 门控，服务端通过 state.hostUid 校验拒绝
      (facade as unknown as { isHost: boolean }).isHost = false;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'forbidden' }),
      });

      const result = await facade.restartGame();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('forbidden');
      // API IS called — server handles permission check
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 网络错误处理
  // ===========================================================================

  describe('Network Error', () => {
    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await facade.restartGame();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NETWORK_ERROR');
    });
  });

  // ===========================================================================
  // 服务端行为说明（不再客户端测试）
  // ===========================================================================

  describe('Server-side behavior (documented, not tested here)', () => {
    it('NOTE: restart is handled server-side, state pushed via postgres_changes', () => {
      // 服务端 /api/game/restart 负责：
      // 1. 调用 handleRestartGame handler
      // 2. 写入 DB → postgres_changes 推送新状态到所有客户端
      // 这些行为由 API route 测试验证，不在 facade 测试中
      expect(true).toBe(true);
    });
  });
});
