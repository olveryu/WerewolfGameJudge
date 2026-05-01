/**
 * GameFacade 单元测试
 *
 * 测试范围：
 * - Host 创建房间 → store 初始化
 * - Host 入座 → 走 HTTP API 路径
 * - Player 入座 → 走 HTTP API 路径
 * - Player 收到 STATE_UPDATE → applySnapshot
 */

import { gameReducer } from '@werewolf/game-engine/engine/reducer/gameReducer';
import type { PlayerJoinAction } from '@werewolf/game-engine/engine/reducer/types';
import { GameStore } from '@werewolf/game-engine/engine/store';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { GameState, Player, RosterEntry } from '@werewolf/game-engine/protocol/types';

import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import { GameFacade } from '@/services/facade/GameFacade';
import type { AudioService } from '@/services/infra/AudioService';
import type { IRoomService } from '@/services/types/IRoomService';

// P0-1: Mock AudioService
const mockAudioServiceInstance = {
  playNightAudio: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  playNightEndAudio: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  playRoleBeginningAudio: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  playRoleEndingAudio: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  preloadForRoles: jest.fn<Promise<void>, [RoleId[]]>().mockResolvedValue(undefined),
  clearPreloaded: jest.fn<void, []>(),
  cleanup: jest.fn<void, []>(),
  stop: jest.fn<void, []>(),
  stopBgm: jest.fn<void, []>(),
};
jest.mock('../../infra/AudioService', () => ({
  __esModule: true,
  AudioService: jest.fn(() => mockAudioServiceInstance),
}));

// fetchWithRetry passthrough: tests mock global.fetch directly,
// so bypass network-layer retry to avoid delays and timer interference.
jest.mock('@/services/cloudflare/cfFetch', () => ({
  ...jest.requireActual<typeof import('@/services/cloudflare/cfFetch')>(
    '@/services/cloudflare/cfFetch',
  ),
  fetchWithRetry: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
}));

// Mock RoomService (DB state persistence)
const mockRoomService = () =>
  ({
    getGameState: jest
      .fn<Promise<{ state: GameState; revision: number } | null>, [string]>()
      .mockResolvedValue(null),
  }) as unknown as IRoomService;

/** Helper: build a complete GameState with sensible defaults for tests */
function buildTestState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'TEST',
    hostUserId: 'host-uid',
    status: GameStatus.Unseated,
    templateRoles: [] as RoleId[],
    players: {},
    roster: {},
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    ...overrides,
  };
}

/**
 * Create a mock ConnectionManager.
 * If store + roomService are provided, connectAndWait simulates the real FSM flow:
 * fetch DB state → applySnapshot (mimicking Syncing → Connected transition).
 */
const createMockConnectionManager = (
  store?: GameStore,
  roomService?: {
    getGameState: jest.Mock<Promise<{ state: GameState; revision: number } | null>, [string]>;
  },
) => ({
  connectAndWait: jest
    .fn<Promise<void>, [string, string]>()
    .mockImplementation(async (roomCode: string) => {
      if (store && roomService) {
        const dbState = await roomService.getGameState(roomCode);
        if (dbState) store.applySnapshot(dbState.state, dbState.revision);
      }
    }),
  connect: jest.fn<void, [string, string]>(),
  dispose: jest.fn<void, []>(),
  manualReconnect: jest.fn<void, []>(),
  addStateListener: jest.fn<() => void, [(...args: unknown[]) => void]>().mockReturnValue(() => {}),
  updateRevision: jest.fn<void, [number]>(),
  getState: jest.fn<string, []>().mockReturnValue('Idle'),
  getContext: jest.fn().mockReturnValue({ state: 'Idle', attempt: 0, lastRevision: 0 }),
});

