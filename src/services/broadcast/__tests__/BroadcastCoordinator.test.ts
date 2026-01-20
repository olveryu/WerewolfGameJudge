/**
 * BroadcastCoordinator Unit Tests
 *
 * Phase 3 of GameStateService refactoring.
 * Tests cover:
 * - Host broadcast sending
 * - Player message sending
 * - Host message handling
 * - Player message handling
 * - Handler registration
 */

import type { BroadcastGameState, HostBroadcast, PlayerMessage } from '../../BroadcastService';
import { BroadcastService } from '../../BroadcastService';
import {
  BroadcastCoordinator,
  type BroadcastCoordinatorConfig,
  type HostMessageHandlers,
  type PlayerMessageHandlers,
} from '../BroadcastCoordinator';

// Mock BroadcastService
jest.mock('../../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(),
  },
}));

// ===========================================================================
// Test Fixtures
// ===========================================================================

function createMockBroadcastService(): jest.Mocked<Partial<BroadcastService>> {
  return {
    broadcastAsHost: jest.fn().mockResolvedValue(undefined),
    sendToHost: jest.fn().mockResolvedValue(undefined),
    markAsLive: jest.fn(),
  };
}

function createMockConfig(
  overrides: Partial<BroadcastCoordinatorConfig> = {},
): BroadcastCoordinatorConfig {
  return {
    isHost: jest.fn().mockReturnValue(false),
    getMyUid: jest.fn().mockReturnValue('user-123'),
    getRevision: jest.fn().mockReturnValue(5),
    toBroadcastState: jest.fn().mockReturnValue({
      roomCode: 'ABCD',
      hostUid: 'host-123',
      status: 'unseated',
      templateRoles: [],
      players: {},
      currentActionerIndex: 0,
      isAudioPlaying: false,
    } as BroadcastGameState),
    ...overrides,
  };
}

