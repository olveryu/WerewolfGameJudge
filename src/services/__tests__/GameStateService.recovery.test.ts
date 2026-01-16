/**
 * GameStateService Recovery Tests
 * 
 * Tests for:
 * 1. emergencyRestartAndReshuffleRoles - emergency restart flow
 * 2. requestSnapshot / handleSnapshotResponse - reconnection/state recovery
 * 3. applyStateUpdate - state synchronization
 */

import { GameStateService } from '../GameStateService';
import { GameStatus } from '../types/GameStateTypes';
import { GameTemplate } from '../../models/Template';
import type { RoleName } from '../../models/roles';
import type { BroadcastGameState } from '../BroadcastService';

// =============================================================================
// Mocks
// =============================================================================

const mockBroadcastAsHost = jest.fn().mockResolvedValue(undefined);
const mockSendToHost = jest.fn().mockResolvedValue(undefined);
const mockSetConnectionStatus = jest.fn();
const mockMarkAsSyncing = jest.fn();
const mockMarkAsLive = jest.fn();

jest.mock('../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: mockBroadcastAsHost,
      broadcastPublic: jest.fn().mockResolvedValue(undefined),
      sendPrivate: jest.fn().mockResolvedValue(undefined),
      sendToHost: mockSendToHost,
      setConnectionStatus: mockSetConnectionStatus,
      markAsSyncing: mockMarkAsSyncing,
      markAsLive: mockMarkAsLive,
    })),
  },
}));

const mockAudioStop = jest.fn();