describe('GameFacade', () => {
  let facade: GameFacade;
  let testStore: GameStore;
  let mockConnectionManager: {
    connectAndWait: jest.Mock<Promise<void>, [string, string]>;
    connect: jest.Mock<void, [string, string]>;
    disconnect: jest.Mock<void, []>;
    dispose: jest.Mock<void, []>;
    manualReconnect: jest.Mock<void, []>;
    addStateListener: jest.Mock<() => void, [(...args: unknown[]) => void]>;
    updateRevision: jest.Mock<void, [number]>;
    getState: jest.Mock<string, []>;
    getContext: jest.Mock;
  };

  const mockTemplate: GameTemplate = {
    name: 'Test Template',
    numberOfPlayers: 6,
    roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'] as RoleId[],
  };

  beforeEach(() => {
    // Setup mock ConnectionManager
    mockConnectionManager = {
      connectAndWait: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined),
      connect: jest.fn<void, [string, string]>(),
      disconnect: jest.fn<void, []>(),
      dispose: jest.fn<void, []>(),
      manualReconnect: jest.fn<void, []>(),
      addStateListener: jest
        .fn<() => void, [(...args: unknown[]) => void]>()
        .mockReturnValue(() => {}),
      updateRevision: jest.fn<void, [number]>(),
      getState: jest.fn<string, []>().mockReturnValue('Idle'),
      getContext: jest.fn().mockReturnValue({ state: 'Idle', attempt: 0, lastRevision: 0 }),
    };

    // DI: 直接注入 mock，无需 singleton
    testStore = new GameStore();
    facade = new GameFacade({
      store: testStore,
      connectionManager: mockConnectionManager as unknown as ConnectionManager,
      audioService: mockAudioServiceInstance as unknown as AudioService,
      roomService: mockRoomService(),
    });
  });

  // ===========================================================================
  // Shared Helper: 通过 PLAYER_JOIN actions + reducer 填充所有座位
  // ===========================================================================
  const fillAllSeatsViaReducer = (_facadeInstance: GameFacade, template: typeof mockTemplate) => {
    let state: GameState = testStore.getState()!;

    for (let i = 0; i < template.numberOfPlayers; i++) {
      const userId = i === 0 ? 'host-uid' : `player-${i}`;
      const player: Player = {
        userId,
        seat: i,
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
      expect(facade.getMyUserId()).toBe('host-uid');
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
          body: expect.stringContaining('"action":"sit"') as string,
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
      expect(facade.getMyUserId()).toBe('player-uid');

      expect(mockConnectionManager.connectAndWait).toHaveBeenCalledWith('ABCD', 'player-uid');
    });
  });

  describe('Player: takeSeat (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.joinRoom('ABCD', 'player-uid', false);

      // Player must receive state to populate roomCode in store
      testStore.applySnapshot(
        buildTestState({
          roomCode: 'ABCD',
          templateRoles: ['wolf', 'seer'] as RoleId[],
          players: { 0: null, 1: null },
        }),
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
          body: expect.stringContaining('"action":"sit"') as string,
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
              hostUserId: 'host-uid',
              status: GameStatus.Unseated,
              templateRoles: [],
              players: {
                0: null,
                1: {
                  userId: 'player-uid',
                  seat: 1,
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
      expect(facade.getMySeat()).toBe(1);
      expect(facade.getStateRevision()).toBe(2);
    });
  });

  describe('Player: receive STATE_UPDATE', () => {
    beforeEach(async () => {
      await facade.joinRoom('ABCD', 'player-uid', false);
    });

    it('should apply snapshot when receiving state via postgres_changes', () => {
      const state = buildTestState({
        roomCode: 'ABCD',
        templateRoles: ['wolf', 'seer'] as RoleId[],
        players: {
          0: null,
          1: {
            userId: 'player-uid',
            seat: 1,
            hasViewedRole: false,
          },
        },
      });

      testStore.applySnapshot(state, 5);

      expect(facade.getStateRevision()).toBe(5);
      expect(facade.getMySeat()).toBe(1);
    });
  });

  describe('Player: takeSeatWithAck reason transparency (HTTP API)', () => {
    const originalFetch = global.fetch;

    beforeEach(async () => {
      await facade.joinRoom('ABCD', 'player-uid', false);

      // Player must receive state to populate roomCode in store
      testStore.applySnapshot(
        buildTestState({
          roomCode: 'ABCD',
          templateRoles: ['wolf', 'seer'] as RoleId[],
          players: { 0: null, 1: null },
        }),
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
        buildTestState({
          roomCode: 'ABCD',
          templateRoles: ['wolf', 'seer'] as RoleId[],
          players: { 0: null, 1: null },
        }),
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
      expect(facade.getMyUserId()).toBeNull();
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
          body: expect.stringContaining('"roomCode":"ABCD"') as string,
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
        connectionManager: mockConnectionManager as unknown as ConnectionManager,
        audioService: mockAudioServiceInstance as unknown as AudioService,
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

    it('should call view-role API with userId and seat', async () => {
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
          body: expect.stringContaining('"seat":2') as string,
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"userId":"host-uid"') as string,
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
            hostUserId: 'host-uid',
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
        connectionManager: createMockConnectionManager(
          playerStore,
          playerRoomService,
        ) as unknown as ConnectionManager,
        audioService: mockAudioServiceInstance as unknown as AudioService,
        roomService: playerRoomService as unknown as IRoomService,
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
          body: expect.stringContaining('"roomCode":"ABCD"') as string,
        }),
      );
    });

    it('should return NOT_CONNECTED when not connected', async () => {
      const emptyFacade = new GameFacade({
        store: new GameStore(),
        connectionManager: mockConnectionManager as unknown as ConnectionManager,
        audioService: mockAudioServiceInstance as unknown as AudioService,
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
          body: expect.stringContaining('"role":"seer"') as string,
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
        hostUserId: 'host-uid',
        status: GameStatus.Ongoing as const,
        templateRoles: ['wolf', 'villager'],
        players: {
          0: {
            userId: 'host-uid',
            seat: 0,
            displayName: 'Host',
            avatarUrl: undefined,
            role: 'wolf',
            hasViewedRole: true,
          },
          1: {
            userId: 'player-2',
            seat: 1,
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
        connectionManager: createMockConnectionManager(
          rejoinStore,
          rejoinRoomService,
        ) as unknown as ConnectionManager,
        audioService: mockAudioServiceInstance as unknown as AudioService,
        roomService: rejoinRoomService as unknown as IRoomService,
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
        connectionManager: createMockConnectionManager(
          rejoinStore2,
          rejoinRoomService2,
        ) as unknown as ConnectionManager,
        audioService: mockAudioServiceInstance as unknown as AudioService,
        roomService: rejoinRoomService2 as unknown as IRoomService,
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
          hostUserId: 'host-uid',
          status: GameStatus.Ongoing as const,
          templateRoles: ['wolf', 'villager'],
          players: {
            0: {
              userId: 'host-uid',
              seat: 0,
              displayName: 'Host',
              avatarUrl: undefined,
              role: 'wolf',
              hasViewedRole: true,
            },
            1: {
              userId: 'player-2',
              seat: 1,
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
        connectionManager: createMockConnectionManager(
          rejoinStore,
          rejoinRoomService,
        ) as unknown as ConnectionManager,
        audioService: mockAudioServiceInstance as unknown as AudioService,
        roomService: rejoinRoomService as unknown as IRoomService,
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
        connectAndWait: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined),
        connect: jest.fn<void, [string, string]>(),
        disconnect: jest.fn<void, []>(),
        dispose: jest.fn<void, []>(),
        manualReconnect: jest.fn<void, []>(),
        addStateListener: jest
          .fn<() => void, [(...args: unknown[]) => void]>()
          .mockImplementation((listener: (s: string) => void) => {
            statusListeners.push(listener);
            return () => {
              statusListeners = statusListeners.filter((l) => l !== listener);
            };
          }),
        updateRevision: jest.fn<void, [number]>(),
        getState: jest.fn<string, []>().mockReturnValue('Idle'),
        getContext: jest.fn().mockReturnValue({ state: 'Idle', attempt: 0, lastRevision: 0 }),
      };

      retryStore = new GameStore();
      const f = new GameFacade({
        store: retryStore,
        connectionManager: retryConnectionManager as unknown as ConnectionManager,
        audioService: mockAudioServiceInstance as unknown as AudioService,
        roomService: {
          getGameState: jest.fn().mockResolvedValue({
            state: buildTestState({
              roomCode: 'RTRY',
              status: GameStatus.Ongoing,
              currentStepId: 'wolfKill',
              currentStepIndex: 0,
              isAudioPlaying: true,
              pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
              seerLabelMap: {},
            }),
            revision: 10,
          }),
        } as unknown as IRoomService,
      });
      await f.createRoom('RTRY', 'host-uid', mockTemplate);
      return f;
    };

    it('should set #pendingAudioAckRetry when postAudioAck fails during playback', async () => {
      jest.useFakeTimers();
      // Mock fetch to simulate network error on audio-ack
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
      await setupRetryFacade();

      // Trigger #playPendingAudioEffects manually via store subscription
      // The facade constructor subscribes to store, so applySnapshot with pendingAudioEffects triggers it
      const store = retryStore;
      store.applySnapshot(
        buildTestState({
          roomCode: 'RTRY',
          status: GameStatus.Ongoing,
          currentStepId: 'wolfKill',
          currentStepIndex: 0,
          isAudioPlaying: true,
          pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
          seerLabelMap: {},
        }),
        20,
      );

      // Advance past callApiWithRetry NETWORK_ERROR retry delays
      await jest.advanceTimersByTimeAsync(1500);

      // Now simulate reconnect — mock fetch to succeed this time
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });
      mockAudioServiceInstance.playRoleBeginningAudio.mockClear();

      // Fire 'live' status to all registered listeners
      statusListeners.forEach((l) => l(ConnectionState.Connected));

      // Flush microtasks for async retry (audio replay + ack)
      await jest.advanceTimersByTimeAsync(50);

      jest.useRealTimers();

      // Should have replayed audio effects before retrying ack
      expect(mockAudioServiceInstance.playRoleBeginningAudio).toHaveBeenCalledWith('wolf');
      // Should have retried postAudioAck
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/game/night/audio-ack'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should not retry postAudioAck on reconnect when ack succeeded during playback', async () => {
      jest.useFakeTimers();
      // Mock fetch to succeed for audio-ack
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });
      await setupRetryFacade();

      const store = retryStore;
      store.applySnapshot(
        buildTestState({
          roomCode: 'RTRY',
          status: GameStatus.Ongoing,
          currentStepId: 'wolfKill',
          currentStepIndex: 0,
          isAudioPlaying: true,
          pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
          seerLabelMap: {},
        }),
        20,
      );

      // Flush async audio effects + ack
      await jest.advanceTimersByTimeAsync(50);
      (global.fetch as jest.Mock).mockClear();

      // Fire 'live' — should NOT retry since ack succeeded
      statusListeners.forEach((l) => l(ConnectionState.Connected));
      await jest.advanceTimersByTimeAsync(50);

      jest.useRealTimers();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should reset #pendingAudioAckRetry on leaveRoom', async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
      const f = await setupRetryFacade();

      const store = retryStore;
      store.applySnapshot(
        buildTestState({
          roomCode: 'RTRY',
          status: GameStatus.Ongoing,
          currentStepId: 'wolfKill',
          currentStepIndex: 0,
          isAudioPlaying: true,
          pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
          seerLabelMap: {},
        }),
        20,
      );
      // Advance past callApiWithRetry NETWORK_ERROR retries
      await jest.advanceTimersByTimeAsync(1500);

      // Leave room resets the flag
      await f.leaveRoom();

      // Now reconnect should NOT retry
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      });
      statusListeners.forEach((l) => l(ConnectionState.Connected));
      await jest.advanceTimersByTimeAsync(50);

      jest.useRealTimers();

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
        const mutableWindow = globalThis.window as unknown as Record<string, unknown>;
        mutableWindow.addEventListener = (type: string, listener: EventListener) => {
          if (type === 'online') onlineListeners.add(listener);
        };
        mutableWindow.removeEventListener = (type: string, listener: EventListener) => {
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
        const mutableWindow = globalThis.window as unknown as Record<string, unknown>;
        if (origAddEventListener) {
          globalThis.window.addEventListener = origAddEventListener;
        } else {
          delete mutableWindow.addEventListener;
        }
        if (origRemoveEventListener) {
          globalThis.window.removeEventListener = origRemoveEventListener;
        } else {
          delete mutableWindow.removeEventListener;
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
          buildTestState({
            roomCode: 'RTRY',
            status: GameStatus.Ongoing,
            currentStepId: 'wolfKill',
            currentStepIndex: 0,
            isAudioPlaying: true,
            pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
            seerLabelMap: {},
          }),
          20,
        );
        // Advance past callApiWithRetry NETWORK_ERROR retry delays + online listener registration
        await jest.advanceTimersByTimeAsync(1500);
      };

      it('should retry postAudioAck via online event when status listener does not fire', async () => {
        jest.useFakeTimers();
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
        await jest.advanceTimersByTimeAsync(50);

        jest.useRealTimers();

        // Should have retried postAudioAck
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should re-register online listener when retry fails', async () => {
        jest.useFakeTimers();
        // All fetches reject
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        await setupRetryFacade();
        await triggerAckFailureAndSettle();

        // First online event — retry still fails → should re-register
        fireOnlineEvent();
        // Advance past callApiWithRetry NETWORK_ERROR retries
        await jest.advanceTimersByTimeAsync(1500);

        // 1 re-registered ack retry listener
        expect(onlineListeners.size).toBe(1);

        // Second online event with success — should work
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });
        fireOnlineEvent();
        await jest.advanceTimersByTimeAsync(50);

        jest.useRealTimers();

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('should unregister online listener when status listener fires first', async () => {
        jest.useFakeTimers();
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
        await jest.advanceTimersByTimeAsync(50);

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/game/night/audio-ack'),
          expect.objectContaining({ method: 'POST' }),
        );
        (global.fetch as jest.Mock).mockClear();

        // Online event fires after — should NOT retry (listener already unregistered)
        fireOnlineEvent();
        await jest.advanceTimersByTimeAsync(50);

        jest.useRealTimers();

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should unregister online listener on leaveRoom', async () => {
        jest.useFakeTimers();
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
        await jest.advanceTimersByTimeAsync(50);

        jest.useRealTimers();

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should retry via timer when navigator.onLine is already true (check+listen)', async () => {
        // Use fake timers to avoid flaky real-timer waits with exponential backoff
        jest.useFakeTimers();

        // Simulate: online event already fired before registerOnlineRetry() is called
        // → navigator.onLine = true but no 'online' event will fire again
        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: true,
          writable: true,
          configurable: true,
        });

        global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
        await setupRetryFacade();

        // Inline trigger (can't use triggerAckFailureAndSettle — its real setTimeout is faked)
        retryStore.applySnapshot(
          buildTestState({
            roomCode: 'RTRY',
            status: GameStatus.Ongoing,
            currentStepId: 'wolfKill',
            currentStepIndex: 0,
            isAudioPlaying: true,
            pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
            seerLabelMap: {},
          }),
          20,
        );
        // Advance to let audio play + ack fail (including callApiWithRetry
        // NETWORK_ERROR retry delays ~1000ms) + registerOnlineRetry (timer path)
        await jest.advanceTimersByTimeAsync(1500);

        // No ack retry online listener (timer path — onLine=true skips addEventListener)
        expect(onlineListeners.size).toBe(0);

        // Switch fetch to succeed for the timer-based retry
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true }),
        });

        // Advance past the exponential backoff timer (500ms * 2^attempt, up to 16s)
        await jest.advanceTimersByTimeAsync(16_000);

        jest.useRealTimers();

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
          buildTestState({
            roomCode: 'RTRY',
            status: GameStatus.Ongoing,
            currentStepId: 'wolfKill',
            currentStepIndex: 0,
            isAudioPlaying: true,
            pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
            seerLabelMap: {},
          }),
          20,
        );
        // Advance to let audio play + ack fail (including callApiWithRetry
        // NETWORK_ERROR retry delays ~1000ms) + registerOnlineRetry
        await jest.advanceTimersByTimeAsync(1500);

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
          buildTestState({
            roomCode: 'RTRY',
            status: GameStatus.Ongoing,
            currentStepId: 'wolfKill',
            currentStepIndex: 0,
            isAudioPlaying: true,
            pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
            seerLabelMap: {},
          }),
          20,
        );
        // Advance to let audio play + ack fail (including callApiWithRetry
        // NETWORK_ERROR retry delays ~1000ms) + registerOnlineRetry
        await jest.advanceTimersByTimeAsync(1500);

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
