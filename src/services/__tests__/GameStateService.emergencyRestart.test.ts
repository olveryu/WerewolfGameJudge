import { GameStateService, GameStatus, LocalPlayer } from '../GameStateService';
import { NightEvent } from '../NightFlowController';
import { RoleName } from '../../models/roles';

// Mock shuffle to make tests deterministic
jest.mock('../../utils/shuffle', () => ({
  shuffleArray: jest.fn((arr: any[]) => [...arr].reverse()),
}));

// Mock AudioService
const mockAudioStop = jest.fn();
jest.mock('../AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      stop: mockAudioStop,
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
  assignRoles: boolean = true
): void {
  const template = createTestTemplate(roles);
  
  // Access private state for testing
  (service as any).isHost = true;
  (service as any).myUid = 'host-uid';
  
  const players = new Map<number, LocalPlayer | null>();
  roles.forEach((role, i) => {
    players.set(i, {
      uid: `player-${i}`,
      seatNumber: i,
      displayName: `Player ${i}`,
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

describe('GameStateService.emergencyRestartAndReshuffleRoles', () => {
  let service: GameStateService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset singleton
    (GameStateService as any).instance = null;
    service = GameStateService.getInstance();
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ===========================================================================
  // RESCUE GUARANTEE (Hard Contract)
  // ===========================================================================

  describe('Rescue Guarantee', () => {
    it('should ALWAYS succeed when status is ongoing and all players have roles', () => {
      const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);
      
      // Even with roomNumber as null (simulate edge case)
      const state = (service as any).state;
      state.roomCode = null as any; // Intentionally set to null to test rescue guarantee

      // Add some night state to verify it gets cleared
      state.actions.set('wolf', 3);
      state.wolfVotes.set(0, 3);
      state.currentActionerIndex = 2;
      state.lastNightDeaths = [1, 2];

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(true);
      expect(state.status).toBe(GameStatus.ready);
      expect(state.actions.size).toBe(0);
      expect(state.wolfVotes.size).toBe(0);
      expect(state.currentActionerIndex).toBe(0);
      expect(state.lastNightDeaths).toEqual([]);
      expect(mockAudioStop).toHaveBeenCalled();
    });

    it('should reshuffle roles when ongoing with all roles assigned', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      const state = (service as any).state;
      const originalRoles = Array.from(state.players.values()).map((p: any) => p.role);

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(true);
      
      // Roles should be reshuffled (reversed due to mock)
      const newRoles = Array.from(state.players.values()).map((p: any) => p.role);
      expect(newRoles).toEqual([...roles].reverse());
      
      // But multiset should be the same
      expect([...newRoles].sort()).toEqual([...originalRoles].sort());
    });
  });

  // ===========================================================================
  // Normal Execution Cases
  // ===========================================================================

  describe('Normal Execution', () => {
    it('should succeed when status is ready', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ready, true);

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(true);
      expect((service as any).state.status).toBe(GameStatus.ready);
    });

    it('should succeed when status is ended', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ended, true);

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(true);
      expect((service as any).state.status).toBe(GameStatus.ready);
    });

    it('should succeed when status is assigned', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.assigned, true);

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(true);
      expect((service as any).state.status).toBe(GameStatus.ready);
    });

    it('should preserve seat indices after restart', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      const state = (service as any).state;
      const entries = Array.from(state.players.entries()) as Array<[number, any]>;
      const originalSeats = entries.map(
        ([seat, p]) => ({ seat, uid: p.uid })
      );

      service.emergencyRestartAndReshuffleRoles();

      const newEntries = Array.from(state.players.entries()) as Array<[number, any]>;
      const newSeats = newEntries.map(
        ([seat, p]) => ({ seat, uid: p.uid })
      );
      expect(newSeats).toEqual(originalSeats);
    });

    it('should have role pool matching template (multiset equality)', () => {
      const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'guard', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      service.emergencyRestartAndReshuffleRoles();

      const state = (service as any).state;
      const assignedRoles = Array.from(state.players.values())
        .filter((p: any) => p !== null)
        .map((p: any) => p.role)
        .sort();
      
      expect(assignedRoles).toEqual([...roles].sort());
    });

    it('should clear Map-based actions and wolfVotes', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      const state = (service as any).state;
      state.actions.set('wolf', 2);
      state.actions.set('seer', 1);
      state.wolfVotes.set(0, 2);

      service.emergencyRestartAndReshuffleRoles();

      expect(state.actions.size).toBe(0);
      expect(state.wolfVotes.size).toBe(0);
    });

    it('should reset hasViewedRole to false for all players', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      service.emergencyRestartAndReshuffleRoles();

      const state = (service as any).state;
      const allNotViewed = Array.from(state.players.values())
        .filter((p: any) => p !== null)
        .every((p: any) => p.hasViewedRole === false);
      
      expect(allNotViewed).toBe(true);
    });

    it('should call audioService.stop()', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      service.emergencyRestartAndReshuffleRoles();

      expect(mockAudioStop).toHaveBeenCalled();
    });

    it('should notify listeners', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      const listener = jest.fn();
      service.addListener(listener);

      service.emergencyRestartAndReshuffleRoles();

      expect(listener).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Rejection Cases (Abnormal State)
  // ===========================================================================

  describe('Rejection Cases', () => {
    it('should return false when not host', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);
      (service as any).isHost = false;

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not host')
      );
    });

    it('should return false when no state', () => {
      (service as any).isHost = true;
      (service as any).state = null;

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no state')
      );
    });

    it('should return false when template is null', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);
      (service as any).state.template = null;

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no template')
      );
    });

    it('should return false when players is empty', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);
      (service as any).state.players = new Map();

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no players')
      );
    });

    it('should return false when rolePool size !== players size', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);
      
      // Add extra players without matching template
      const state = (service as any).state;
      state.players.set(4, {
        uid: 'player-4',
        seatNumber: 4,
        displayName: 'Player 4',
        role: 'villager',
        hasViewedRole: true,
      });

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('rolePool size mismatch'),
        expect.any(String)
      );
    });

    it('should return false when status is unseated', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.unseated, false);

      const result = service.emergencyRestartAndReshuffleRoles();

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot restart in unseated status')
      );
    });

    it('should not modify state when returning false', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);
      
      const state = (service as any).state;
      state.actions.set('wolf', 2);
      state.wolfVotes.set(0, 2);
      const originalStatus = state.status;
      const originalActions = new Map(state.actions);
      const originalWolfVotes = new Map(state.wolfVotes);

      // Make it fail by removing host
      (service as any).isHost = false;

      service.emergencyRestartAndReshuffleRoles();

      // State should be unchanged
      expect(state.status).toBe(originalStatus);
      expect(state.actions).toEqual(originalActions);
      expect(state.wolfVotes).toEqual(originalWolfVotes);
    });
  });

  // ===========================================================================
  // NightFlow Reset
  // ===========================================================================

  describe('NightFlow Reset', () => {
    it('should dispatch NightEvent.Reset to nightFlow', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      // Create mock nightFlow
      const mockDispatch = jest.fn();
      (service as any).nightFlow = {
        dispatch: mockDispatch,
      };

      service.emergencyRestartAndReshuffleRoles();

      expect(mockDispatch).toHaveBeenCalledWith(NightEvent.Reset);
      expect((service as any).nightFlow).toBeNull();
    });

    it('should handle nightFlow dispatch error gracefully', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
      setupGameWithPlayers(service, roles, GameStatus.ongoing, true);

      // Create mock nightFlow that throws
      (service as any).nightFlow = {
        dispatch: jest.fn(() => {
          throw new Error('NightFlow error');
        }),
      };

      const result = service.emergencyRestartAndReshuffleRoles();

      // Should still succeed
      expect(result).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('NightFlow Reset failed'),
        expect.any(Error)
      );
    });
  });
});