function createMockHostHandlers(): jest.Mocked<HostMessageHandlers> {
  return {
    onRequestState: jest.fn().mockResolvedValue(undefined),
    onJoin: jest.fn().mockResolvedValue(undefined),
    onLeave: jest.fn().mockResolvedValue(undefined),
    onAction: jest.fn().mockResolvedValue(undefined),
    onRevealAck: jest.fn().mockResolvedValue(undefined),
    onWolfVote: jest.fn().mockResolvedValue(undefined),
    onViewedRole: jest.fn().mockResolvedValue(undefined),
    onSeatActionRequest: jest.fn().mockResolvedValue(undefined),
    onSnapshotRequest: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPlayerHandlers(): jest.Mocked<PlayerMessageHandlers> {
  return {
    onStateUpdate: jest.fn(),
    onRoleTurn: jest.fn(),
    onNightEnd: jest.fn(),
    onSeatRejected: jest.fn(),
    onSeatActionAck: jest.fn(),
    onSnapshotResponse: jest.fn(),
    onGameRestarted: jest.fn(),
  };
}

// ===========================================================================
// Test Suite
// ===========================================================================

describe('BroadcastCoordinator', () => {
  let coordinator: BroadcastCoordinator;
  let mockBroadcastService: jest.Mocked<Partial<BroadcastService>>;
  let mockConfig: BroadcastCoordinatorConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBroadcastService = createMockBroadcastService();
    (BroadcastService.getInstance as jest.Mock).mockReturnValue(mockBroadcastService);

    mockConfig = createMockConfig();
    coordinator = new BroadcastCoordinator(mockConfig);
  });

  // =========================================================================
  // Host: Send Broadcasts
  // =========================================================================

  describe('Host broadcast sending', () => {
    it('should broadcast state update', async () => {
      const state: BroadcastGameState = {
        roomCode: 'TEST',
        hostUid: 'host-123',
        status: 'unseated',
        templateRoles: [],
        players: {},
        currentActionerIndex: 0,
        isAudioPlaying: false,
      };

      await coordinator.broadcastState(state, 10);

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'STATE_UPDATE',
        state,
        revision: 10,
      });
    });

    it('should broadcast role turn', async () => {
      await coordinator.broadcastRoleTurn('seer', [1, 2], {
        killedIndex: 3,
        stepId: 'seer',
      });

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'ROLE_TURN',
        role: 'seer',
        pendingSeats: [1, 2],
        killedIndex: 3,
        stepId: 'seer',
      });
    });

    it('should broadcast night end', async () => {
      await coordinator.broadcastNightEnd([1, 3]);

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'NIGHT_END',
        deaths: [1, 3],
      });
    });

    it('should broadcast seat rejected', async () => {
      await coordinator.broadcastSeatRejected(5, 'user-456', 'seat_taken');

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'SEAT_REJECTED',
        seat: 5,
        requestUid: 'user-456',
        reason: 'seat_taken',
      });
    });

    it('should broadcast seat action ACK', async () => {
      await coordinator.broadcastSeatActionAck({
        requestId: 'req-1',
        toUid: 'user-123',
        success: true,
        seat: 3,
      });

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-1',
        toUid: 'user-123',
        success: true,
        seat: 3,
      });
    });

    it('should broadcast snapshot response', async () => {
      const state: BroadcastGameState = {
        roomCode: 'TEST',
        hostUid: 'host-123',
        status: 'unseated',
        templateRoles: [],
        players: {},
        currentActionerIndex: 0,
        isAudioPlaying: false,
      };

      await coordinator.broadcastSnapshotResponse({
        requestId: 'snap-1',
        toUid: 'user-456',
        state,
        revision: 15,
      });

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'SNAPSHOT_RESPONSE',
        requestId: 'snap-1',
        toUid: 'user-456',
        state,
        revision: 15,
      });
    });

    it('should broadcast game restarted', async () => {
      await coordinator.broadcastGameRestarted();

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith({
        type: 'GAME_RESTARTED',
      });
    });
  });

  // =========================================================================
  // Player: Send Messages
  // =========================================================================

  describe('Player message sending', () => {
    it('should request state', async () => {
      await coordinator.requestState('user-123');

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'REQUEST_STATE',
        uid: 'user-123',
      });
    });

    it('should request snapshot', async () => {
      await coordinator.requestSnapshot('snap-1', 'user-123', 10);

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'SNAPSHOT_REQUEST',
        requestId: 'snap-1',
        uid: 'user-123',
        lastRevision: 10,
      });
    });

    it('should send seat action request', async () => {
      await coordinator.sendSeatActionRequest({
        requestId: 'req-1',
        action: 'sit',
        seat: 3,
        uid: 'user-123',
        displayName: 'Player 1',
      });

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-1',
        action: 'sit',
        seat: 3,
        uid: 'user-123',
        displayName: 'Player 1',
      });
    });

    it('should send action', async () => {
      await coordinator.sendAction(1, 'seer', 2, { extra: 'data' });

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'ACTION',
        seat: 1,
        role: 'seer',
        target: 2,
        extra: { extra: 'data' },
      });
    });

    it('should send wolf vote', async () => {
      await coordinator.sendWolfVote(2, 5);

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'WOLF_VOTE',
        seat: 2,
        target: 5,
      });
    });

    it('should send reveal ACK', async () => {
      await coordinator.sendRevealAck(1, 'seer', 10);

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'REVEAL_ACK',
        seat: 1,
        role: 'seer',
        revision: 10,
      });
    });

    it('should send viewed role', async () => {
      await coordinator.sendViewedRole(3);

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'VIEWED_ROLE',
        seat: 3,
      });
    });
  });

  // =========================================================================
  // Player: Handle Host Broadcasts
  // =========================================================================

  describe('Player handling host broadcasts', () => {
    let handlers: jest.Mocked<PlayerMessageHandlers>;
    let hostBroadcastHandler: (msg: HostBroadcast) => void;

    beforeEach(() => {
      handlers = createMockPlayerHandlers();
      coordinator.setPlayerHandlers(handlers);
      hostBroadcastHandler = coordinator.getHostBroadcastHandler();
    });

    it('should handle STATE_UPDATE', () => {
      const state: BroadcastGameState = {
        roomCode: 'TEST',
        hostUid: 'host-123',
        status: 'unseated',
        templateRoles: [],
        players: {},
        currentActionerIndex: 0,
        isAudioPlaying: false,
      };

      hostBroadcastHandler({
        type: 'STATE_UPDATE',
        state,
        revision: 10,
      });

      expect(handlers.onStateUpdate).toHaveBeenCalledWith(state, 10);
    });

    it('should ignore STATE_UPDATE if isHost', () => {
      (mockConfig.isHost as jest.Mock).mockReturnValue(true);

      hostBroadcastHandler({
        type: 'STATE_UPDATE',
        state: {} as BroadcastGameState,
        revision: 10,
      });

      expect(handlers.onStateUpdate).not.toHaveBeenCalled();
    });

    it('should handle ROLE_TURN', () => {
      hostBroadcastHandler({
        type: 'ROLE_TURN',
        role: 'seer',
        pendingSeats: [1, 2],
        stepId: 'seerCheck',
      } as HostBroadcast);

      expect(handlers.onRoleTurn).toHaveBeenCalledWith({
        role: 'seer',
        pendingSeats: [1, 2],
        stepId: 'seerCheck',
      });
    });

    it('should handle NIGHT_END', () => {
      hostBroadcastHandler({
        type: 'NIGHT_END',
        deaths: [1, 3],
      });

      expect(handlers.onNightEnd).toHaveBeenCalledWith([1, 3]);
    });

    it('should handle SEAT_REJECTED', () => {
      hostBroadcastHandler({
        type: 'SEAT_REJECTED',
        seat: 5,
        requestUid: 'user-123',
        reason: 'seat_taken',
      });

      expect(handlers.onSeatRejected).toHaveBeenCalledWith(5, 'user-123', 'seat_taken');
    });

    it('should handle SEAT_ACTION_ACK', () => {
      hostBroadcastHandler({
        type: 'SEAT_ACTION_ACK',
        requestId: 'req-1',
        toUid: 'user-123',
        success: true,
        seat: 3,
      });

      expect(handlers.onSeatActionAck).toHaveBeenCalledWith({
        requestId: 'req-1',
        toUid: 'user-123',
        success: true,
        seat: 3,
      });
    });

    it('should handle SNAPSHOT_RESPONSE', () => {
      const state: BroadcastGameState = {
        roomCode: 'TEST',
        hostUid: 'host-123',
        status: 'unseated',
        templateRoles: [],
        players: {},
        currentActionerIndex: 0,
        isAudioPlaying: false,
      };

      hostBroadcastHandler({
        type: 'SNAPSHOT_RESPONSE',
        requestId: 'snap-1',
        toUid: 'user-123',
        state,
        revision: 15,
      });

      expect(handlers.onSnapshotResponse).toHaveBeenCalledWith({
        requestId: 'snap-1',
        toUid: 'user-123',
        state,
        revision: 15,
      });
    });

    it('should handle GAME_RESTARTED', () => {
      hostBroadcastHandler({
        type: 'GAME_RESTARTED',
      });

      expect(handlers.onGameRestarted).toHaveBeenCalled();
    });

    it('should ignore legacy PRIVATE_EFFECT messages', () => {
      hostBroadcastHandler({
        type: 'PRIVATE_EFFECT',
      } as unknown as HostBroadcast);

      // Should not throw or call any handlers
      expect(handlers.onStateUpdate).not.toHaveBeenCalled();
    });

    it('should warn if no handlers registered', () => {
      const coordinatorNoHandlers = new BroadcastCoordinator(mockConfig);
      const handler = coordinatorNoHandlers.getHostBroadcastHandler();

      // Should not throw
      expect(() => {
        handler({
          type: 'STATE_UPDATE',
          state: {} as BroadcastGameState,
          revision: 10,
        });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // Host: Handle Player Messages
  // =========================================================================

  describe('Host handling player messages', () => {
    let handlers: jest.Mocked<HostMessageHandlers>;
    let playerMessageHandler: (msg: PlayerMessage, senderId: string) => Promise<void>;

    beforeEach(() => {
      (mockConfig.isHost as jest.Mock).mockReturnValue(true);
      handlers = createMockHostHandlers();
      coordinator.setHostHandlers(handlers);
      playerMessageHandler = coordinator.getPlayerMessageHandler();
    });

    it('should handle REQUEST_STATE', async () => {
      await playerMessageHandler({ type: 'REQUEST_STATE', uid: 'user-123' }, 'sender-1');

      expect(handlers.onRequestState).toHaveBeenCalledWith('user-123');
    });

    it('should handle JOIN', async () => {
      await playerMessageHandler(
        {
          type: 'JOIN',
          seat: 3,
          uid: 'user-123',
          displayName: 'Player 1',
          avatarUrl: 'http://example.com/avatar.png',
        },
        'sender-1',
      );

      expect(handlers.onJoin).toHaveBeenCalledWith(
        3,
        'user-123',
        'Player 1',
        'http://example.com/avatar.png',
      );
    });

    it('should handle LEAVE', async () => {
      await playerMessageHandler({ type: 'LEAVE', seat: 3, uid: 'user-123' }, 'sender-1');

      expect(handlers.onLeave).toHaveBeenCalledWith(3, 'user-123');
    });

    it('should handle ACTION', async () => {
      await playerMessageHandler(
        {
          type: 'ACTION',
          seat: 1,
          role: 'seer',
          target: 2,
          extra: { test: 'data' },
        } as PlayerMessage,
        'sender-1',
      );

      expect(handlers.onAction).toHaveBeenCalledWith(1, 'seer', 2, { test: 'data' });
    });

    it('should handle REVEAL_ACK', async () => {
      await playerMessageHandler(
        { type: 'REVEAL_ACK', seat: 1, role: 'seer', revision: 10 } as PlayerMessage,
        'sender-1',
      );

      expect(handlers.onRevealAck).toHaveBeenCalledWith(1, 'seer', 10);
    });

    it('should handle WOLF_VOTE', async () => {
      await playerMessageHandler({ type: 'WOLF_VOTE', seat: 2, target: 5 }, 'sender-1');

      expect(handlers.onWolfVote).toHaveBeenCalledWith(2, 5);
    });

    it('should handle VIEWED_ROLE', async () => {
      await playerMessageHandler({ type: 'VIEWED_ROLE', seat: 3 }, 'sender-1');

      expect(handlers.onViewedRole).toHaveBeenCalledWith(3);
    });

    it('should handle SEAT_ACTION_REQUEST', async () => {
      await playerMessageHandler(
        {
          type: 'SEAT_ACTION_REQUEST',
          requestId: 'req-1',
          action: 'sit',
          seat: 3,
          uid: 'user-123',
          displayName: 'Player 1',
        },
        'sender-1',
      );

      expect(handlers.onSeatActionRequest).toHaveBeenCalledWith({
        requestId: 'req-1',
        action: 'sit',
        seat: 3,
        uid: 'user-123',
        displayName: 'Player 1',
      });
    });

    it('should handle SNAPSHOT_REQUEST', async () => {
      await playerMessageHandler(
        {
          type: 'SNAPSHOT_REQUEST',
          requestId: 'snap-1',
          uid: 'user-123',
          lastRevision: 10,
        },
        'sender-1',
      );

      expect(handlers.onSnapshotRequest).toHaveBeenCalledWith({
        requestId: 'snap-1',
        uid: 'user-123',
        lastRevision: 10,
      });
    });

    it('should ignore messages if not Host', async () => {
      (mockConfig.isHost as jest.Mock).mockReturnValue(false);

      await playerMessageHandler({ type: 'REQUEST_STATE', uid: 'user-123' }, 'sender-1');

      expect(handlers.onRequestState).not.toHaveBeenCalled();
    });

    it('should warn if no handlers registered', async () => {
      const coordinatorNoHandlers = new BroadcastCoordinator(
        createMockConfig({ isHost: () => true }),
      );
      const handler = coordinatorNoHandlers.getPlayerMessageHandler();

      // Should not throw
      await expect(
        handler({ type: 'REQUEST_STATE', uid: 'user-123' }, 'sender-1'),
      ).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Utilities
  // =========================================================================

  describe('utilities', () => {
    it('should mark as live', () => {
      coordinator.markAsLive();
      expect(mockBroadcastService.markAsLive).toHaveBeenCalled();
    });

    it('should return BroadcastService', () => {
      const service = coordinator.getBroadcastService();
      expect(service).toBe(mockBroadcastService);
    });
  });
});