jest.mock('../AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      stop: mockAudioStop,
      playNightBeginAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createTestTemplate(): GameTemplate {
  return {
    name: 'Test Template',
    roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'] as RoleName[],
    numberOfPlayers: 6,
  };
}

function resetGameStateService(): GameStateService {
  (GameStateService as any).instance = undefined;
  return GameStateService.getInstance();
}

function getState(service: GameStateService) {
  return service.getState();
}

async function initializeHostWithPlayers(
  service: GameStateService
): Promise<void> {
  const template = createTestTemplate();
  await service.initializeAsHost('room1234', 'host_uid', template);
  
  const state = getState(service)!;
  for (let i = 0; i < template.numberOfPlayers; i++) {
    state.players.set(i, {
      uid: `player_${i}`,
      seatNumber: i,
      displayName: `Player ${i + 1}`,
      avatarUrl: undefined,
      role: null,
      hasViewedRole: false,
    });
  }
  state.status = GameStatus.seated;
}

async function assignRolesAndStartGame(
  service: GameStateService
): Promise<void> {
  const state = getState(service)!;
  const roles = state.template.roles;
  
  let idx = 0;
  state.players.forEach((player) => {
    if (player) {
      player.role = roles[idx++];
      player.hasViewedRole = true;
    }
  });
  
  state.status = GameStatus.ongoing;
}

function createBroadcastState(overrides: Partial<BroadcastGameState> = {}): BroadcastGameState {
  return {
    roomCode: 'room1234',
    hostUid: 'host_uid',
    status: GameStatus.seated,
    templateRoles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'] as RoleName[],
    players: {
      0: { uid: 'p0', seatNumber: 0, displayName: 'P0', hasViewedRole: false },
      1: { uid: 'p1', seatNumber: 1, displayName: 'P1', hasViewedRole: false },
      2: { uid: 'p2', seatNumber: 2, displayName: 'P2', hasViewedRole: false },
      3: { uid: 'p3', seatNumber: 3, displayName: 'P3', hasViewedRole: false },
      4: { uid: 'p4', seatNumber: 4, displayName: 'P4', hasViewedRole: false },
      5: { uid: 'p5', seatNumber: 5, displayName: 'P5', hasViewedRole: false },
    },
    currentActionerIndex: 0,
    isAudioPlaying: false,
    ...overrides,
  };
}

// =============================================================================
// emergencyRestartAndReshuffleRoles Tests
// =============================================================================

describe('GameStateService.emergencyRestartAndReshuffleRoles', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = resetGameStateService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('precondition checks', () => {
    it('returns false when not host', async () => {
      // Initialize as player (not host)
      await service.joinAsPlayer('room1234', 'player_uid');
      
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(false);
    });

    it('returns false when no state exists', () => {
      // Don't initialize at all
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(false);
    });

    it('returns false when no template exists', async () => {
      // Initialize with a valid template first, then remove it
      const template = createTestTemplate();
      await service.initializeAsHost('room1234', 'host_uid', template);
      
      // Manually remove template to test this edge case
      const state = getState(service)!;
      (state as any).template = null;
      
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(false);
    });

    it('returns false when no players exist', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('room1234', 'host_uid', template);
      // Don't add any players (all seats are null)
      
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(false);
    });

    it('returns false when rolePool/player count mismatch', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('room1234', 'host_uid', template);
      
      const state = getState(service)!;
      // Only add 3 players (template has 6 roles)
      for (let i = 0; i < 3; i++) {
        state.players.set(i, {
          uid: `player_${i}`,
          seatNumber: i,
          displayName: `Player ${i + 1}`,
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
      }
      
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(false);
    });

    it('returns false when status is unseated', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('room1234', 'host_uid', template);
      
      // State is unseated but we have some players
      const state = getState(service)!;
      expect(state.status).toBe(GameStatus.unseated);
      
      // Add full players but keep unseated
      for (let i = 0; i < template.numberOfPlayers; i++) {
        state.players.set(i, {
          uid: `player_${i}`,
          seatNumber: i,
          displayName: `Player ${i + 1}`,
          avatarUrl: undefined,
          role: null,
          hasViewedRole: false,
        });
      }
      
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(false);
    });
  });

  describe('successful restart', () => {
    beforeEach(async () => {
      await initializeHostWithPlayers(service);
    });

    it('succeeds when status is seated', () => {
      expect(getState(service)!.status).toBe(GameStatus.seated);
      
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(true);
    });

    it('succeeds when status is ongoing with all roles assigned', async () => {
      await assignRolesAndStartGame(service);
      expect(getState(service)!.status).toBe(GameStatus.ongoing);
      
      const result = service.emergencyRestartAndReshuffleRoles();
      
      expect(result).toBe(true);
    });

    it('stops audio on restart', async () => {
      await assignRolesAndStartGame(service);
      
      service.emergencyRestartAndReshuffleRoles();
      
      expect(mockAudioStop).toHaveBeenCalled();
    });

    it('clears night caches (actions, wolfVotes)', async () => {
      await assignRolesAndStartGame(service);
      const state = getState(service)!;
      // actions is Map<RoleName, RoleAction>, wolfVotes is Map<number (seat), number (targetSeat)>
      state.actions.set('seer' as RoleName, { seat: 0, schemaId: 'seer', targetSeat: 1 } as any);
      state.wolfVotes.set(0, 3); // seat 0 votes for seat 3
      
      service.emergencyRestartAndReshuffleRoles();
      
      expect(getState(service)!.actions.size).toBe(0);
      expect(getState(service)!.wolfVotes.size).toBe(0);
    });

    it('resets currentActionerIndex to 0', async () => {
      await assignRolesAndStartGame(service);
      const state = getState(service)!;
      state.currentActionerIndex = 5;
      
      service.emergencyRestartAndReshuffleRoles();
      
      expect(getState(service)!.currentActionerIndex).toBe(0);
    });

    it('clears all player roles', async () => {
      await assignRolesAndStartGame(service);
      
      // Verify roles are assigned
      const stateBefore = getState(service)!;
      const playersWithRoles = Array.from(stateBefore.players.values())
        .filter(p => p?.role != null);
      expect(playersWithRoles.length).toBe(6);
      
      service.emergencyRestartAndReshuffleRoles();
      
      // Verify roles are cleared
      const stateAfter = getState(service)!;
      const playersWithRolesAfter = Array.from(stateAfter.players.values())
        .filter(p => p?.role != null);
      expect(playersWithRolesAfter.length).toBe(0);
    });

    it('resets hasViewedRole to false for all players', async () => {
      await assignRolesAndStartGame(service);
      
      service.emergencyRestartAndReshuffleRoles();
      
      const state = getState(service)!;
      state.players.forEach((player) => {
        if (player) {
          expect(player.hasViewedRole).toBe(false);
        }
      });
    });

    it('resets status to seated', async () => {
      await assignRolesAndStartGame(service);
      expect(getState(service)!.status).toBe(GameStatus.ongoing);
      
      service.emergencyRestartAndReshuffleRoles();
      
      expect(getState(service)!.status).toBe(GameStatus.seated);
    });

    it('broadcasts GAME_RESTARTED message', async () => {
      await assignRolesAndStartGame(service);
      
      service.emergencyRestartAndReshuffleRoles();
      
      // Advance timers to allow async broadcast
      await jest.runAllTimersAsync();
      
      expect(mockBroadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GAME_RESTARTED' })
      );
    });

    it('preserves player seats after restart', async () => {
      await assignRolesAndStartGame(service);
      
      const playersBefore = Array.from(getState(service)!.players.entries())
        .map(([seat, p]) => ({ seat, uid: p?.uid }));
      
      service.emergencyRestartAndReshuffleRoles();
      
      const playersAfter = Array.from(getState(service)!.players.entries())
        .map(([seat, p]) => ({ seat, uid: p?.uid }));
      
      expect(playersAfter).toEqual(playersBefore);
    });
  });
});

