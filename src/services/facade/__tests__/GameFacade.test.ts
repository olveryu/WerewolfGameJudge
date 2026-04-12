/**
 * GameFacade 单元测试
 *
 * 测试范围：
 * - Host 创建房间 → store 初始化
 * - Host 入座 → 走 HTTP API 路径
 * - Player 入座 → 走 HTTP API 路径
 * - Player 收到 STATE_UPDATE → applySnapshot
 */

import { GameStatus } from '@werewolf/game-engine';
import { gameReducer } from '@werewolf/game-engine/engine/reducer/gameReducer';
import type { PlayerJoinAction } from '@werewolf/game-engine/engine/reducer/types';
import { GameStore } from '@werewolf/game-engine/engine/store';
import type { Player, RosterEntry } from '@werewolf/game-engine/protocol/types';

import { ConnectionState } from '@/services/connection/types';
import { GameFacade } from '@/services/facade/GameFacade';

// P0-1: Mock AudioService
const mockAudioServiceInstance = {
  playNightAudio: jest.fn().mockResolvedValue(undefined),
  playNightEndAudio: jest.fn().mockResolvedValue(undefined),
  playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
  playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
  preloadForRoles: jest.fn().mockResolvedValue(undefined),
  clearPreloaded: jest.fn(),
  cleanup: jest.fn(),
  stop: jest.fn(),
};
jest.mock('../../infra/AudioService', () => ({
  __esModule: true,
  AudioService: jest.fn(() => mockAudioServiceInstance),
}));

// Mock RoomService (DB state persistence)
const mockRoomService = () =>
  ({
    getGameState: jest.fn().mockResolvedValue(null),
  }) as any;

/**
 * Create a mock ConnectionManager.
 * If store + roomService are provided, connectAndWait simulates the real FSM flow:
 * fetch DB state → applySnapshot (mimicking Syncing → Connected transition).
 */
const createMockConnectionManager = (
  store?: GameStore,
  roomService?: { getGameState: jest.Mock },
) => ({
  connectAndWait: jest.fn().mockImplementation(async (roomCode: string) => {
    if (store && roomService) {
      const dbState = await roomService.getGameState(roomCode);
      if (dbState) store.applySnapshot(dbState.state, dbState.revision);
    }
  }),
  connect: jest.fn(),
  dispose: jest.fn(),
  manualReconnect: jest.fn(),
  addStateListener: jest.fn().mockReturnValue(() => {}),
  updateRevision: jest.fn(),
  getState: jest.fn().mockReturnValue('Idle'),
  getContext: jest.fn().mockReturnValue({ state: 'Idle', attempt: 0, lastRevision: 0 }),
});

