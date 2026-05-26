/**
 * restartGame behavior contract test (HTTP API — Phase 2 migration)
 *
 * Phase 2: restartGame has been migrated to HTTP API
 *
 * Acceptance criteria:
 * 1. Calls the correct API endpoint (/game/restart)
 * 2. Passes the correct request body (roomCode)
 * 3. Permission check: only Host can call (facade-level gate)
 * 4. Returns the API response
 * 5. Network error handling
 * 6. Server handles state reset; postgres_changes pushes new state to all clients
 */

import { GameStore } from '@werewolf/game-engine/engine/store';

import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { GameFacade } from '@/services/facade/GameFacade';
import type { AudioService } from '@/services/infra/AudioService';
import type { IRoomService } from '@/services/types/IRoomService';

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
    stopBgm: jest.fn(),
  })),
}));

describe('restartGame Contract (HTTP API)', () => {
  let facade: GameFacade;
  let mockConnectionManager: {
    connectAndWait: jest.Mock;
    connect: jest.Mock;
    dispose: jest.Mock;
    manualReconnect: jest.Mock;
    addStateListener: jest.Mock;
    updateRevision: jest.Mock;
    getState: jest.Mock;
    getContext: jest.Mock;
  };

  const originalFetch = global.fetch;

  const mockTemplate = {
    id: 'test-template',
    name: 'Test Template',
    numberOfPlayers: 4,
    roles: ['wolf', 'wolf', 'seer', 'villager'] as ('wolf' | 'seer' | 'villager')[],
  };

  beforeEach(async () => {
    mockConnectionManager = {
      connectAndWait: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      dispose: jest.fn(),
      manualReconnect: jest.fn(),
      addStateListener: jest.fn().mockReturnValue(() => {}),
      updateRevision: jest.fn(),
      getState: jest.fn().mockReturnValue('Idle'),
      getContext: jest.fn(),
    };

    // DI: inject mock directly
    facade = new GameFacade({
      store: new GameStore(),
      connectionManager: mockConnectionManager as unknown as ConnectionManager,
      audioService: {
        playNightAudio: jest.fn().mockResolvedValue(undefined),
        playNightEndAudio: jest.fn().mockResolvedValue(undefined),
        playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
        playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
        preloadForRoles: jest.fn().mockResolvedValue(undefined),
        clearPreloaded: jest.fn(),
        cleanup: jest.fn(),
        stop: jest.fn(),
        stopBgm: jest.fn(),
      } as unknown as AudioService,
      roomService: {
        getGameState: jest.fn().mockResolvedValue(null),
      } as unknown as IRoomService,
    });

    await facade.createRoom('1234', 'host-uid', mockTemplate);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ===========================================================================
  // API call tests
  // ===========================================================================

  describe('API Call', () => {
    it('should call /game/restart with roomCode', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      await facade.restartGame();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/restart'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"roomCode":"1234"') as string,
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
  // Permission check (facade-level gate, not dependent on API)
  // ===========================================================================

  describe('Permission Check', () => {
    it('non-host calls are now rejected server-side (no client gate)', async () => {
      // Phase 7: client no longer gates by isHost; server rejects via state.hostUserId check
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
  // Network error handling
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
  // Server-side behavior notes (no longer tested on client)
  // ===========================================================================

  describe('Server-side behavior (documented, not tested here)', () => {
    it('NOTE: restart is handled server-side, state pushed via postgres_changes', () => {
      // Server-side /game/restart is responsible for:
      // 1. Calling handleRestartGame handler
      // 2. Writing to DB -> postgres_changes pushes new state to all clients
      // These behaviors are verified by API route tests, not in facade tests
      expect(true).toBe(true);
    });
  });
});