// =============================================================================
// requestSnapshot Tests
// =============================================================================

describe('GameStateService.requestSnapshot', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = resetGameStateService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns true immediately if host (no need to request)', async () => {
    await service.initializeAsHost('room1234', 'host_uid', createTestTemplate());
    
    const result = await service.requestSnapshot();
    
    expect(result).toBe(true);
    expect(mockSendToHost).not.toHaveBeenCalled();
  });

  it('returns false if no myUid', async () => {
    // Don't initialize service (no myUid)
    const result = await service.requestSnapshot();
    
    expect(result).toBe(false);
  });

  it('sends SNAPSHOT_REQUEST to host when player', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    await service.requestSnapshot();
    
    expect(mockSendToHost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SNAPSHOT_REQUEST',
        uid: 'player_uid',
      })
    );
  });

  it('marks as syncing when requesting', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    await service.requestSnapshot();
    
    expect(mockMarkAsSyncing).toHaveBeenCalled();
  });

  it('marks as disconnected on timeout', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    await service.requestSnapshot(1000); // 1 second timeout
    
    // Advance past timeout
    jest.advanceTimersByTime(1100);
    
    expect(mockSetConnectionStatus).toHaveBeenCalledWith('disconnected');
  });

  it('marks as disconnected when sendToHost fails', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    mockSendToHost.mockRejectedValueOnce(new Error('Network error'));
    
    const result = await service.requestSnapshot();
    
    expect(result).toBe(false);
    expect(mockSetConnectionStatus).toHaveBeenCalledWith('disconnected');
  });

  it('cancels pending request when new request is made', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    // Start first request
    service.requestSnapshot();
    
    // Start second request immediately
    await service.requestSnapshot();
    
    // Only one timeout should be active
    // Advance timers - should not mark disconnected twice
    jest.advanceTimersByTime(15000);
    
    // Should only call setConnectionStatus once for the second request
    expect(mockSetConnectionStatus).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// handleSnapshotResponse Tests (via message processing)
// =============================================================================

describe('GameStateService snapshot response handling', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = resetGameStateService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('applies state from snapshot response', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    // Clear mocks from joinAsPlayer (which sends REQUEST_STATE)
    mockSendToHost.mockClear();
    
    // Request snapshot
    await service.requestSnapshot();
    
    // Get the requestId from the SNAPSHOT_REQUEST call
    const requestCall = mockSendToHost.mock.calls[0][0];
    expect(requestCall.type).toBe('SNAPSHOT_REQUEST');
    const requestId = requestCall.requestId;
    
    // Simulate snapshot response by calling handleMessage
    const broadcastState = createBroadcastState({
      status: GameStatus.assigned,
    });
    
    // Simulate the message being received
    (service as any).handleSnapshotResponse({
      requestId,
      toUid: 'player_uid',
      state: broadcastState,
      revision: 1,
    });
    
    const state = getState(service);
    expect(state?.status).toBe(GameStatus.assigned);
    expect(mockMarkAsLive).toHaveBeenCalled();
  });

  it('ignores snapshot response with wrong toUid', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    // Clear mocks from joinAsPlayer
    mockSendToHost.mockClear();
    
    await service.requestSnapshot();
    
    const requestCall = mockSendToHost.mock.calls[0][0];
    const requestId = requestCall.requestId;
    
    const broadcastState = createBroadcastState({
      status: GameStatus.assigned,
    });
    
    // Response addressed to different player
    (service as any).handleSnapshotResponse({
      requestId,
      toUid: 'other_player',
      state: broadcastState,
      revision: 1,
    });
    
    // State should not be updated
    const state = getState(service);
    expect(state?.status).not.toBe(GameStatus.assigned);
  });

  it('ignores snapshot response with wrong requestId', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    await service.requestSnapshot();
    
    const broadcastState = createBroadcastState({
      status: GameStatus.assigned,
    });
    
    // Response with wrong requestId
    (service as any).handleSnapshotResponse({
      requestId: 'wrong_id',
      toUid: 'player_uid',
      state: broadcastState,
      revision: 1,
    });
    
    // State should not be updated
    const state = getState(service);
    expect(state?.status).not.toBe(GameStatus.assigned);
  });
});

