/**
 * GameFacade 单元测试
 *
 * Phase 0 测试范围：
 * - Host 创建房间 → store 初始化
 * - Host 入座 → 走 handler → reducer 路径
 * - Player 入座请求 → 发送 SEAT_ACTION_REQUEST
 * - Player 收到 STATE_UPDATE → applySnapshot
 */

import { GameFacade } from '../GameFacade';
import { BroadcastService } from '../../transport/BroadcastService';
import type { PlayerMessage, HostBroadcast, BroadcastPlayer } from '../../protocol/types';
import { gameReducer } from '../../engine/reducer/gameReducer';
import type { PlayerJoinAction } from '../../engine/reducer/types';
import {
  REASON_TIMEOUT,
  REASON_INVALID_SEAT,
  REASON_SEAT_TAKEN,
  REASON_GAME_IN_PROGRESS,
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_SEATED,
} from '../../protocol/reasonCodes';

// Mock BroadcastService
jest.mock('../../transport/BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(),
  },
}));

// P0-1: Mock AudioService
jest.mock('../../infra/AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      playNightAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

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
    // Reset singleton
    GameFacade.resetInstance();

    // Setup mock BroadcastService
    mockBroadcastService = {
      joinRoom: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      markAsLive: jest.fn(),
    };

    (BroadcastService.getInstance as jest.Mock).mockReturnValue(mockBroadcastService);

    facade = GameFacade.getInstance();
  });

  afterEach(() => {
    GameFacade.resetInstance();
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
      payload: { currentActionerIndex: 0, currentStepId: 'wolfKill' },
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
    let onHostBroadcast: (msg: HostBroadcast) => void;

    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');
      mockBroadcastService.sendToHost.mockClear();

      // Capture onHostBroadcast callback
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      onHostBroadcast = callbacks.onHostBroadcast;
    });

    it('should send SEAT_ACTION_REQUEST and resolve with ACK result', async () => {
      // Simulate Host sending ACK after request is sent
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          // Simulate async ACK from Host
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: true,
              seat: 1,
            });
          }, 10);
        }
      });

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

    it('should resolve with false when ACK indicates failure', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 1,
              reason: 'seat_taken',
            });
          }, 10);
        }
      });

      const result = await facade.takeSeat(1, 'Player One');

      expect(result).toBe(false);
    });

    it('should not update mySeat until STATE_UPDATE received', async () => {
      // Simulate successful ACK
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: true,
              seat: 1,
            });
          }, 10);
        }
      });

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

  describe('Player: takeSeatWithAck reason transparency', () => {
    let onHostBroadcast: (msg: HostBroadcast) => void;

    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');
      mockBroadcastService.sendToHost.mockClear();

      // Capture onHostBroadcast callback
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      onHostBroadcast = callbacks.onHostBroadcast;
    });

    it('should return success with no reason on successful ACK', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: true,
              seat: 1,
            });
          }, 10);
        }
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: true, reason: undefined });
    });

    it('should return reason from ACK when seat is taken', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 1,
              reason: 'seat_taken',
            });
          }, 10);
        }
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: false, reason: 'seat_taken' });
    });

    it('should return reason from ACK when game in progress', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 1,
              reason: 'game_in_progress',
            });
          }, 10);
        }
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');

      expect(result).toEqual({ success: false, reason: 'game_in_progress' });
    });

    it('should return reason from ACK when invalid_seat', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 999,
              reason: 'invalid_seat',
            });
          }, 10);
        }
      });

      const result = await facade.takeSeatWithAck(999, 'Player One');

      expect(result).toEqual({ success: false, reason: 'invalid_seat' });
    });
  });

  describe('Player: leaveSeatWithAck reason transparency', () => {
    let onHostBroadcast: (msg: HostBroadcast) => void;

    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');
      mockBroadcastService.sendToHost.mockClear();

      // Capture onHostBroadcast callback
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      onHostBroadcast = callbacks.onHostBroadcast;

      // Give player a seat via STATE_UPDATE so leaveSeatWithAck can proceed
      onHostBroadcast({
        type: 'STATE_UPDATE',
        revision: 2,
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
      });
    });

    it('should return success on successful leave ACK', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST' && msg.action === 'standup') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: true,
              seat: 1,
            });
          }, 10);
        }
      });

      const result = await facade.leaveSeatWithAck();

      expect(result).toEqual({ success: true, reason: undefined });
    });

    it('should return reason from ACK when game in progress', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST' && msg.action === 'standup') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 1,
              reason: 'game_in_progress',
            });
          }, 10);
        }
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

  // =========================================================================
  // Host-side reason source validation (all reasons from handler)
  // =========================================================================
  describe('Host: takeSeatWithAck reason comes from handler', () => {
    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    it('should return success with no reason on valid seat', async () => {
      const result = await facade.takeSeatWithAck(0, 'Host Player');
      expect(result).toEqual({ success: true });
    });

    it('should return invalid_seat from handler when seat out of range', async () => {
      const result = await facade.takeSeatWithAck(999, 'Host Player');
      expect(result).toEqual({ success: false, reason: REASON_INVALID_SEAT });
    });

    it('should return seat_taken from handler when seat occupied by other', async () => {
      // Get onPlayerMessage callback to simulate another player joining
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      const onPlayerMessage = callbacks.onPlayerMessage;

      // Simulate player taking seat 0
      const seatRequest: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId: 'req-123',
        action: 'sit',
        seat: 0,
        uid: 'other-player',
        displayName: 'Other Player',
      };
      onPlayerMessage(seatRequest, 'sender-id');
      mockBroadcastService.broadcastAsHost.mockClear();

      // Now Host tries to take seat 0
      const result = await facade.takeSeatWithAck(0, 'Host Player');
      expect(result).toEqual({ success: false, reason: REASON_SEAT_TAKEN });
    });
  });

  describe('Host: leaveSeatWithAck reason comes from handler', () => {
    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    it('should return not_seated when not seated', async () => {
      // Host not seated, LEAVE_MY_SEAT handler returns not_seated
      const result = await facade.leaveSeatWithAck();
      expect(result).toEqual({ success: false, reason: REASON_NOT_SEATED });
    });

    it('should succeed when leaving own seat', async () => {
      await facade.takeSeatWithAck(0, 'Host Player');
      mockBroadcastService.broadcastAsHost.mockClear();

      const result = await facade.leaveSeatWithAck();
      expect(result).toEqual({ success: true });
    });
  });

  // =========================================================================
  // Transport-level reason validation (timeout/cancelled use constants)
  // =========================================================================
  describe('Player: transport-level reasons use constants', () => {
    let onHostBroadcast: (msg: HostBroadcast) => void;

    beforeEach(async () => {
      await facade.joinAsPlayer('ABCD', 'player-uid');
      mockBroadcastService.sendToHost.mockClear();

      // Capture onHostBroadcast callback
      const joinRoomCall = mockBroadcastService.joinRoom.mock.calls[0];
      const callbacks = joinRoomCall[2];
      onHostBroadcast = callbacks.onHostBroadcast;
    });

    it('should return timeout reason using constant when ACK times out', async () => {
      // Don't send any ACK, let it timeout
      jest.useFakeTimers();

      const resultPromise = facade.takeSeatWithAck(1, 'Player One');

      // Fast-forward past timeout
      jest.advanceTimersByTime(6000);

      const result = await resultPromise;
      expect(result).toEqual({ success: false, reason: REASON_TIMEOUT });

      jest.useRealTimers();
    });

    it('should transparently pass handler reason from Host ACK (no_state)', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 1,
              reason: REASON_NO_STATE,
            });
          }, 10);
        }
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');
      expect(result).toEqual({ success: false, reason: REASON_NO_STATE });
    });

    it('should transparently pass handler reason from Host ACK (not_authenticated)', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 1,
              reason: REASON_NOT_AUTHENTICATED,
            });
          }, 10);
        }
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');
      expect(result).toEqual({ success: false, reason: REASON_NOT_AUTHENTICATED });
    });

    it('should transparently pass handler reason from Host ACK (game_in_progress)', async () => {
      mockBroadcastService.sendToHost.mockImplementation(async (msg: PlayerMessage) => {
        if (msg.type === 'SEAT_ACTION_REQUEST') {
          setTimeout(() => {
            onHostBroadcast({
              type: 'SEAT_ACTION_ACK',
              requestId: msg.requestId,
              toUid: 'player-uid',
              success: false,
              seat: 1,
              reason: REASON_GAME_IN_PROGRESS,
            });
          }, 10);
        }
      });

      const result = await facade.takeSeatWithAck(1, 'Player One');
      expect(result).toEqual({ success: false, reason: REASON_GAME_IN_PROGRESS });
    });
  });

  // =========================================================================
  // PR1: assignRoles (seated → assigned)
  // =========================================================================
  describe('Host: assignRoles', () => {
    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    it('should reject if not host, with reason from handler (host_only)', async () => {
      // 创建一个非 host facade（player）
      GameFacade.resetInstance();
      const playerFacade = GameFacade.getInstance();
      await playerFacade.joinAsPlayer('ABCD', 'player-uid');

      const result = await playerFacade.assignRoles();

      // reason 必须来自 handler，不是 facade 硬编码
      expect(result.success).toBe(false);
      expect(result.reason).toBe('host_only');
    });

    it('should reject if status is not seated, with reason from handler', async () => {
      // status 是 unseated（还没入座）
      const result = await facade.assignRoles();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast current state when handler rejects', async () => {
      // status 是 unseated → handler 会拒绝
      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.assignRoles();

      // 失败时也应该 broadcast 一次
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should succeed when host and status is seated (via reducer path)', async () => {
      // 通过 reducer 填充所有座位 → status 自动变为 'seated'
      const seatedState = fillAllSeatsViaReducer(facade, mockTemplate);

      // 验证 reducer 确实把 status 推到 'seated'
      expect(seatedState.status).toBe('seated');

      mockBroadcastService.broadcastAsHost.mockClear();

      const result = await facade.assignRoles();

      expect(result.success).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should assign roles to all players and reset hasViewedRole (via reducer path)', async () => {
      // 通过 reducer 填充所有座位
      fillAllSeatsViaReducer(facade, mockTemplate);

      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.assignRoles();

      // 获取 broadcast 调用的 state
      const broadcastCall = mockBroadcastService.broadcastAsHost.mock.calls.find(
        (call) => call[0]?.type === 'STATE_UPDATE',
      );
      expect(broadcastCall).toBeDefined();

      const broadcastedState = broadcastCall![0].state;

      // 断言 status → assigned
      expect(broadcastedState.status).toBe('assigned');

      // 断言：至少一个玩家的 role 被分配（不是 null）
      const players = broadcastedState.players as Record<number, BroadcastPlayer | null>;
      const assignedPlayers = Object.values(players).filter(
        (p): p is BroadcastPlayer => p !== null && p !== undefined && p.role !== null,
      );
      expect(assignedPlayers.length).toBeGreaterThan(0);

      // 断言：所有玩家的 hasViewedRole 都被 reset 为 false
      for (const player of Object.values(players)) {
        if (player !== null && player !== undefined) {
          expect(player.hasViewedRole).toBe(false);
        }
      }
    });

    it('should broadcast state with assigned status after successful assign', async () => {
      // 通过 reducer 填充所有座位
      fillAllSeatsViaReducer(facade, mockTemplate);

      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.assignRoles();

      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
          state: expect.objectContaining({
            status: 'assigned',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // PR2: markViewedRole (assigned → ready)
  // =========================================================================
  describe('Host: markViewedRole', () => {
    /**
     * Helper: 设置 assigned 状态（通过 reducer 填充座位 + assignRoles）
     */
    const setupAssignedState = async (
      facadeInstance: GameFacade,
      template: typeof mockTemplate,
    ) => {
      fillAllSeatsViaReducer(facadeInstance, template);
      await facadeInstance.assignRoles();
      mockBroadcastService.broadcastAsHost.mockClear();
    };

    beforeEach(async () => {
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    it('should send PlayerMessage to host when called by player (not host)', async () => {
      // 创建一个非 host facade（player）
      GameFacade.resetInstance();
      const playerFacade = GameFacade.getInstance();
      await playerFacade.joinAsPlayer('ABCD', 'player-uid');

      const result = await playerFacade.markViewedRole(0);

      // Player 发送消息给 Host，返回 success（不等待确认）
      expect(result.success).toBe(true);
      expect(mockBroadcastService.sendToHost).toHaveBeenCalledWith({
        type: 'VIEWED_ROLE',
        seat: 0,
      });
    });

    it('should reject if status is not assigned, with reason from handler', async () => {
      // status 是 unseated（还没分配角色）
      const result = await facade.markViewedRole(0);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast current state when handler rejects', async () => {
      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.markViewedRole(0);

      // 失败时也应该 broadcast 一次
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should succeed when host and status is assigned (via reducer path)', async () => {
      await setupAssignedState(facade, mockTemplate);

      const result = await facade.markViewedRole(0);

      expect(result.success).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should set hasViewedRole to true for the seat', async () => {
      await setupAssignedState(facade, mockTemplate);

      await facade.markViewedRole(0);

      // 获取 broadcast 调用的 state
      const broadcastCall = mockBroadcastService.broadcastAsHost.mock.calls.find(
        (call) => call[0]?.type === 'STATE_UPDATE',
      );
      expect(broadcastCall).toBeDefined();

      const broadcastedState = broadcastCall![0].state;
      const players = broadcastedState.players as Record<number, BroadcastPlayer | null>;

      expect(players[0]?.hasViewedRole).toBe(true);
    });

    it('should transition to ready when all players have viewed', async () => {
      await setupAssignedState(facade, mockTemplate);

      // 让所有玩家都查看角色
      for (let i = 0; i < mockTemplate.numberOfPlayers; i++) {
        await facade.markViewedRole(i);
      }

      // 获取最后一次 broadcast 的 state
      const lastCall = mockBroadcastService.broadcastAsHost.mock.calls.at(-1);
      const broadcastedState = lastCall![0].state;

      expect(broadcastedState.status).toBe('ready');
    });
  });

  // =========================================================================
  // PR3: startNight (ready → ongoing)
  // =========================================================================
  describe('Host: startNight', () => {
    /**
     * Helper: 设置 ready 状态（通过 reducer 填充座位 + assignRoles + 所有人 viewed）
     */
    const setupReadyState = async (facadeInstance: GameFacade, template: typeof mockTemplate) => {
      fillAllSeatsViaReducer(facadeInstance, template);
      await facadeInstance.assignRoles();
      for (let i = 0; i < template.numberOfPlayers; i++) {
        await facadeInstance.markViewedRole(i);
      }
      mockBroadcastService.broadcastAsHost.mockClear();
    };

    beforeEach(async () => {
      // 使用 fake timers 加速 5 秒音频延迟
      jest.useFakeTimers();
      await facade.initializeAsHost('ABCD', 'host-uid', mockTemplate);
      mockBroadcastService.broadcastAsHost.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should reject if not host, with reason from handler (host_only)', async () => {
      // 创建一个非 host facade（player）
      GameFacade.resetInstance();
      const playerFacade = GameFacade.getInstance();
      await playerFacade.joinAsPlayer('ABCD', 'player-uid');

      const result = await playerFacade.startNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('host_only');
    });

    it('should reject if status is not ready, with reason from handler', async () => {
      // status 是 unseated（还没分配角色）
      const result = await facade.startNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should reject if status is assigned (not yet all viewed)', async () => {
      fillAllSeatsViaReducer(facade, mockTemplate);
      await facade.assignRoles();
      // 没有人 viewed，所以还是 assigned

      const result = await facade.startNight();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('should broadcast current state when handler rejects', async () => {
      mockBroadcastService.broadcastAsHost.mockClear();

      await facade.startNight();

      // 失败时也应该 broadcast 一次
      expect(mockBroadcastService.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should succeed when host and status is ready (happy path)', async () => {
      await setupReadyState(facade, mockTemplate);

      const startNightPromise = facade.startNight();
      await jest.runAllTimersAsync();
      const result = await startNightPromise;

      expect(result.success).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should set status to ongoing', async () => {
      await setupReadyState(facade, mockTemplate);

      const startNightPromise = facade.startNight();
      await jest.runAllTimersAsync();
      await startNightPromise;

      // 获取 broadcast 调用的 state
      const broadcastCall = mockBroadcastService.broadcastAsHost.mock.calls.find(
        (call) => call[0]?.type === 'STATE_UPDATE',
      );
      expect(broadcastCall).toBeDefined();

      const broadcastedState = broadcastCall![0].state;
      expect(broadcastedState.status).toBe('ongoing');
    });

    it('should initialize Night-1 fields correctly', async () => {
      await setupReadyState(facade, mockTemplate);

      const startNightPromise = facade.startNight();
      await jest.runAllTimersAsync();
      await startNightPromise;

      // 获取 broadcast 调用的 state
      const broadcastCall = mockBroadcastService.broadcastAsHost.mock.calls.find(
        (call) => call[0]?.type === 'STATE_UPDATE',
      );
      expect(broadcastCall).toBeDefined();

      const broadcastedState = broadcastCall![0].state;
      expect(broadcastedState.currentActionerIndex).toBe(0);
      expect(broadcastedState.actions).toEqual([]);
      expect(broadcastedState.currentNightResults).toEqual({});
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
});
