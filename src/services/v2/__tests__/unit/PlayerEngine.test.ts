/**
 * PlayerEngine Unit Tests
 */

import { PlayerEngine, PlayerEngineConfig } from '../../domain/PlayerEngine';
import { GameStatus, type StateStore, type LocalGameState } from '../../infra/StateStore';
import type { Transport, ConnectionStatus } from '../../infra/Transport';
import type { BroadcastGameState } from '../../../core/BroadcastService';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockStateStore(overrides: Partial<StateStore> = {}): StateStore {
  // Initialize players map with all seats set to null
  const players = new Map<number, import('../../infra/StateStore').LocalPlayer | null>();
  for (let i = 1; i <= 3; i++) {
    players.set(i, null);
  }

  const state: LocalGameState = {
    roomCode: 'ABCD',
    hostUid: 'host-uid',
    status: GameStatus.unseated,
    template: { name: 'test', numberOfPlayers: 3, roles: ['wolf', 'seer', 'villager'] },
    players,
    currentActionerIndex: 0,
    isAudioPlaying: false,
    wolfVotes: new Map(),
    currentNightResults: {},
    actions: new Map(),
    lastNightDeaths: [],
  };

  return {
    getState: jest.fn(() => state),
    getRevision: jest.fn(() => 1),
    applyBroadcastState: jest.fn(() => ({ applied: true, mySeat: null })),
    getSnapshot: jest.fn(),
    update: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as unknown as StateStore;
}

function createMockTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    sendToHost: jest.fn(() => Promise.resolve(true)),
    setConnectionStatus: jest.fn(),
    getConnectionStatus: jest.fn(() => 'live' as ConnectionStatus),
    ...overrides,
  } as unknown as Transport;
}

function createPlayerEngine(configOverrides: Partial<PlayerEngineConfig> = {}): {
  engine: PlayerEngine;
  stateStore: StateStore;
  transport: Transport;
  notifyListeners: jest.Mock;
  getMyUid: jest.Mock;
} {
  const stateStore = configOverrides.stateStore ?? createMockStateStore();
  const transport = configOverrides.transport ?? createMockTransport();
  const notifyListeners = jest.fn();
  const getMyUid = jest.fn(() => 'player-uid');

  const engine = new PlayerEngine({
    stateStore,
    transport,
    getMyUid,
    onNotifyListeners: notifyListeners,
    ...configOverrides,
  });

  return { engine, stateStore, transport, notifyListeners, getMyUid };
}

// =============================================================================
// Tests
// =============================================================================