// =============================================================================
// applyStateUpdate Tests
// =============================================================================

describe('GameStateService.applyStateUpdate', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = resetGameStateService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('skips stale updates with older revision', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    // First update with revision 5
    const state1 = createBroadcastState({ status: GameStatus.seated });
    (service as any).applyStateUpdate(state1, 5);
    expect(getState(service)?.status).toBe(GameStatus.seated);
    
    // Stale update with revision 3
    const state2 = createBroadcastState({ status: GameStatus.ongoing });
    (service as any).applyStateUpdate(state2, 3);
    
    // Should still be seated (stale update ignored)
    expect(getState(service)?.status).toBe(GameStatus.seated);
  });

  it('applies updates with newer revision', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    const state1 = createBroadcastState({ status: GameStatus.seated });
    (service as any).applyStateUpdate(state1, 1);
    
    const state2 = createBroadcastState({ status: GameStatus.ongoing });
    (service as any).applyStateUpdate(state2, 2);
    
    expect(getState(service)?.status).toBe(GameStatus.ongoing);
  });

  it('tracks mySeatNumber from player data', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    const broadcastState = createBroadcastState();
    // Set player_uid at seat 3
    broadcastState.players[3] = {
      uid: 'player_uid',
      seatNumber: 3,
      displayName: 'My Player',
      hasViewedRole: false,
    };
    
    (service as any).applyStateUpdate(broadcastState, 1);
    
    expect(service.getMySeatNumber()).toBe(3);
  });

  it('reconstructs template from broadcast roles', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    const broadcastState = createBroadcastState({
      templateRoles: ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'seer', 'witch'] as RoleName[],
    });
    
    (service as any).applyStateUpdate(broadcastState, 1);
    
    const state = getState(service);
    expect(state?.template.roles).toEqual(['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'seer', 'witch']);
    expect(state?.template.numberOfPlayers).toBe(8);
  });

  it('marks connection as live after applying update', async () => {
    await service.joinAsPlayer('room1234', 'player_uid');
    
    const broadcastState = createBroadcastState();
    (service as any).applyStateUpdate(broadcastState, 1);
    
    expect(mockMarkAsLive).toHaveBeenCalled();
  });
});

// =============================================================================
// Integration: Emergency restart followed by snapshot sync
// =============================================================================

describe('Recovery integration scenarios', () => {
  let hostService: GameStateService;
  let playerService: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    // Create separate instances for host and player
    (GameStateService as any).instance = undefined;
    hostService = GameStateService.getInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('host restart transitions ongoing → seated, then can reassign roles', async () => {
    await initializeHostWithPlayers(hostService);
    await assignRolesAndStartGame(hostService);
    
    expect(getState(hostService)!.status).toBe(GameStatus.ongoing);
    
    // Emergency restart
    const result = hostService.emergencyRestartAndReshuffleRoles();
    expect(result).toBe(true);
    
    // Verify transition
    expect(getState(hostService)!.status).toBe(GameStatus.seated);
    
    // Can now reassign roles (simulate clicking "准备看牌")
    const state = getState(hostService)!;
    const roles = state.template.roles;
    let idx = 0;
    state.players.forEach((player) => {
      if (player) {
        player.role = roles[idx++];
      }
    });
    state.status = GameStatus.assigned;
    
    expect(getState(hostService)!.status).toBe(GameStatus.assigned);
  });
});
