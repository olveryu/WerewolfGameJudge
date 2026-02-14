/**
 * GameFacade 单元测试
 *
 * 测试范围：
 * - Host 创建房间 → store 初始化
 * - Host 入座 → 走 HTTP API 路径
 * - Player 入座 → 走 HTTP API 路径
 * - Player 收到 STATE_UPDATE → applySnapshot
 */

import { gameReducer } from '@/services/engine/reducer/gameReducer';
import type { PlayerJoinAction } from '@/services/engine/reducer/types';
import { GameStore } from '@/services/engine/store';
import { GameFacade } from '@/services/facade/GameFacade';
import type { BroadcastPlayer, HostBroadcast, PlayerMessage } from '@/services/protocol/types';

// Mock BroadcastService (constructor mock — DI 测试直接注入，此处仅防止真实 import)
jest.mock('../../transport/BroadcastService', () => ({
  BroadcastService: jest.fn().mockImplementation(() => ({})),
}));

// P0-1: Mock AudioService
const mockAudioServiceInstance = {
  playNightAudio: jest.fn().mockResolvedValue(undefined),
  playNightEndAudio: jest.fn().mockResolvedValue(undefined),
  playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
  playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
  preloadForRoles: jest.fn().mockResolvedValue(undefined),
  clearPreloaded: jest.fn(),
  cleanup: jest.fn(),
};
jest.mock('../../infra/AudioService', () => ({
  __esModule: true,
  AudioService: jest.fn(() => mockAudioServiceInstance),
}));

// Mock RoomService (DB state persistence)
const mockRoomService = () =>
  ({
    upsertGameState: jest.fn().mockResolvedValue(undefined),
    getGameState: jest.fn().mockResolvedValue(null),
  }) as any;

