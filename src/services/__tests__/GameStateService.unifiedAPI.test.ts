/**
 * GameStateService Unified API Tests
 * 
 * These tests verify that Host and Player use the same logic paths,
 * preventing bugs like the "hostViewedRole missing status check" issue.
 */

import { GameStateService, GameStatus, LocalPlayer } from '../GameStateService';
import { RoleName } from '../../models/roles';

// Mock shuffle to make tests deterministic
jest.mock('../../utils/shuffle', () => ({
  shuffleArray: jest.fn((arr: any[]) => [...arr]),
}));

// Mock AudioService
jest.mock('../AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      stop: jest.fn(),
      playNightBeginAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock BroadcastService
jest.mock('../BroadcastService', () => ({
  BroadcastService: {
    getInstance: () => ({
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      broadcastPublic: jest.fn().mockResolvedValue(undefined),
      sendPrivate: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Helper to create a minimal template
function createTestTemplate(roles: RoleName[]) {
  return {
    name: 'Test Template',
    numberOfPlayers: roles.length,
    roles,
    actionOrder: roles.filter(r => ['wolf', 'seer', 'witch', 'guard'].includes(r)),
  };
}

// Helper to setup a game state with players
function setupGameWithPlayers(
  service: GameStateService,
  roles: RoleName[],
  status: GameStatus,
  options: { assignRoles?: boolean; hostSeat?: number } = {}
): void {
  const { assignRoles = true, hostSeat = 0 } = options;
  const template = createTestTemplate(roles);
  
  // Access private state for testing
  (service as any).isHost = true;
  (service as any).myUid = 'host-uid';
  (service as any).mySeatNumber = hostSeat;
  
  const players = new Map<number, LocalPlayer | null>();
  roles.forEach((role, i) => {
    players.set(i, {
      uid: i === hostSeat ? 'host-uid' : `player-${i}`,
      seatNumber: i,
      displayName: i === hostSeat ? 'Host' : `Player ${i}`,
      role: assignRoles ? role : null,
      hasViewedRole: assignRoles,
    });
  });

  (service as any).state = {
    roomCode: 'TEST01',
    hostUid: 'host-uid',
    status,
    template,
    players,
    actions: new Map(),
    wolfVotes: new Map(),
    currentActionerIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
  };
}

describe('GameStateService Unified API', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = GameStateService.getInstance();
    // Reset singleton state
    (service as any).state = null;
    (service as any).isHost = false;
    (service as any).myUid = null;
    (service as any).mySeatNumber = null;
  });

  describe('playerViewedRole - Host path uses same logic as Player path', () => {
    const roles: RoleName[] = ['seer', 'witch', 'wolf', 'wolf', 'villager', 'villager'];

    it('should only process during assigned status (not unseated)', async () => {
      setupGameWithPlayers(service, roles, GameStatus.unseated, { assignRoles: false });
      
      await service.playerViewedRole();

      // Status should remain unseated (handler should early-return)
      expect(service.getState()?.status).toBe(GameStatus.unseated);
    });

    it('should only process during assigned status (not ongoing)', async () => {
      setupGameWithPlayers(service, roles, GameStatus.ongoing);
      
      // Mark host as not viewed
      const player = service.getState()?.players.get(0);
      if (player) player.hasViewedRole = false;

      await service.playerViewedRole();

      // Status should remain ongoing, NOT change to ready
      // This was the bug: hostViewedRole didn't check status
      expect(service.getState()?.status).toBe(GameStatus.ongoing);
    });

    it('should transition to ready when all viewed during assigned', async () => {
      setupGameWithPlayers(service, roles, GameStatus.assigned);
      
      // All players except host have viewed
      service.getState()?.players.forEach((p, seat) => {
        if (p && seat !== 0) p.hasViewedRole = true;
      });
      const hostPlayer = service.getState()?.players.get(0);
      if (hostPlayer) hostPlayer.hasViewedRole = false;

      await service.playerViewedRole();

      // Now all have viewed, should transition to ready
      expect(service.getState()?.status).toBe(GameStatus.ready);
    });
  });

  describe('takeSeat - unified path for Host and Player', () => {
    it('Host should successfully take a seat', async () => {
      const roles: RoleName[] = ['seer', 'witch', 'wolf', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.unseated, { assignRoles: false });
      
      // Clear seat 0 so host can take it
      service.getState()?.players.set(0, null);
      (service as any).mySeatNumber = null;

      const result = await service.takeSeat(0, 'Host');
      
      expect(result).toBe(true);
      expect(service.getState()?.players.get(0)?.displayName).toBe('Host');
      expect(service.getState()?.players.get(0)?.uid).toBe('host-uid');
    });

    it('should reject if seat is already taken', async () => {
      const roles: RoleName[] = ['seer', 'witch', 'wolf', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.unseated, { assignRoles: false });
      
      // Seat 1 is already taken by Player 1
      (service as any).mySeatNumber = null;
      
      const result = await service.takeSeat(1, 'Host');
      
      expect(result).toBe(false);
    });
  });

  describe('leaveSeat - unified path for Host and Player', () => {
    it('Host should successfully leave seat', async () => {
      const roles: RoleName[] = ['seer', 'witch', 'wolf', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.unseated, { assignRoles: false });
      
      // Verify host is in seat 0
      expect(service.getState()?.players.get(0)?.uid).toBe('host-uid');
      
      const result = await service.leaveSeat();
      
      expect(result).toBe(true);
      expect(service.getState()?.players.get(0)).toBeNull();
    });
  });

  describe('processSeatAction - single source of truth', () => {
    it('should update status to seated when all seats filled', async () => {
      const roles: RoleName[] = ['seer', 'wolf'];
      setupGameWithPlayers(service, roles, GameStatus.unseated, { assignRoles: false });
      
      // Clear all seats
      service.getState()?.players.set(0, null);
      service.getState()?.players.set(1, null);
      (service as any).mySeatNumber = null;
      
      // Host takes seat 0
      await service.takeSeat(0, 'Host');
      expect(service.getState()?.status).toBe(GameStatus.unseated);
      
      // Simulate another player taking seat 1 (via processSeatAction)
      await (service as any).processSeatAction('sit', 1, 'player-1', 'Player 1');
      
      // Now all seated
      expect(service.getState()?.status).toBe(GameStatus.seated);
    });

    it('should revert status to unseated when someone leaves', async () => {
      const roles: RoleName[] = ['seer', 'wolf'];
      setupGameWithPlayers(service, roles, GameStatus.seated, { assignRoles: false });
      
      await service.leaveSeat();
      
      expect(service.getState()?.status).toBe(GameStatus.unseated);
    });
  });
});