describe('GameFacade', () => {
  let facade: GameFacade;
  let testStore: GameStore;
  let mockConnectionManager: {
    connectAndWait: jest.Mock;
    connect: jest.Mock;
    disconnect: jest.Mock;
    dispose: jest.Mock;
    manualReconnect: jest.Mock;
    addStateListener: jest.Mock;
    updateRevision: jest.Mock;
    getState: jest.Mock;
    getContext: jest.Mock;
  };

  const mockTemplate = {
    id: 'test-template',
    name: 'Test Template',
    numberOfPlayers: 6,
    roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'] as any[],
  };

  beforeEach(() => {
    // Setup mock ConnectionManager
    mockConnectionManager = {
      connectAndWait: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      disconnect: jest.fn(),
      dispose: jest.fn(),
      manualReconnect: jest.fn(),
      addStateListener: jest.fn().mockReturnValue(() => {}),
      updateRevision: jest.fn(),
      getState: jest.fn().mockReturnValue('Idle'),
      getContext: jest.fn().mockReturnValue({ state: 'Idle', attempt: 0, lastRevision: 0 }),
    };

    // DI: 直接注入 mock，无需 singleton
    testStore = new GameStore();
    facade = new GameFacade({
      store: testStore,
      connectionManager: mockConnectionManager as any,
      audioService: mockAudioServiceInstance as any,
      roomService: mockRoomService(),
    });
  });

  // ===========================================================================
  // Shared Helper: 通过 PLAYER_JOIN actions + reducer 填充所有座位
  // ===========================================================================
  const fillAllSeatsViaReducer = (_facadeInstance: GameFacade, template: typeof mockTemplate) => {
    let state = testStore.getState()!;

    for (let i = 0; i < template.numberOfPlayers; i++) {
      const uid = i === 0 ? 'host-uid' : `player-${i}`;
      const player: Player = {
        uid,
        seatNumber: i,
        role: null, // 必须包含 role: null
        hasViewedRole: false,
      };

      const rosterEntry: RosterEntry = {
        displayName: `Player ${i}`,
      };

      const action: PlayerJoinAction = {
        type: 'PLAYER_JOIN',
        payload: { seat: i, player, rosterEntry },
      };

      state = gameReducer(state, action);
    }

    // 写回 store
    testStore.setState(state);

    return state;
  };

  describe('Host: createRoom', () => {
    it('should initialize store with correct state', async () => {
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);

      expect(facade.isHostPlayer()).toBe(true);
      expect(facade.getMyUid()).toBe('host-uid');
      expect(facade.getStateRevision()).toBe(1);
    });

    it('should connect via ConnectionManager with correct params', async () => {
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);

      expect(mockConnectionManager.connectAndWait).toHaveBeenCalledWith('ABCD', 'host-uid');
    });
  });

  describe('Host: takeSeat (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call HTTP API and return true on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeat(0, 'Host Player', 'avatar.png');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/seat'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"sit"'),
        }),
      );
    });

    it('should return false when API rejects (invalid seat)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'invalid_seat' }),
      });

      const result = await facade.takeSeat(999);

      expect(result).toBe(false);
    });
  });

  describe('Host: leaveSeat (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call HTTP API and return true on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.leaveSeat();

      expect(result).toBe(true);
    });

    it('should return false when not seated', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'not_seated' }),
      });

      const result = await facade.leaveSeat();

      expect(result).toBe(false);
    });
  });

  describe('Player: joinRoom', () => {
    it('should join as player and connect via ConnectionManager', async () => {
      await facade.joinRoom('ABCD', 'player-uid', false);

      expect(facade.isHostPlayer()).toBe(false);
      expect(facade.getMyUid()).toBe('player-uid');

      expect(mockConnectionManager.connectAndWait).toHaveBeenCalledWith('ABCD', 'player-uid');
    });
  });

  describe('Player: takeSeat (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.joinRoom('ABCD', 'player-uid', false);

      // Player must receive state to populate roomCode in store
      testStore.applySnapshot(
        {
          roomCode: 'ABCD',
          hostUid: 'host-uid',
          status: GameStatus.Unseated,
          templateRoles: ['wolf', 'seer'] as any[],
          players: { 0: null, 1: null },
          currentStepIndex: -1,
          isAudioPlaying: false,
        } as any,
        1,
      );
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call HTTP API and return result', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeat(1, 'Player One', 'avatar.png');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/seat'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"sit"'),
        }),
      );
    });

    it('should return false when API rejects', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'seat_taken' }),
      });

      const result = await facade.takeSeat(1, 'Player One');

      expect(result).toBe(false);
    });

    it('should update mySeat after server response with snapshot', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            success: true,
            state: {
              roomCode: 'ABCD',
              hostUid: 'host-uid',
              status: GameStatus.Unseated,
              templateRoles: [],
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
              actions: [],
              pendingRevealAcks: [],
              roster: {},
            },
            revision: 2,
          }),
      });

      await facade.takeSeat(1, 'Player One');

      // 座位操作不做乐观更新，靠 HTTP 响应的 applySnapshot 渲染
      expect(facade.getMySeatNumber()).toBe(1);
      expect(facade.getStateRevision()).toBe(2);
    });
  });

  describe('Player: receive STATE_UPDATE', () => {
    beforeEach(async () => {
      await facade.joinRoom('ABCD', 'player-uid', false);
    });

    it('should apply snapshot when receiving state via postgres_changes', () => {
      const state = {
        roomCode: 'ABCD',
        hostUid: 'host-uid',
        status: GameStatus.Unseated,
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
        actions: [],
        pendingRevealAcks: [],
        roster: {},
      };

      testStore.applySnapshot(state as any, 5);

      expect(facade.getStateRevision()).toBe(5);
      expect(facade.getMySeatNumber()).toBe(1);
    });
  });

  describe('Player: takeSeatWithAck reason transparency (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.joinRoom('ABCD', 'player-uid', false);

      // Player must receive state to populate roomCode in store
      testStore.applySnapshot(
        {
          roomCode: 'ABCD',
          hostUid: 'host-uid',
          status: GameStatus.Unseated,
          templateRoles: ['wolf', 'seer'] as any[],
          players: { 0: null, 1: null },
          currentStepIndex: -1,
          isAudioPlaying: false,
        } as any,
        1,
      );
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success with no reason on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: true });
    });

    it('should return reason when seat is taken', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'seat_taken' }),
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: false, reason: 'seat_taken' });
    });

    it('should return reason when game in progress', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
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
      await facade.joinRoom('ABCD', 'player-uid', false);

      // Player must receive state to populate roomCode in store
      testStore.applySnapshot(
        {
          roomCode: 'ABCD',
          hostUid: 'host-uid',
          status: GameStatus.Unseated,
          templateRoles: ['wolf', 'seer'] as any[],
          players: { 0: null, 1: null },
          currentStepIndex: -1,
          isAudioPlaying: false,
        } as any,
        1,
      );
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success on successful leave', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: true });
    });

    it('should return reason when game in progress', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'game_in_progress' }),
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });
  });

  describe('leaveRoom', () => {
    it('should clean up state when leaving', async () => {
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
      await facade.leaveRoom();

      expect(mockConnectionManager.disconnect).toHaveBeenCalled();
      expect(facade.getMyUid()).toBeNull();
      expect(facade.isHostPlayer()).toBe(false);
    });
  });

  describe('Host: takeSeatWithAck (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success on valid seat', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.takeSeatWithAck(0, 'Host Player');

      expect(result).toEqual({ success: true });
    });

    it('should return reason from server when seat out of range', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'invalid_seat' }),
      });

      const result = await facade.takeSeatWithAck(999, 'Host Player');

      expect(result).toEqual({ success: false, reason: 'invalid_seat' });
    });
  });

  describe('Host: leaveSeatWithAck (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success when leaving seat', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: true });
    });

    it('should return reason when not seated', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
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
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call correct API endpoint with roomCode', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      await facade.assignRoles();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/assign'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"roomCode":"ABCD"'),
        }),
      );
    });

    it('should return success when API succeeds', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.assignRoles();

      expect(result.success).toBe(true);
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
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
        connectionManager: mockConnectionManager as any,
        audioService: mockAudioServiceInstance as any,
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
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call view-role API with uid and seat', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      await facade.markViewedRole(2);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/view-role'),
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
      const playerRoomService = {
        // Return a state with roomCode so the player store has it
        getGameState: jest.fn().mockResolvedValue({
          state: {
            roomCode: 'ABCD',
            hostUid: 'host-uid',
            status: GameStatus.Assigned,
            templateRoles: [],
            numberOfPlayers: 6,
            players: {},
            currentStepIndex: 0,
            isAudioPlaying: false,
          },
          revision: 1,
        }),
      };
      const playerFacade = new GameFacade({
        store: playerStore,
        connectionManager: createMockConnectionManager(playerStore, playerRoomService) as any,
        audioService: mockAudioServiceInstance as any,
        roomService: playerRoomService as any,
      });
      await playerFacade.joinRoom('ABCD', 'player-uid', false);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await playerFacade.markViewedRole(0);

      expect(result.success).toBe(true);
      // Should use HTTP API (unified path)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/view-role'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should return success from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.markViewedRole(0);

      expect(result.success).toBe(true);
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
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
      await facade.createRoom('ABCD', 'host-uid', mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call start API with roomCode', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      await facade.startNight();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/start'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"roomCode":"ABCD"'),
        }),
      );
    });

    it('should return NOT_CONNECTED when not connected', async () => {
      const emptyFacade = new GameFacade({
        store: new GameStore(),
        connectionManager: mockConnectionManager as any,
        audioService: mockAudioServiceInstance as any,
        roomService: mockRoomService(),
      });

      const result = await emptyFacade.startNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NOT_CONNECTED');
    });

    it('should return success from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.startNight();

      expect(result.success).toBe(true);
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
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
        ok: true,
        headers: { get: () => 'application/json' },
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
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.createRoom('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call HTTP API for both Host and Player', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.submitAction(2, 'seer', 0);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/night/action'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"role":"seer"'),
        }),
      );
    });

    it('should return failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'invalid_status' }),
      });

      const result = await facade.submitAction(2, 'seer', 0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should return NETWORK_ERROR on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      const result = await facade.submitAction(2, 'seer', 0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NETWORK_ERROR');
    });
  });

  // ===========================================================================
  // PR7: setAudioPlaying tests
  // ===========================================================================
  describe('setAudioPlaying (PR7)', () => {
    const origFetch = global.fetch;
    beforeEach(async () => {
      await facade.createRoom('TEST', 'host-uid', mockTemplate);
      fillAllSeatsViaReducer(facade, mockTemplate);
    });
    afterEach(() => {
      global.fetch = origFetch;
    });

    it('should call HTTP API with isPlaying=true', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.setAudioPlaying(true);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/night/audio-gate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should call HTTP API with isPlaying=false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const result = await facade.setAudioPlaying(false);

      expect(result.success).toBe(true);
    });

    it('should pass through failure reason from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, reason: 'invalid_status' }),
      });

      const result = await facade.setAudioPlaying(true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should return NETWORK_ERROR on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      const result = await facade.setAudioPlaying(true);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NETWORK_ERROR');
    });
  });

  // ===========================================================================
  // Host Rejoin: joinRoom(isHost=true) + wasAudioInterrupted + resumeAfterRejoin
  // ===========================================================================

  describe('Host: joinRoom(isHost=true) (DB restore)', () => {
    /** Build an ongoing state as returned from DB for rejoin tests */
    const buildOngoingDbState = (overrides: Record<string, unknown> = {}) => ({
      state: {
        roomCode: 'REJN',
        hostUid: 'host-uid',
        status: GameStatus.Ongoing as const,
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
      revision: 10,
    });

    it('should restore state from DB and set wasAudioInterrupted=true when ongoing', async () => {
      const dbState = buildOngoingDbState();
      const rejoinStore = new GameStore();
      const rejoinRoomService = {
        getGameState: jest.fn().mockResolvedValue(dbState),
      };
      const facadeWithDb = new GameFacade({
        store: rejoinStore,
        connectionManager: createMockConnectionManager(rejoinStore, rejoinRoomService) as any,
        audioService: mockAudioServiceInstance as any,
        roomService: rejoinRoomService as any,
      });

      const result = await facadeWithDb.joinRoom('REJN', 'host-uid', true);

      expect(result.success).toBe(true);
      expect(facadeWithDb.wasAudioInterrupted).toBe(true);
      expect(facadeWithDb.isHostPlayer()).toBe(true);
      expect(facadeWithDb.getState()?.status).toBe(GameStatus.Ongoing);
    });

    it('should set wasAudioInterrupted=false when DB status is not ongoing', async () => {
      const dbState = buildOngoingDbState({ status: GameStatus.Ready });
      const rejoinStore2 = new GameStore();
      const rejoinRoomService2 = {
        getGameState: jest.fn().mockResolvedValue(dbState),
      };
      const facadeWithDb = new GameFacade({
        store: rejoinStore2,
        connectionManager: createMockConnectionManager(rejoinStore2, rejoinRoomService2) as any,
        audioService: mockAudioServiceInstance as any,
        roomService: rejoinRoomService2 as any,
      });

      const result = await facadeWithDb.joinRoom('REJN', 'host-uid', true);

      expect(result.success).toBe(true);
      expect(facadeWithDb.wasAudioInterrupted).toBe(false);
    });

    it('should return no_db_state when no DB state and no template', async () => {
      const result = await facade.joinRoom('REJN', 'host-uid', true);

      expect(result).toEqual({ success: false, reason: 'no_db_state' });
      expect(facade.isHostPlayer()).toBe(false);
    });
  });

  describe('Host: resumeAfterRejoin', () => {
    const origFetch = global.fetch;
    afterEach(() => {
      global.fetch = origFetch;
    });

    /** Helper: create facade with ongoing DB state, already joined */
    const createRejoinedFacade = async (
      stateOverrides: Record<string, unknown> = {},
    ): Promise<GameFacade> => {
      const dbState = {
        state: {
          roomCode: 'REJN',
          hostUid: 'host-uid',
          status: GameStatus.Ongoing as const,
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
        revision: 10,
      };

      // Mock fetch for HTTP API calls during resumeAfterRejoin
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });

      const rejoinStore = new GameStore();
      const rejoinRoomService = {
        getGameState: jest.fn().mockResolvedValue(dbState),
      };
      const f = new GameFacade({
        store: rejoinStore,
        connectionManager: createMockConnectionManager(rejoinStore, rejoinRoomService) as any,
        audioService: mockAudioServiceInstance as any,
        roomService: rejoinRoomService as any,
      });

      await f.joinRoom('REJN', 'host-uid', true);
      mockAudioServiceInstance.playRoleBeginningAudio.mockClear();
      (global.fetch as jest.Mock).mockClear();
      // Re-set the mock after clearing
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });
      return f;
    };

    it('should replay current step audio and call audio-ack API when isAudioPlaying=true', async () => {
      const f = await createRejoinedFacade();

      await f.resumeAfterRejoin();

      // Should replay wolf audio
      expect(mockAudioServiceInstance.playRoleBeginningAudio).toHaveBeenCalledWith('wolf');
      // Should call audio-ack API to release gate + trigger progression
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/night/audio-ack'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should call audio-ack API even if audio fails (finally block)', async () => {
      mockAudioServiceInstance.playRoleBeginningAudio.mockRejectedValueOnce(
        new Error('audio error'),
      );
      const f = await createRejoinedFacade();

      // Should NOT throw — outer try/catch in resumeAfterRejoin absorbs the error
      await f.resumeAfterRejoin();

      // Gate should still be released via finally → postAudioAck → HTTP API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/night/audio-ack'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should noop on second call (re-entry guard)', async () => {
      const f = await createRejoinedFacade();

      await f.resumeAfterRejoin();
      mockAudioServiceInstance.playRoleBeginningAudio.mockClear();
      (global.fetch as jest.Mock).mockClear();

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

    it('should skip audio and skip API call when isAudioPlaying=false', async () => {
      const f = await createRejoinedFacade({ isAudioPlaying: false });

      await f.resumeAfterRejoin();

      // No audio replay
      expect(mockAudioServiceInstance.playRoleBeginningAudio).not.toHaveBeenCalled();
      // No API call — server inline progression handles everything
      expect(global.fetch).not.toHaveBeenCalled();
      expect(f.wasAudioInterrupted).toBe(false);
    });

    it('should call audio-ack API when currentStepId is undefined (endNight interrupted)', async () => {
      const f = await createRejoinedFacade({
        currentStepId: undefined,
        currentStepIndex: -1,
      });

      await f.resumeAfterRejoin();

      // No audio for undefined step
      expect(mockAudioServiceInstance.playRoleBeginningAudio).not.toHaveBeenCalled();
      // Gate released via postAudioAck → HTTP API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/night/audio-ack'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  // ===========================================================================
  // postAudioAck retry on reconnect
  // ===========================================================================
  describe('postAudioAck retry on reconnect', () => {
    let statusListeners: Array<(status: string) => void>;
    let retryConnectionManager: typeof mockConnectionManager;

    let retryStore: GameStore;

    const setupRetryFacade = async () => {
      statusListeners = [];
      retryConnectionManager = {
        connectAndWait: jest.fn().mockResolvedValue(undefined),
        connect: jest.fn(),
        disconnect: jest.fn(),
        dispose: jest.fn(),
        manualReconnect: jest.fn(),
        addStateListener: jest.fn().mockImplementation((listener: (s: string) => void) => {
          statusListeners.push(listener);
          return () => {
            statusListeners = statusListeners.filter((l) => l !== listener);
          };
        }),
        updateRevision: jest.fn(),
        getState: jest.fn().mockReturnValue('Idle'),
        getContext: jest.fn().mockReturnValue({ state: 'Idle', attempt: 0, lastRevision: 0 }),
      };

      retryStore = new GameStore();
      const f = new GameFacade({
        store: retryStore,
        connectionManager: retryConnectionManager as any,
        audioService: mockAudioServiceInstance as any,
        roomService: {
          getGameState: jest.fn().mockResolvedValue({
            state: {
              roomCode: 'RTRY',
              hostUid: 'host-uid',
              status: GameStatus.Ongoing,
              templateRoles: [],
              numberOfPlayers: 6,
              players: {},
              currentStepId: 'wolfKill',
              currentStepIndex: 0,
              nightSteps: ['wolfKill'],
              isAudioPlaying: true,
              pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
              seerLabelMap: {},
            },
            revision: 10,
          }),
        } as any,
      });
      await f.createRoom('RTRY', 'host-uid', mockTemplate);
      return f;
    };

    it('should set #pendingAudioAckRetry when postAudioAck fails during playback', async () => {
      // Mock fetch to simulate network error on audio-ack
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
      await setupRetryFacade();

      // Trigger #playPendingAudioEffects manually via store subscription
      // The facade constructor subscribes to store, so applySnapshot with pendingAudioEffects triggers it
      const store = retryStore;
      store.applySnapshot(
        {
          roomCode: 'RTRY',
          hostUid: 'host-uid',
          status: GameStatus.Ongoing,
          templateRoles: [],
          numberOfPlayers: 6,
          players: {},
          currentStepId: 'wolfKill',
          currentStepIndex: 0,
          nightSteps: ['wolfKill'],
          isAudioPlaying: true,
          pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
          seerLabelMap: {},
        } as any,
        20,
      );

      // Wait for async audio effects + ack
      await new Promise((r) => setTimeout(r, 50));

      // Now simulate reconnect — mock fetch to succeed this time
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });
      mockAudioServiceInstance.playRoleBeginningAudio.mockClear();

      // Fire 'live' status to all registered listeners
      statusListeners.forEach((l) => l(ConnectionState.Connected));

      // Wait for async retry (audio replay + ack)
      await new Promise((r) => setTimeout(r, 50));

      // Should have replayed audio effects before retrying ack
      expect(mockAudioServiceInstance.playRoleBeginningAudio).toHaveBeenCalledWith('wolf');
      // Should have retried postAudioAck
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/night/audio-ack'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should not retry postAudioAck on reconnect when ack succeeded during playback', async () => {
      // Mock fetch to succeed for audio-ack
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });
      await setupRetryFacade();

      const store = retryStore;
      store.applySnapshot(
        {
          roomCode: 'RTRY',
          hostUid: 'host-uid',
          status: GameStatus.Ongoing,
          templateRoles: [],
          numberOfPlayers: 6,
          players: {},
          currentStepId: 'wolfKill',
          currentStepIndex: 0,
          nightSteps: ['wolfKill'],
          isAudioPlaying: true,
          pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
          seerLabelMap: {},
        } as any,
        20,
      );

      // Wait for async audio effects + ack
      await new Promise((r) => setTimeout(r, 50));
      (global.fetch as jest.Mock).mockClear();

      // Fire 'live' — should NOT retry since ack succeeded
      statusListeners.forEach((l) => l(ConnectionState.Connected));
      await new Promise((r) => setTimeout(r, 50));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should reset #pendingAudioAckRetry on leaveRoom', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
      const f = await setupRetryFacade();

      const store = retryStore;
      store.applySnapshot(
        {
          roomCode: 'RTRY',
          hostUid: 'host-uid',
          status: GameStatus.Ongoing,
          templateRoles: [],
          numberOfPlayers: 6,
          players: {},
          currentStepId: 'wolfKill',
          currentStepIndex: 0,
          nightSteps: ['wolfKill'],
          isAudioPlaying: true,
          pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
          seerLabelMap: {},
        } as any,
        20,
      );
      await new Promise((r) => setTimeout(r, 50));

      // Leave room resets the flag
      await f.leaveRoom();

      // Now reconnect should NOT retry
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });
      statusListeners.forEach((l) => l(ConnectionState.Connected));
      await new Promise((r) => setTimeout(r, 50));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    // =========================================================================
    // Online event ack retry fallback (Web platform)
    // =========================================================================
    describe('online event retry (Web platform)', () => {
      // jest-expo 环境中 globalThis.window 不是真正浏览器 window，
      // 需要 patch addEventListener/removeEventListener 来模拟 Web 平台行为
      const onlineListeners: Set<EventListener> = new Set();
      let origAddEventListener: typeof globalThis.window.addEventListener | undefined;
      let origRemoveEventListener: typeof globalThis.window.removeEventListener | undefined;
      let origNavigatorOnLine: boolean | undefined;

      beforeEach(() => {
        onlineListeners.clear();
        origAddEventListener = globalThis.window?.addEventListener;
        origRemoveEventListener = globalThis.window?.removeEventListener;
        origNavigatorOnLine = globalThis.navigator?.onLine;
        // Patch: 只拦截 'online' 事件
        (globalThis.window as any).addEventListener = (type: string, listener: EventListener) => {
          if (type === 'online') onlineListeners.add(listener);
        };
        (globalThis.window as any).removeEventListener = (
          type: string,
          listener: EventListener,
        ) => {
          if (type === 'online') onlineListeners.delete(listener);
        };
        // Default: navigator.onLine = false (offline → listener path)
        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: false,
          writable: true,
          configurable: true,
        });
      });

      afterEach(() => {
        // Safety: ensure fake timers don't leak to subsequent describe blocks
        jest.useRealTimers();
        // Restore original (may be undefined in RN env)
        if (origAddEventListener) {
          globalThis.window.addEventListener = origAddEventListener;
        } else {
          delete (globalThis.window as any).addEventListener;
        }
        if (origRemoveEventListener) {
          globalThis.window.removeEventListener = origRemoveEventListener;
        } else {
          delete (globalThis.window as any).removeEventListener;
        }
        if (origNavigatorOnLine !== undefined) {
          Object.defineProperty(globalThis.navigator, 'onLine', {
            value: origNavigatorOnLine,
            configurable: true,
          });
        }
      });

      /** Simulate browser 'online' event */
      const fireOnlineEvent = () => {
        onlineListeners.forEach((fn) => fn(new Event('online')));
      };

      /** Helper: trigger ack failure to set #pendingAudioAckRetry + register online listener */
      const triggerAckFailureAndSettle = async () => {
        retryStore.applySnapshot(
          {
            roomCode: 'RTRY',
            hostUid: 'host-uid',
            status: GameStatus.Ongoing,
            templateRoles: [],
            numberOfPlayers: 6,
            players: {},
            currentStepId: 'wolfKill',
            currentStepIndex: 0,
            nightSteps: ['wolfKill'],
            isAudioPlaying: true,
            pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
            seerLabelMap: {},
          } as any,
          20,
        );
        // Let microtasks settle (audio play + ack attempt + online listener registration)
        await new Promise((r) => setTimeout(r, 50));
      };

      it('should retry postAudioAck via online event when status listener does not fire', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        await setupRetryFacade();
        await triggerAckFailureAndSettle();

        // Switch fetch to succeed for the online-event retry
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });

        // Fire browser 'online' event (no status listener fired!)
        fireOnlineEvent();
        await new Promise((r) => setTimeout(r, 50));

        // Should have retried postAudioAck
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should re-register online listener when retry fails', async () => {
        // All fetches reject
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        await setupRetryFacade();
        await triggerAckFailureAndSettle();

        // First online event — retry still fails → should re-register
        fireOnlineEvent();
        await new Promise((r) => setTimeout(r, 50));

        // 1 re-registered ack retry listener
        expect(onlineListeners.size).toBe(1);

        // Second online event with success — should work
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });
        fireOnlineEvent();
        await new Promise((r) => setTimeout(r, 50));

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should unregister online listener when status listener fires first', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        await setupRetryFacade();
        await triggerAckFailureAndSettle();

        // Status listener fires first — mock fetch to succeed
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });
        statusListeners.forEach((l) => l(ConnectionState.Connected));
        await new Promise((r) => setTimeout(r, 50));

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
        (global.fetch as jest.Mock).mockClear();

        // Online event fires after — should NOT retry (listener already unregistered)
        fireOnlineEvent();
        await new Promise((r) => setTimeout(r, 50));

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should unregister online listener on leaveRoom', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        const f = await setupRetryFacade();
        await triggerAckFailureAndSettle();

        // Leave room — should unregister online listener
        await f.leaveRoom();

        // Switch fetch to spy
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });

        // Online event fires — should NOT retry (listener cleared)
        fireOnlineEvent();
        await new Promise((r) => setTimeout(r, 50));

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should retry via timer when navigator.onLine is already true (check+listen)', async () => {
        // Simulate: online event already fired before registerOnlineRetry() is called
        // → navigator.onLine = true but no 'online' event will fire again
        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: true,
          writable: true,
          configurable: true,
        });

        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        await setupRetryFacade();
        await triggerAckFailureAndSettle();

        // No ack retry online listener (timer path)
        expect(onlineListeners.size).toBe(0);

        // Switch fetch to succeed for the timer-based retry
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });

        // Wait for the 500ms timer to fire
        await new Promise((r) => setTimeout(r, 600));

        // Should have retried postAudioAck via timer (not online event)
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should retry via poll fallback when online event never fires', async () => {
        // Use fake timers to control the 5s poll interval without waiting
        jest.useFakeTimers();

        // navigator.onLine starts false → listener path + poll started
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        await setupRetryFacade();

        // Inline trigger: applySnapshot → store subscription → playPendingAudioEffects → ack fail
        retryStore.applySnapshot(
          {
            roomCode: 'RTRY',
            hostUid: 'host-uid',
            status: GameStatus.Ongoing,
            templateRoles: [],
            numberOfPlayers: 6,
            players: {},
            currentStepId: 'wolfKill',
            currentStepIndex: 0,
            nightSteps: ['wolfKill'],
            isAudioPlaying: true,
            pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
            seerLabelMap: {},
          } as any,
          20,
        );
        // Advance to let audio play + ack fail + registerOnlineRetry
        await jest.advanceTimersByTimeAsync(100);

        // 1 ack retry online listener
        expect(onlineListeners.size).toBe(1);

        // Simulate: network restored but online event never fires (CI headless Chromium scenario)
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });
        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: true,
          writable: true,
          configurable: true,
        });

        // Advance to poll interval (5s) — poll sees navigator.onLine=true → triggers retry
        await jest.advanceTimersByTimeAsync(5_000);

        jest.useRealTimers();

        // Poll fallback should have triggered ack retry
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should clear poll fallback on leaveRoom', async () => {
        jest.useFakeTimers();

        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        const f = await setupRetryFacade();

        // Inline trigger
        retryStore.applySnapshot(
          {
            roomCode: 'RTRY',
            hostUid: 'host-uid',
            status: GameStatus.Ongoing,
            templateRoles: [],
            numberOfPlayers: 6,
            players: {},
            currentStepId: 'wolfKill',
            currentStepIndex: 0,
            nightSteps: ['wolfKill'],
            isAudioPlaying: true,
            pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
            seerLabelMap: {},
          } as any,
          20,
        );
        await jest.advanceTimersByTimeAsync(100);

        // 1 ack retry online listener
        expect(onlineListeners.size).toBe(1);

        // Leave room — should clear everything including poll
        await f.leaveRoom();

        // Switch fetch to spy
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });
        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: true,
          writable: true,
          configurable: true,
        });

        // Advance past poll interval — should NOT trigger (cleared by leaveRoom)
        await jest.advanceTimersByTimeAsync(5_000);

        jest.useRealTimers();

        expect(global.fetch).not.toHaveBeenCalled();
      });
    }); // end: online event retry (Web platform)
  });
});