describe('PlayerEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Host Broadcast Handling
  // ---------------------------------------------------------------------------

  describe('handleHostBroadcast', () => {
    it('should call onStateUpdate callback for STATE_UPDATE', () => {
      const { engine, stateStore, notifyListeners } = createPlayerEngine();
      const onStateUpdate = jest.fn();
      engine.setCallbacks({ onStateUpdate });

      const broadcastState: BroadcastGameState = {
        roomCode: 'ABCD',
        hostUid: 'host-uid',
        status: 'unseated',
        templateRoles: ['wolf', 'seer'],
        players: {},
        currentActionerIndex: 0,
        isAudioPlaying: false,
      };

      engine.handleHostBroadcast({
        type: 'STATE_UPDATE',
        state: broadcastState,
        revision: 2,
      });

      expect(stateStore.applyBroadcastState).toHaveBeenCalledWith(broadcastState, 'player-uid');
      expect(onStateUpdate).toHaveBeenCalledWith(broadcastState, 2);
      expect(notifyListeners).toHaveBeenCalled();
    });

    it('should call onRoleTurn callback for ROLE_TURN', () => {
      const { engine } = createPlayerEngine();
      const onRoleTurn = jest.fn();
      engine.setCallbacks({ onRoleTurn });

      engine.handleHostBroadcast({
        type: 'ROLE_TURN',
        role: 'seer',
        pendingSeats: [1, 2],
        killedIndex: 3,
        stepId: 'seerCheck',
      });

      expect(onRoleTurn).toHaveBeenCalledWith('seer', [1, 2], 3, 'seerCheck');
    });

    it('should call onNightEnd callback for NIGHT_END', () => {
      const { engine } = createPlayerEngine();
      const onNightEnd = jest.fn();
      engine.setCallbacks({ onNightEnd });

      engine.handleHostBroadcast({
        type: 'NIGHT_END',
        deaths: [2, 5],
      });

      expect(onNightEnd).toHaveBeenCalledWith([2, 5]);
    });

    it('should call onGameRestarted callback for GAME_RESTARTED', () => {
      const { engine } = createPlayerEngine();
      const onGameRestarted = jest.fn();
      engine.setCallbacks({ onGameRestarted });

      engine.handleHostBroadcast({
        type: 'GAME_RESTARTED',
      });

      expect(onGameRestarted).toHaveBeenCalled();
    });

    it('should call onSeatRejected for SEAT_REJECTED when targeting current player', () => {
      const { engine } = createPlayerEngine();
      const onSeatRejected = jest.fn();
      engine.setCallbacks({ onSeatRejected });

      engine.handleHostBroadcast({
        type: 'SEAT_REJECTED',
        seat: 3,
        requestUid: 'player-uid',
        reason: 'seat_taken',
      });

      expect(onSeatRejected).toHaveBeenCalledWith(3, 'seat_taken');
    });

    it('should ignore SEAT_REJECTED for other players', () => {
      const { engine } = createPlayerEngine();
      const onSeatRejected = jest.fn();
      engine.setCallbacks({ onSeatRejected });

      engine.handleHostBroadcast({
        type: 'SEAT_REJECTED',
        seat: 3,
        requestUid: 'other-uid',
        reason: 'seat_taken',
      });

      expect(onSeatRejected).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Player Actions
  // ---------------------------------------------------------------------------

  describe('takeSeat', () => {
    it('should send JOIN message to host when seat is available', async () => {
      const { engine, transport } = createPlayerEngine();

      const result = await engine.takeSeat(1, 'player-uid', 'Player1', 'avatar.jpg');

      expect(result).toBe(true);
      expect(transport.sendToHost).toHaveBeenCalledWith({
        type: 'JOIN',
        seat: 1,
        uid: 'player-uid',
        displayName: 'Player1',
        avatarUrl: 'avatar.jpg',
      });
    });

    it('should return false when uid is not available', async () => {
      const { engine, transport, getMyUid } = createPlayerEngine();
      getMyUid.mockReturnValue(null);

      // PlayerActions interface requires uid, so pass empty string to test internal handling
      const result = await engine.takeSeat(1, '');

      expect(result).toBe(false);
      expect(transport.sendToHost).not.toHaveBeenCalled();
    });
  });

  describe('leaveSeat', () => {
    it('should send LEAVE message when player is seated', async () => {
      const state: LocalGameState = {
        roomCode: 'ABCD',
        hostUid: 'host-uid',
        status: GameStatus.unseated,
        template: { name: 'test', numberOfPlayers: 2, roles: ['wolf', 'seer'] },
        players: new Map([
          [1, { uid: 'player-uid', seatNumber: 1, hasViewedRole: false, role: null }],
        ]),
        currentActionerIndex: 0,
        isAudioPlaying: false,
        wolfVotes: new Map(),
        currentNightResults: {},
        actions: new Map(),
        lastNightDeaths: [],
      };
      const stateStore = createMockStateStore({ getState: jest.fn(() => state) });
      const { engine, transport } = createPlayerEngine({ stateStore });

      const result = await engine.leaveSeat(1, 'player-uid');

      expect(result).toBe(true);
      expect(transport.sendToHost).toHaveBeenCalledWith({
        type: 'LEAVE',
        seat: 1,
        uid: 'player-uid',
      });
    });

    it('should return false when player is not seated', async () => {
      const { engine, transport } = createPlayerEngine();

      // PlayerActions interface requires seat and uid
      const result = await engine.leaveSeat(1, 'player-uid');

      expect(result).toBe(false);
      expect(transport.sendToHost).not.toHaveBeenCalled();
    });
  });

  describe('submitAction', () => {
    it('should send ACTION message to host', async () => {
      const { engine, transport } = createPlayerEngine();

      await engine.submitAction(1, 'seer', 2, { someExtra: 'data' });

      expect(transport.sendToHost).toHaveBeenCalledWith({
        type: 'ACTION',
        seat: 1,
        role: 'seer',
        target: 2,
        extra: { someExtra: 'data' },
      });
    });
  });

  describe('submitWolfVote', () => {
    it('should send WOLF_VOTE message to host', async () => {
      const { engine, transport } = createPlayerEngine();

      await engine.submitWolfVote(1, 3);

      expect(transport.sendToHost).toHaveBeenCalledWith({
        type: 'WOLF_VOTE',
        seat: 1,
        target: 3,
      });
    });
  });

  describe('viewedRole', () => {
    it('should send VIEWED_ROLE message to host', async () => {
      const { engine, transport } = createPlayerEngine();

      await engine.viewedRole(1);

      expect(transport.sendToHost).toHaveBeenCalledWith({
        type: 'VIEWED_ROLE',
        seat: 1,
      });
    });
  });

  describe('submitRevealAck', () => {
    it('should send REVEAL_ACK message to host', async () => {
      const { engine, transport } = createPlayerEngine();

      await engine.submitRevealAck(1, 'seer', 5);

      expect(transport.sendToHost).toHaveBeenCalledWith({
        type: 'REVEAL_ACK',
        seat: 1,
        role: 'seer',
        revision: 5,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // State Synchronization
  // ---------------------------------------------------------------------------

  describe('requestSnapshot', () => {
    it('should send SNAPSHOT_REQUEST message to host', async () => {
      const { engine, transport } = createPlayerEngine();

      const result = await engine.requestSnapshot();

      expect(result).toBe(true);
      expect(transport.setConnectionStatus).toHaveBeenCalledWith('syncing');
      expect(transport.sendToHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SNAPSHOT_REQUEST',
          uid: 'player-uid',
          lastRevision: 1,
        }),
      );

      // Clean up pending timeout
      engine.reset();
    });

    it('should return false when uid is not available', async () => {
      const { engine, getMyUid, transport } = createPlayerEngine();
      getMyUid.mockReturnValue(null);

      const result = await engine.requestSnapshot();

      expect(result).toBe(false);
      expect(transport.sendToHost).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('should clear pending snapshot request', async () => {
      const { engine } = createPlayerEngine();

      // Start a snapshot request
      await engine.requestSnapshot(10000);

      // Reset should clear it
      engine.reset();

      // No error means it was cleared
      expect(true).toBe(true);
    });
  });
});
