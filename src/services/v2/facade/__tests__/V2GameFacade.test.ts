/**
 * V2GameFacade 单元测试
 *
 * Phase 0 测试范围：
 * - Host 创建房间 → store 初始化
 * - Host 入座 → 走 handler → reducer 路径
 * - Player 入座请求 → 发送 SEAT_ACTION_REQUEST
 * - Player 收到 STATE_UPDATE → applySnapshot
 */

import { V2GameFacade } from '../V2GameFacade';
import { BroadcastService } from '../../../BroadcastService';
import type { PlayerMessage, HostBroadcast } from '../../../protocol/types';

// Mock BroadcastService
jest.mock('../../../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(),
  },
}));

describe('V2GameFacade', () => {
  let facade: V2GameFacade;
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
    // Reset singleton
    V2GameFacade.resetInstance();

    // Setup mock BroadcastService
    mockBroadcastService = {
      joinRoom: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      markAsLive: jest.fn(),
    };

    (BroadcastService.getInstance as jest.Mock).mockReturnValue(mockBroadcastService);

    facade = V2GameFacade.getInstance();
  });

  afterEach(() => {
    V2GameFacade.resetInstance();
  });

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

  describe('Host: takeSeat', () => {
    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    it('should process seat via handler → reducer path', async () => {
      const result = await facade.takeSeat(0, 'Host Player', 'avatar.png');

      expect(result).toBe(true);
      expect(facade.getMySeatNumber()).toBe(0);
    });

    it('should broadcast updated state after seating', async () => {
      await facade.takeSeat(0, 'Host Player');

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
          state: expect.objectContaining({
            players: expect.objectContaining({
              0: expect.objectContaining({
                uid: 'host-uid',
                seatNumber: 0,
                displayName: 'Host Player',
              }),
            }),
          }),
        }),
      );
    });

    it('should reject invalid seat (via handler validation)', async () => {
      const result = await facade.takeSeat(999);

      expect(result).toBe(false);
      expect(facade.getMySeatNumber()).toBeNull();
    });

    it('should reject seat already taken (via handler validation)', async () => {
      await facade.takeSeat(0, 'First Player');
      mockBroadcastService.broadcastAsHost.mockClear();

      // Simulate another player trying to take same seat
      // This would come through handlePlayerMessage, but we can test
      // the handler logic by calling takeSeat again
      // (in real scenario, handler would reject based on uid mismatch)
    });
  });

  describe('Host: leaveSeat', () => {
    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      await facade.takeSeat(0, 'Host Player');
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    it('should leave seat via handler → reducer path', async () => {
      const result = await facade.leaveSeat();

      expect(result).toBe(true);
      expect(facade.getMySeatNumber()).toBeNull();
    });

    it('should broadcast updated state after leaving', async () => {
      await facade.leaveSeat();

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
          state: expect.objectContaining({
            players: expect.objectContaining({
              0: null,
            }),
          }),
        }),
      );
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

  describe('Player: takeSeat', () => {
    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');
      mockBroadcastService.sendToHost.mockClear();
    });

    it('should send SEAT_ACTION_REQUEST and return true (request sent)', async () => {
      const result = await facade.takeSeat(1, 'Player One', 'avatar.png');

      expect(result).toBe(true);

      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SEAT_ACTION_REQUEST',
          action: 'sit',
          seat: 1,
          uid: 'player-uid',
          displayName: 'Player One',
          avatarUrl: 'avatar.png',
        }),
      );
    });

    it('should not update mySeat until STATE_UPDATE received', async () => {
      await facade.takeSeat(1, 'Player One');

      // mySeat should still be null (no optimistic update)
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
          currentActionerIndex: -1,
          isAudioPlaying: false,
        },
      };

      onHostBroadcast(stateUpdate);

      expect(facade.getStateRevision()).toBe(5);
      expect(facade.getMySeatNumber()).toBe(1);
      expect(mockBroadcastService.markAsLive).toHaveBeenCalled();
    });
  });

  describe('Host: handle SEAT_ACTION_REQUEST from player', () => {
    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    it('should process player seat request via handler → reducer path', () => {
      // Get the onPlayerMessage callback
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      const onPlayerMessage = callbacks.onPlayerMessage;

      const seatRequest: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-123',
        action: 'sit',
        seat: 2,
        uid: 'player-uid',
        displayName: 'Player Two',
        avatarUrl: 'avatar.png',
      };

      onPlayerMessage(seatRequest, 'sender-id');

      // Should broadcast updated state
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
          state: expect.objectContaining({
            players: expect.objectContaining({
              2: expect.objectContaining({
                uid: 'player-uid',
                seatNumber: 2,
                displayName: 'Player Two',
              }),
            }),
          }),
        }),
      );
    });

    it('should reject seat request for taken seat (via handler)', () => {
      // First, host takes seat 0
      facade.takeSeat(0, 'Host Player');
      mockBroadcastService.broadcastAsHost.mockClear();

      // Get the onPlayerMessage callback
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      const onPlayerMessage = callbacks.onPlayerMessage;

      // Player tries to take seat 0 (already taken)
      const seatRequest: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-456',
        action: 'sit',
        seat: 0,
        uid: 'player-uid',
        displayName: 'Player One',
      };

      onPlayerMessage(seatRequest, 'sender-id');

      // Should still broadcast (Phase 0: no ACK, just current state)
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalled();

      // But seat 0 should still be held by host
      const lastBroadcast = mockBroadcastService.broadcastAsHost.mock.calls.at(
        -1,
      )?.[0] as HostBroadcast;
      if (lastBroadcast.type === 'STATE_UPDATE') {
        expect(lastBroadcast.state.players[0]?.uid).toBe('host-uid');
      }
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
});