describe('GameFacade', () => {
  let facade: GameFacade;
  let mockBroadcastService: {
    joinRoom: jest.Mock;
    sendToHost: jest.Mock;
    broadcastAsHost: jest.Mock;
    leaveRoom: jest.Mock;
    markAsLive: jest.Mock;
  };

  const mockTemplate = {
    id: 'test-template',
    name: 'Test Template',
    numberOfPlayers: 6,
    roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'] as any[],
  };

  beforeEach(() => {
    // Setup mock BroadcastService
    mockBroadcastService = {
      joinRoom: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      markAsLive: jest.fn(),
    };

    // DI: 直接注入 mock，无需 singleton
    facade = new GameFacade({
      store: new GameStore(),
      broadcastService: mockBroadcastService as any,
      audioService: mockAudioServiceInstance as any,
      hostStateCache: {
        saveState: jest.fn(),
        loadState: jest.fn().mockResolvedValue(null),
        getState: jest.fn().mockReturnValue(null),
        clearState: jest.fn(),
      } as any,
      roomService: mockRoomService(),
    });
  });

  // ===========================================================================
  // Shared Helper: 通过 PLAYER_JOIN actions + reducer 填充所有座位
  // ===========================================================================
  const fillAllSeatsViaReducer = (facadeInstance: GameFacade, template: typeof mockTemplate) => {
    let state = facadeInstance['store'].getState()!;

    for (let i = 0; i < template.numberOfPlayers; i++) {
      const player: BroadcastPlayer = {
        uid: i === 0 ? 'host-uid' : `player-${i}`,
        seatNumber: i,
        displayName: `Player ${i}`,
        avatarUrl: undefined,
        role: null, // 必须包含 role: null
        hasViewedRole: false,
      };

      const action: PlayerJoinAction = {
        type: 'PLAYER_JOIN',
        payload: { seat: i, player },
      };

      state = gameReducer(state, action);
    }

    // 写回 store
    facadeInstance['store'].setState(state);

    return state;
  };

  // ===========================================================================
  // Shared Helper: 直接通过 reducer 设置 ongoing 状态（绕过 assignRoles/viewedRole 流程）
  // ===========================================================================
  const setOngoingViaReducer = (facadeInstance: GameFacade) => {
    let state = facadeInstance['store'].getState()!;
    state = gameReducer(state, {
      type: 'START_NIGHT',
      payload: { currentStepIndex: 0, currentStepId: 'wolfKill' },
    });
    facadeInstance['store'].setState(state);
    return state;
  };

  describe('Host: initializeAsHost', () => {
    it('should initialize store with correct state', async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);

      expect(facade.isHostPlayer()).toBe(true);
      expect(facade.getMyUid()).toBe('host-uid');
      expect(facade.getStateRevision()).toBe(1);
    });

    it('should join broadcast channel with correct callbacks', async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);

      expect(mockBroadcastService.joinRoom).toHaveBeenCalledWith(
        'ABCD',
        'host-uid',
        expect.objectContaining({
          onPlayerMessage: expect.any(Function),
          onPresenceChange: expect.any(Function),
        }),
      );
    });

    it('should broadcast initial state', async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
          revision: 1,
          state: expect.objectContaining({
            roomCode: 'ABCD',
            hostUid: 'host-uid',
            status: 'unseated',
          }),
        }),
      );
    });
  });

  describe('Host: takeSeat (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call HTTP API and return true on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeat(0, 'Host Player', 'avatar.png');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/seat'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"sit"'),
        }),
      );
    });

    it('should return false when API rejects (invalid seat)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'invalid_seat' }),
      });

      const result = await facade.takeSeat(999);

      expect(result).toBe(false);
    });
  });

  describe('Host: leaveSeat (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call HTTP API and return true on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.leaveSeat();

      expect(result).toBe(true);
    });

    it('should return false when not seated', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'not_seated' }),
      });

      const result = await facade.leaveSeat();

      expect(result).toBe(false);
    });
  });

  describe('Player: joinAsPlayer', () => {
    it('should join as player and request state', async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');

      expect(facade.isHostPlayer()).toBe(false);
      expect(facade.getMyUid()).toBe('player-uid');

      expect(mockBroadcastService.joinRoom).toHaveBeenCalledWith(
        'ABCD',
        'player-uid',
        expect.objectContaining({
          onHostBroadcast: expect.any(Function),
        }),
      );

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'REQUEST_STATE',
        uid: 'player-uid',
      });
    });
  });

  describe('Player: takeSeat (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');
      mockBroadcastService.sendToHost.mockClear();

      // Player must receive STATE_UPDATE to populate roomCode in store
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      callbacks.onHostBroadcast({
        type: 'STATE_UPDATE',
        revision: 1,
        state: {
          roomCode: 'ABCD',
          hostUid: 'host-uid',
          status: 'unseated',
          templateRoles: ['wolf', 'seer'] as any[],
          players: { 0: null, 1: null },
          currentStepIndex: -1,
          isAudioPlaying: false,
        },
      });
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call HTTP API and return result', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeat(1, 'Player One', 'avatar.png');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/seat'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"sit"'),
        }),
      );
    });

    it('should return false when API rejects', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'seat_taken' }),
      });

      const result = await facade.takeSeat(1, 'Player One');

      expect(result).toBe(false);
    });

    it('should not update mySeat until STATE_UPDATE received', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await facade.takeSeat(1, 'Player One');

      // mySeat should still be null (no optimistic update — wait for server broadcast)
      expect(facade.getMySeatNumber()).toBeNull();
    });
  });

  describe('Player: receive STATE_UPDATE', () => {
    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');
    });

    it('should apply snapshot when receiving STATE_UPDATE', () => {
      // Get the onHostBroadcast callback that was passed to joinRoom
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      const onHostBroadcast = callbacks.onHostBroadcast;

      const stateUpdate: HostBroadcast = {
        type: 'STATE_UPDATE',
        revision: 5,
        state: {
          roomCode: 'ABCD',
          hostUid: 'host-uid',
          status: 'unseated',
          templateRoles: ['wolf', 'seer'] as any[],
          players: {
            0: null,
            1: {
              uid: 'player-uid',
              seatNumber: 1,
              displayName: 'Player One',
              hasViewedRole: false,
            },
          },
          currentStepIndex: -1,
          isAudioPlaying: false,
        },
      };

      onHostBroadcast(stateUpdate);

      expect(facade.getStateRevision()).toBe(5);
      expect(facade.getMySeatNumber()).toBe(1);
      expect(mockBroadcastService.markAsLive).toHaveBeenCalled();
    });
  });

  describe('Player: takeSeatWithAck reason transparency (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');

      // Player must receive STATE_UPDATE to populate roomCode in store
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      callbacks.onHostBroadcast({
        type: 'STATE_UPDATE',
        revision: 1,
        state: {
          roomCode: 'ABCD',
          hostUid: 'host-uid',
          status: 'unseated',
          templateRoles: ['wolf', 'seer'] as any[],
          players: { 0: null, 1: null },
          currentStepIndex: -1,
          isAudioPlaying: false,
        },
      });
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success with no reason on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: true });
    });

    it('should return reason when seat is taken', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'seat_taken' }),
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: false, reason: 'seat_taken' });
    });

    it('should return reason when game in progress', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'game_in_progress' }),
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should return NETWORK_ERROR on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: false, reason: 'NETWORK_ERROR' });
    });
  });

  describe('Player: leaveSeatWithAck reason transparency (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');

      // Player must receive STATE_UPDATE to populate roomCode in store
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      callbacks.onHostBroadcast({
        type: 'STATE_UPDATE',
        revision: 1,
        state: {
          roomCode: 'ABCD',
          hostUid: 'host-uid',
          status: 'unseated',
          templateRoles: ['wolf', 'seer'] as any[],
          players: { 0: null, 1: null },
          currentStepIndex: -1,
          isAudioPlaying: false,
        },
      });
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success on successful leave', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: true });
    });

    it('should return reason when game in progress', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'game_in_progress' }),
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });
  });

  describe('leaveRoom', () => {
    it('should clean up state when leaving', async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      await facade.leaveRoom();

      expect(mockBroadcastService.leaveRoom).toHaveBeenCalled();
      expect(facade.getMyUid()).toBeNull();
      expect(facade.isHostPlayer()).toBe(false);
    });
  });

  describe('Host: takeSeatWithAck (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success on valid seat', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeatWithAck(0, 'Host Player');

      expect(result).toEqual({ success: true });
    });

    it('should return reason from server when seat out of range', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'invalid_seat' }),
      });

      const result = await facade.takeSeatWithAck(999, 'Host Player');

      expect(result).toEqual({ success: false, reason: 'invalid_seat' });
    });
  });

  describe('Host: leaveSeatWithAck (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success when leaving seat', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: true });
    });

    it('should return reason when not seated', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'not_seated' }),
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: false, reason: 'not_seated' });
    });
  });

  // =========================================================================
  // PR1: assignRoles (HTTP API — Phase 2 migration)
  // =========================================================================
  describe('Host: assignRoles (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call correct API endpoint with roomCode and hostUid', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await facade.assignRoles();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/assign'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"roomCode":"ABCD"'),
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"hostUid":"host-uid"'),
        }),
      );
    });

    it('should return success when API succeeds', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.assignRoles();

      expect(result.success).toBe(true);
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'invalid_status' }),
      });

      const result = await facade.assignRoles();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should return NOT_CONNECTED when no roomCode', async () => {
      // Player without store state
      const playerFacade = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(null),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      const result = await playerFacade.assignRoles();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NOT_CONNECTED');
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await facade.assignRoles();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NETWORK_ERROR');
    });
  });

  // =========================================================================
  // PR2: markViewedRole (HTTP API — Phase 2 migration)
  // =========================================================================
  describe('markViewedRole (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call view-role API with uid and seat', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await facade.markViewedRole(2);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/view-role'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"seat":2'),
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"uid":"host-uid"'),
        }),
      );
    });

    it('should call view-role API for player (unified HTTP path, no PlayerMessage)', async () => {
      // Player also goes through HTTP now (no sendToHost for VIEWED_ROLE)
      const playerStore = new GameStore();
      const playerFacade = new GameFacade({
        store: playerStore,
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(null),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: {
          upsertGameState: jest.fn().mockResolvedValue(undefined),
          // Return a state with roomCode so the player store has it
          getGameState: jest.fn().mockResolvedValue({
            state: {
              roomCode: 'ABCD',
              hostUid: 'host-uid',
              status: 'assigned',
              templateRoles: [],
              numberOfPlayers: 6,
              players: {},
              currentStepIndex: 0,
              isAudioPlaying: false,
            },
            revision: 1,
          }),
        } as any,
      });
      await playerFacade.joinAsPlayer('ABCD', 'player-uid');

      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      // Clear any sendToHost calls from joinAsPlayer
      mockBroadcastService.sendToHost.mockClear();

      const result = await playerFacade.markViewedRole(0);

      expect(result.success).toBe(true);
      // Should use HTTP, NOT sendToHost
      expect(mockBroadcastService.sendToHost).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'VIEWED_ROLE' }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/view-role'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should return success from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.markViewedRole(0);

      expect(result.success).toBe(true);
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'invalid_status' }),
      });

      const result = await facade.markViewedRole(0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await facade.markViewedRole(0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NETWORK_ERROR');
    });
  });

  // =========================================================================
  // PR3: startNight (HTTP API — Phase 2 migration)
  // =========================================================================
  describe('Host: startNight (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call start API with roomCode and hostUid', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      await facade.startNight();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game/start'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"roomCode":"ABCD"'),
        }),
      );
    });

    it('should return NOT_CONNECTED when not connected', async () => {
      const emptyFacade = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(null),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      const result = await emptyFacade.startNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NOT_CONNECTED');
    });

    it('should return success from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.startNight();

      expect(result.success).toBe(true);
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, reason: 'invalid_status' }),
      });

      const result = await facade.startNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should preload audio for template roles after success', async () => {
      // Set up template roles in store
      fillAllSeatsViaReducer(facade, mockTemplate);

      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      mockAudioServiceInstance.preloadForRoles.mockClear();

      await facade.startNight();

      expect(mockAudioServiceInstance.preloadForRoles).toHaveBeenCalledWith(mockTemplate.roles);
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await facade.startNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NETWORK_ERROR');
    });
  });

  // ===========================================================================
  // PR4: submitAction tests
  // ===========================================================================

  describe('submitAction (PR4)', () => {
    it('should send PlayerMessage when not host (Player transport)', async () => {
      // Player 发送 ACTION 消息给 Host，而不是返回 host_only 错误
      await facade.joinAsPlayer('TEST', 'player-uid', 'Player 1');

      const result = await facade.submitAction(0, 'seer', 1);

      // Player 端返回 success: true（消息已发送）
      expect(result.success).toBe(true);

      // 验证发送了正确的 PlayerMessage
      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 1,
        extra: undefined,
      });
    });

    it('should fail when status is not ongoing (gate: invalid_status)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      const result = await facade.submitAction(2, 'seer', 0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast on rejection (reject also broadcasts)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.submitAction(2, 'seer', 0);

      // 失败时也应该 broadcast
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should return reason from handler (not facade)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      // 不填座位，state.status 是 'unseated'

      const result = await facade.submitAction(0, 'seer', 1);

      // reason 必须来自 handler，不是 facade 自定义
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });
  });

  // ===========================================================================
  // PR5: submitWolfVote tests
  // ===========================================================================

  describe('submitWolfVote (PR5)', () => {
    it('should send PlayerMessage when not host (Player transport)', async () => {
      // Player 发送 WOLF_VOTE 消息给 Host，而不是返回 host_only 错误
      await facade.joinAsPlayer('TEST', 'player-uid', 'Player 1');

      const result = await facade.submitWolfVote(1, 0);

      // Player 端返回 success: true（消息已发送）
      expect(result.success).toBe(true);

      // 验证发送了正确的 PlayerMessage
      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'WOLF_VOTE',
        seat: 1,
        target: 0,
      });
    });

    it('should fail when status is not ongoing (gate: invalid_status)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      const result = await facade.submitWolfVote(1, 0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast on rejection (reject also broadcasts)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.submitWolfVote(1, 0);

      // 失败时也应该 broadcast
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should return reason from handler (reason passthrough)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      // 不填座位，state.status 是 'unseated'

      const result = await facade.submitWolfVote(1, 0);

      // reason 必须来自 handler，不是 facade 自定义
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should write actionRejected into store on rejection (regression: applyActionsOnFailure)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      const result = await facade.submitWolfVote(1, 0);

      expect(result.success).toBe(false);

      const state = facade['store'].getState()!;
      expect(state.actionRejected).toEqual(
        expect.objectContaining({
          action: 'wolfKill',
          targetUid: 'player-1',
        }),
      );
      expect(state.actionRejected?.reason).toEqual(expect.any(String));
    });
  });

  // ===========================================================================
  // PR6: advanceNight / endNight tests
  // ===========================================================================

  describe('advanceNight (PR6)', () => {
    it('should fail when not host (gate: host_only)', async () => {
      await facade.joinAsPlayer('TEST', 'player-uid', 'Player 1');

      const result = await facade.advanceNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('host_only');
    });

    it('should fail when status is not ongoing (gate: invalid_status)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      const result = await facade.advanceNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast on rejection (reject also broadcasts)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.advanceNight();

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should return reason from handler (reason passthrough)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);

      const result = await facade.advanceNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });
  });

  describe('endNight (PR6)', () => {
    it('should fail when not host (gate: host_only)', async () => {
      await facade.joinAsPlayer('TEST', 'player-uid', 'Player 1');

      const result = await facade.endNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('host_only');
    });

    it('should fail when status is not ongoing (gate: invalid_status)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      const result = await facade.endNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast on rejection (reject also broadcasts)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // 不开始夜晚，status 是 'seated'

      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.endNight();

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should return reason from handler (reason passthrough)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);

      const result = await facade.endNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });
  });

  // ===========================================================================
  // PR7: setAudioPlaying tests
  // ===========================================================================
  describe('setAudioPlaying (PR7)', () => {
    it('should set isAudioPlaying to true when called with true', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      setOngoingViaReducer(facade);

      const result = await facade.setAudioPlaying(true);

      expect(result.success).toBe(true);
      const state = facade['store'].getState();
      expect(state?.isAudioPlaying).toBe(true);
    });

    it('should set isAudioPlaying to false when called with false', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      setOngoingViaReducer(facade);
      await facade.setAudioPlaying(true);

      const result = await facade.setAudioPlaying(false);

      expect(result.success).toBe(true);
      const state = facade['store'].getState();
      expect(state?.isAudioPlaying).toBe(false);
    });

    it('should reject when status is not ongoing', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      // status is 'seated', not 'ongoing'

      const result = await facade.setAudioPlaying(true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast on rejection (reject also broadcasts)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.setAudioPlaying(true);

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should return reason from handler (reason passthrough)', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);

      const result = await facade.setAudioPlaying(true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });
  });

  // ===========================================================================
  // PR7: isAudioPlaying gates contract
  // ===========================================================================
  describe('PR7 contract: isAudioPlaying gates', () => {
    it('advanceNight should reject when isAudioPlaying=true', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      setOngoingViaReducer(facade);
      await facade.setAudioPlaying(true);

      const result = await facade.advanceNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('forbidden_while_audio_playing');
    });

    it('endNight should reject when isAudioPlaying=true', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      setOngoingViaReducer(facade);
      await facade.setAudioPlaying(true);

      const result = await facade.endNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('forbidden_while_audio_playing');
    });

    it('advanceNight should succeed when isAudioPlaying=false', async () => {
      await facade.initializeAsHost('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
      setOngoingViaReducer(facade);
      // isAudioPlaying defaults to false after setOngoingViaReducer

      const result = await facade.advanceNight();

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Host Rejoin: joinAsHost + wasAudioInterrupted + resumeAfterRejoin
  // ===========================================================================

  describe('Host: joinAsHost (cache restore)', () => {
    /** Build a cached ongoing state for rejoin tests */
    const buildOngoingCache = (overrides: Record<string, unknown> = {}) => ({
      version: 1,
      revision: 10,
      cachedAt: Date.now(),
      state: {
        roomCode: 'REJN',
        hostUid: 'host-uid',
        status: 'ongoing' as const,
        templateRoles: ['wolf', 'villager'],
        players: {
          0: {
            uid: 'host-uid',
            seatNumber: 0,
            displayName: 'Host',
            avatarUrl: undefined,
            role: 'wolf',
            hasViewedRole: true,
          },
          1: {
            uid: 'player-2',
            seatNumber: 1,
            displayName: 'P2',
            avatarUrl: undefined,
            role: 'villager',
            hasViewedRole: true,
          },
        },
        currentStepIndex: 0,
        currentStepId: 'wolfKill',
        isAudioPlaying: false,
        ...overrides,
      },
    });

    it('should restore state from cache and set wasAudioInterrupted=true when ongoing', async () => {
      const cached = buildOngoingCache();
      const facadeWithCache = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(cached),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      const result = await facadeWithCache.joinAsHost('REJN', 'host-uid');

      expect(result.success).toBe(true);
      expect(facadeWithCache.wasAudioInterrupted).toBe(true);
      expect(facadeWithCache.isHostPlayer()).toBe(true);
      expect(facadeWithCache.getState()?.status).toBe('ongoing');
    });

    it('should set wasAudioInterrupted=false when cached status is not ongoing', async () => {
      const cached = buildOngoingCache({ status: 'ready' });
      const facadeWithCache = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(cached),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      const result = await facadeWithCache.joinAsHost('REJN', 'host-uid');

      expect(result.success).toBe(true);
      expect(facadeWithCache.wasAudioInterrupted).toBe(false);
    });

    it('should broadcast restored state after host rejoin', async () => {
      const cached = buildOngoingCache();
      const facadeWithCache = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(cached),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      await facadeWithCache.joinAsHost('REJN', 'host-uid');

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
          state: expect.objectContaining({
            roomCode: 'REJN',
            status: 'ongoing',
          }),
        }),
      );
    });

    it('should return no_cached_state when no cache and no template', async () => {
      const result = await facade.joinAsHost('REJN', 'host-uid');

      expect(result).toEqual({ success: false, reason: 'no_cached_state' });
      expect(facade.isHostPlayer()).toBe(false);
    });

    it('should initialize with template when no cache but template provided', async () => {
      const result = await facade.joinAsHost('REJN', 'host-uid', [
        'wolf' as any,
        'villager' as any,
      ]);

      expect(result.success).toBe(true);
      expect(facade.getState()?.status).toBe('unseated');
      expect(facade.wasAudioInterrupted).toBe(false);
    });
  });

  describe('Host: resumeAfterRejoin', () => {
    /** Helper: create facade with ongoing cached state, already joined */
    const createRejoinedFacade = async (
      stateOverrides: Record<string, unknown> = {},
    ): Promise<GameFacade> => {
      const cached = {
        version: 1,
        revision: 10,
        cachedAt: Date.now(),
        state: {
          roomCode: 'REJN',
          hostUid: 'host-uid',
          status: 'ongoing' as const,
          templateRoles: ['wolf', 'villager'],
          players: {
            0: {
              uid: 'host-uid',
              seatNumber: 0,
              displayName: 'Host',
              avatarUrl: undefined,
              role: 'wolf',
              hasViewedRole: true,
            },
            1: {
              uid: 'player-2',
              seatNumber: 1,
              displayName: 'P2',
              avatarUrl: undefined,
              role: 'villager',
              hasViewedRole: true,
            },
          },
          currentStepIndex: 0,
          currentStepId: 'wolfKill',
          isAudioPlaying: true,
          ...stateOverrides,
        },
      };

      const f = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(cached),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      await f.joinAsHost('REJN', 'host-uid');
      mockBroadcastService.broadcastAsHost.mockClear();
      mockAudioServiceInstance.playRoleBeginningAudio.mockClear();
      return f;
    };

    it('should replay current step audio and release gate when isAudioPlaying=true', async () => {
      const f = await createRejoinedFacade();

      await f.resumeAfterRejoin();

      // Should replay wolf audio
      expect(mockAudioServiceInstance.playRoleBeginningAudio).toHaveBeenCalledWith('wolf');
      // Should release audio gate (setAudioPlaying(false) broadcasts)
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalled();
      const lastBroadcast =
        mockBroadcastService.broadcastAsHost.mock.calls[
          mockBroadcastService.broadcastAsHost.mock.calls.length - 1
        ][0];
      expect(lastBroadcast.state.isAudioPlaying).toBe(false);
    });

    it('should release gate even if audio fails (try/catch absorbs error)', async () => {
      mockAudioServiceInstance.playRoleBeginningAudio.mockRejectedValueOnce(
        new Error('audio error'),
      );
      const f = await createRejoinedFacade();

      // Should NOT throw — outer try/catch in resumeAfterRejoin absorbs the error
      await f.resumeAfterRejoin();

      // Gate should still be released via finally
      const broadcasts = mockBroadcastService.broadcastAsHost.mock.calls;
      const lastState = broadcasts[broadcasts.length - 1]?.[0]?.state;
      expect(lastState?.isAudioPlaying).toBe(false);
    });

    it('should noop on second call (re-entry guard)', async () => {
      const f = await createRejoinedFacade();

      await f.resumeAfterRejoin();
      mockAudioServiceInstance.playRoleBeginningAudio.mockClear();
      mockBroadcastService.broadcastAsHost.mockClear();

      // Second call should be no-op
      await f.resumeAfterRejoin();

      expect(mockAudioServiceInstance.playRoleBeginningAudio).not.toHaveBeenCalled();
    });

    it('should clear wasAudioInterrupted after call', async () => {
      const f = await createRejoinedFacade();
      expect(f.wasAudioInterrupted).toBe(true);

      await f.resumeAfterRejoin();

      expect(f.wasAudioInterrupted).toBe(false);
    });

    it('should skip audio when isAudioPlaying=false but still trigger progression', async () => {
      const f = await createRejoinedFacade({ isAudioPlaying: false });

      await f.resumeAfterRejoin();

      // No audio replay
      expect(mockAudioServiceInstance.playRoleBeginningAudio).not.toHaveBeenCalled();
      // Should still broadcast (progression may trigger state changes)
      expect(f.wasAudioInterrupted).toBe(false);
    });

    it('should release gate when currentStepId is undefined (endNight interrupted)', async () => {
      const f = await createRejoinedFacade({
        currentStepId: undefined,
        currentStepIndex: -1,
      });

      await f.resumeAfterRejoin();

      // No audio for undefined step
      expect(mockAudioServiceInstance.playRoleBeginningAudio).not.toHaveBeenCalled();
      // Gate released via setAudioPlaying(false)
      const broadcasts = mockBroadcastService.broadcastAsHost.mock.calls;
      const lastState = broadcasts[broadcasts.length - 1]?.[0]?.state;
      expect(lastState?.isAudioPlaying).toBe(false);
    });
  });

  describe('Host: _rebuildWolfVoteTimerIfNeeded', () => {
    it('should rebuild timer when deadline is in the future', async () => {
      jest.useFakeTimers();
      try {
        const futureDeadline = Date.now() + 3000;
        const cached = {
          version: 1,
          revision: 10,
          cachedAt: Date.now(),
          state: {
            roomCode: 'REJN',
            hostUid: 'host-uid',
            status: 'ongoing' as const,
            templateRoles: ['wolf', 'villager'],
            players: {
              0: {
                uid: 'host-uid',
                seatNumber: 0,
                displayName: 'Host',
                avatarUrl: undefined,
                role: 'wolf',
                hasViewedRole: true,
              },
              1: {
                uid: 'player-2',
                seatNumber: 1,
                displayName: 'P2',
                avatarUrl: undefined,
                role: 'villager',
                hasViewedRole: true,
              },
            },
            currentStepIndex: 0,
            currentStepId: 'wolfKill',
            isAudioPlaying: false,
            wolfVoteDeadline: futureDeadline,
          },
        };

        const f = new GameFacade({
          store: new GameStore(),
          broadcastService: mockBroadcastService as any,
          audioService: mockAudioServiceInstance as any,
          hostStateCache: {
            saveState: jest.fn(),
            loadState: jest.fn().mockResolvedValue(cached),
            getState: jest.fn().mockReturnValue(null),
            clearState: jest.fn(),
          } as any,
          roomService: mockRoomService(),
        });

        await f.joinAsHost('REJN', 'host-uid');

        // Calling resumeAfterRejoin triggers _rebuildWolfVoteTimerIfNeeded
        await f.resumeAfterRejoin();

        // Timer should be set — verify by checking the private field via bracket notation
        expect(f['_wolfVoteTimer']).not.toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('should not rebuild timer when not on wolfKill step', async () => {
      const cached = {
        version: 1,
        revision: 10,
        cachedAt: Date.now(),
        state: {
          roomCode: 'REJN',
          hostUid: 'host-uid',
          status: 'ongoing' as const,
          templateRoles: ['wolf', 'seer', 'villager'],
          players: {
            0: {
              uid: 'host-uid',
              seatNumber: 0,
              displayName: 'Host',
              avatarUrl: undefined,
              role: 'seer',
              hasViewedRole: true,
            },
          },
          currentStepIndex: 1,
          currentStepId: 'seerCheck',
          isAudioPlaying: false,
          wolfVoteDeadline: Date.now() + 3000,
        },
      };

      const f = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(cached),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      await f.joinAsHost('REJN', 'host-uid');
      await f.resumeAfterRejoin();

      expect(f['_wolfVoteTimer']).toBeNull();
    });

    it('should not rebuild timer when no wolfVoteDeadline in state', async () => {
      const cached = {
        version: 1,
        revision: 10,
        cachedAt: Date.now(),
        state: {
          roomCode: 'REJN',
          hostUid: 'host-uid',
          status: 'ongoing' as const,
          templateRoles: ['wolf', 'villager'],
          players: {
            0: {
              uid: 'host-uid',
              seatNumber: 0,
              displayName: 'Host',
              avatarUrl: undefined,
              role: 'wolf',
              hasViewedRole: true,
            },
          },
          currentStepIndex: 0,
          currentStepId: 'wolfKill',
          isAudioPlaying: false,
          // no wolfVoteDeadline
        },
      };

      const f = new GameFacade({
        store: new GameStore(),
        broadcastService: mockBroadcastService as any,
        audioService: mockAudioServiceInstance as any,
        hostStateCache: {
          saveState: jest.fn(),
          loadState: jest.fn().mockResolvedValue(cached),
          getState: jest.fn().mockReturnValue(null),
          clearState: jest.fn(),
        } as any,
        roomService: mockRoomService(),
      });

      await f.joinAsHost('REJN', 'host-uid');
      await f.resumeAfterRejoin();

      expect(f['_wolfVoteTimer']).toBeNull();
    });
  });
});
