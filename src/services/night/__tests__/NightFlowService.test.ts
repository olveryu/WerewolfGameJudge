/**
 * NightFlowService Tests
 *
 * Tests for night flow orchestration service.
 * The service manages:
 * - NightFlowController state machine
 * - Audio playback sequencing
 * - Step advancement logic
 */

import { NightFlowService, NightFlowServiceDeps } from '../NightFlowService';
import { NightPhase, NightEvent } from '../../NightFlowController';
import { GameStatus, LocalGameState } from '../../types/GameStateTypes';
import AudioService from '../../AudioService';
import type { RoleId } from '../../../models/roles';

// =============================================================================
// Mock Setup
// =============================================================================

// Create shared mock instance for AudioService
const mockAudioService = {
  playNightBeginAudio: jest.fn().mockResolvedValue(undefined),
  playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
  playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
  playNightEndAudio: jest.fn().mockResolvedValue(undefined),
};

// Mock AudioService
jest.mock('../../AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockAudioService),
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  nightFlowLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    extend: jest.fn(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

// Helper: Create minimal game state for testing
function createTestState(overrides: Partial<LocalGameState> = {}): LocalGameState {
  const players = new Map<
    number,
    {
      name: string;
      avatarUri: string;
      role: RoleId | null;
      hasViewedRole: boolean;
      uid: string;
    } | null
  >();
  players.set(0, { name: 'Wolf', avatarUri: '', role: 'wolf', hasViewedRole: false, uid: 'u1' });
  players.set(1, { name: 'Witch', avatarUri: '', role: 'witch', hasViewedRole: false, uid: 'u2' });
  players.set(2, { name: 'Seer', avatarUri: '', role: 'seer', hasViewedRole: false, uid: 'u3' });
  players.set(3, {
    name: 'Villager1',
    avatarUri: '',
    role: 'villager',
    hasViewedRole: false,
    uid: 'u4',
  });
  players.set(4, {
    name: 'Villager2',
    avatarUri: '',
    role: 'villager',
    hasViewedRole: false,
    uid: 'u5',
  });
  players.set(5, {
    name: 'Villager3',
    avatarUri: '',
    role: 'villager',
    hasViewedRole: false,
    uid: 'u6',
  });

  return {
    template: {
      name: 'Test Game',
      numberOfPlayers: 6,
      roles: ['wolf', 'witch', 'seer', 'villager', 'villager', 'villager'],
    },
    players,
    status: GameStatus.ready,
    currentActionerIndex: 0,
    actions: new Map(),
    wolfVotes: new Map(),
    isAudioPlaying: false,
    lastNightDeaths: [],
    ...overrides,
  } as LocalGameState;
}

// Helper: Create test dependencies
function createTestDeps(
  state: LocalGameState,
): NightFlowServiceDeps & { mockState: LocalGameState } {
  const mockState = { ...state };
  return {
    mockState,
    getState: jest.fn(() => mockState),
    updateState: jest.fn((updates: Partial<LocalGameState>) => {
      Object.assign(mockState, updates);
    }),
    getSeatsForRole: jest.fn((role: RoleId) => {
      const seats: number[] = [];
      mockState.players.forEach((player, seat) => {
        if (player?.role === role) {
          seats.push(seat);
        }
      });
      return seats;
    }),
  };
}

describe('NightFlowService', () => {
  let service: NightFlowService;
  let deps: NightFlowServiceDeps & { mockState: LocalGameState };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset timers for any setTimeout in startNight
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ===========================================================================
  // Constructor / Initialization
  // ===========================================================================

  describe('constructor', () => {
    it('should create service with dependencies', () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);
      expect(service).toBeDefined();
    });

    it('should get AudioService instance', () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);
      expect(AudioService.getInstance).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Accessors
  // ===========================================================================

  describe('accessors', () => {
    beforeEach(() => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);
    });

    describe('getNightFlow', () => {
      it('should return null before startNight', () => {
        expect(service.getNightFlow()).toBeNull();
      });
    });

    describe('isActive', () => {
      it('should return false before startNight', () => {
        expect(service.isActive()).toBe(false);
      });
    });

    describe('getCurrentPhase', () => {
      it('should return null before startNight', () => {
        expect(service.getCurrentPhase()).toBeNull();
      });
    });

    describe('getCurrentActionRole', () => {
      it('should return first role when index is 0', () => {
        // First role in night plan should be nightmare (if exists) or wolf
        // For our test template, wolf is the first acting role
        const role = service.getCurrentActionRole();
        expect(role).toBe('wolf');
      });

      it('should return null when no state', () => {
        (deps.getState as jest.Mock).mockReturnValue(null);
        expect(service.getCurrentActionRole()).toBeNull();
      });
    });

    describe('getCurrentStepInfo', () => {
      it('should return step info for current role', () => {
        const info = service.getCurrentStepInfo();
        expect(info).toBeDefined();
        expect(info?.role).toBe('wolf');
        expect(info?.pendingSeats).toContain(0); // Wolf is at seat 0
      });

      it('should return null when no state', () => {
        (deps.getState as jest.Mock).mockReturnValue(null);
        expect(service.getCurrentStepInfo()).toBeNull();
      });
    });
  });

  // ===========================================================================
  // startNight
  // ===========================================================================

  describe('startNight', () => {
    beforeEach(() => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);
    });

    it('should fail when no state', async () => {
      (deps.getState as jest.Mock).mockReturnValue(null);
      const result = await service.startNight(['wolf', 'witch', 'seer']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No state');
    });

    it('should fail when status is not ready', async () => {
      deps.mockState.status = GameStatus.ongoing;
      const result = await service.startNight(['wolf', 'witch', 'seer']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });

    it('should initialize NightFlowController', async () => {
      const startPromise = service.startNight(['wolf', 'witch', 'seer']);

      // Fast-forward through the 5 second wait
      await jest.advanceTimersByTimeAsync(5000);

      // Fast-forward through any remaining async operations
      await jest.runAllTimersAsync();

      const result = await startPromise;
      expect(result.success).toBe(true);
      expect(service.getNightFlow()).not.toBeNull();
    });

    it('should reset night state', async () => {
      const startPromise = service.startNight(['wolf', 'witch', 'seer']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;

      expect(deps.updateState).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.any(Map),
          wolfVotes: expect.any(Map),
          currentActionerIndex: expect.any(Number),
        }),
      );
    });

    it('should play night begin audio', async () => {
      const startPromise = service.startNight(['wolf', 'witch', 'seer']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;

      expect(mockAudioService.playNightBeginAudio).toHaveBeenCalled();
    });

    it('should set status to ongoing after audio', async () => {
      const startPromise = service.startNight(['wolf', 'witch', 'seer']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;

      expect(deps.updateState).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GameStatus.ongoing,
        }),
      );
    });
  });

  // ===========================================================================
  // advanceToNextAction
  // ===========================================================================

  describe('advanceToNextAction', () => {
    beforeEach(async () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      // Start night first
      const startPromise = service.startNight(['wolf', 'witch', 'seer']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;

      // Clear mock calls from startNight
      jest.clearAllMocks();

      // Manually set up state as if waiting for action
      const nightFlow = service.getNightFlow();
      if (nightFlow) {
        // Dispatch ActionSubmitted to move to RoleEndAudio phase
        nightFlow.dispatch(NightEvent.ActionSubmitted);
      }
    });

    it('should do nothing when no state', async () => {
      (deps.getState as jest.Mock).mockReturnValue(null);
      await expect(service.advanceToNextAction()).resolves.toBeUndefined();
    });

    it('should throw when status ongoing but nightFlow null', async () => {
      // Force nightFlow to null
      service.reset();
      deps.mockState.status = GameStatus.ongoing;

      await expect(service.advanceToNextAction()).rejects.toThrow(
        'advanceToNextAction: nightFlow is null',
      );
    });

    it('should play role ending audio', async () => {
      await service.advanceToNextAction();

      expect(mockAudioService.playRoleEndingAudio).toHaveBeenCalled();
    });

    it('should advance currentActionerIndex', async () => {
      await service.advanceToNextAction();

      // Should have called updateState with new index
      expect(deps.updateState).toHaveBeenCalledWith(
        expect.objectContaining({
          currentActionerIndex: expect.any(Number),
        }),
      );
    });

    it('should ignore when phase is not RoleEndAudio', async () => {
      // Reset to Idle phase
      service.reset();

      // Create fresh state in ongoing status
      deps.mockState.status = GameStatus.ended;

      // Should not throw, just return
      await expect(service.advanceToNextAction()).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // endNight
  // ===========================================================================

  describe('endNight', () => {
    beforeEach(async () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      // Start night
      const startPromise = service.startNight(['wolf']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;

      // Advance through wolf action to get to NightEndAudio phase
      const nightFlow = service.getNightFlow();
      if (nightFlow) {
        nightFlow.dispatch(NightEvent.ActionSubmitted);
        nightFlow.dispatch(NightEvent.RoleEndAudioDone);
      }

      jest.clearAllMocks();
    });

    it('should return false when no state', async () => {
      (deps.getState as jest.Mock).mockReturnValue(null);
      expect(await service.endNight()).toBe(false);
    });

    it('should throw when status ongoing but nightFlow null', async () => {
      service.reset();
      deps.mockState.status = GameStatus.ongoing;

      await expect(service.endNight()).rejects.toThrow('endNight: nightFlow is null');
    });

    it('should play night end audio', async () => {
      await service.endNight();

      expect(mockAudioService.playNightEndAudio).toHaveBeenCalled();
    });

    it('should return true when in NightEndAudio phase', async () => {
      expect(await service.endNight()).toBe(true);
    });

    it('should return false when not in NightEndAudio phase', async () => {
      // Dispatch to move past NightEndAudio
      const nightFlow = service.getNightFlow();
      nightFlow?.dispatch(NightEvent.NightEndAudioDone);

      expect(await service.endNight()).toBe(false);
    });
  });

  // ===========================================================================
  // reset
  // ===========================================================================

  describe('reset', () => {
    beforeEach(async () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      // Start night
      const startPromise = service.startNight(['wolf', 'witch']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;
    });

    it('should clear nightFlow', () => {
      expect(service.getNightFlow()).not.toBeNull();
      service.reset();
      expect(service.getNightFlow()).toBeNull();
    });

    it('should be safe to call when nightFlow is already null', () => {
      service.reset();
      expect(() => service.reset()).not.toThrow();
    });
  });

  // ===========================================================================
  // State Machine Events
  // ===========================================================================

  describe('dispatchEvent', () => {
    beforeEach(async () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      // Start night
      const startPromise = service.startNight(['wolf', 'witch']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;
    });

    it('should dispatch event to nightFlow', () => {
      // After startNight, we should be in WaitingForAction phase
      expect(service.getCurrentPhase()).toBe(NightPhase.WaitingForAction);

      service.dispatchEvent(NightEvent.ActionSubmitted);
      expect(service.getCurrentPhase()).toBe(NightPhase.RoleEndAudio);
    });

    it('should do nothing when nightFlow is null', () => {
      service.reset();
      expect(() => service.dispatchEvent(NightEvent.ActionSubmitted)).not.toThrow();
    });
  });

  describe('recordAction', () => {
    beforeEach(async () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      // Start night
      const startPromise = service.startNight(['wolf', 'witch']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;
    });

    it('should record action in nightFlow', () => {
      service.recordAction('wolf', 1);
      const nightFlow = service.getNightFlow();
      expect(nightFlow?.actions.get('wolf')).toBe(1);
    });

    it('should do nothing when nightFlow is null', () => {
      service.reset();
      expect(() => service.recordAction('wolf', 1)).not.toThrow();
    });
  });

  describe('canAcceptAction', () => {
    beforeEach(async () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      // Start night
      const startPromise = service.startNight(['wolf', 'witch']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;
    });

    it('should return true for current role in WaitingForAction phase', () => {
      expect(service.canAcceptAction('wolf')).toBe(true);
    });

    it('should return false for wrong role', () => {
      expect(service.canAcceptAction('witch')).toBe(false);
    });

    it('should return false when not in WaitingForAction phase', () => {
      service.dispatchEvent(NightEvent.ActionSubmitted);
      expect(service.canAcceptAction('wolf')).toBe(false);
    });

    it('should return false when nightFlow is null', () => {
      service.reset();
      expect(service.canAcceptAction('wolf')).toBe(false);
    });
  });

  // ===========================================================================
  // playCurrentRoleAudio (indirectly tested)
  // ===========================================================================

  describe('playCurrentRoleAudio (via startNight)', () => {
    it('should play role beginning audio after night begins', async () => {
      const state = createTestState();
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      const startPromise = service.startNight(['wolf', 'witch']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;

      expect(mockAudioService.playRoleBeginningAudio).toHaveBeenCalledWith('wolf');
    });

    it('should call endNight when no more roles', async () => {
      // Start night with only one role
      const state = createTestState({
        template: {
          name: 'Single Role',
          numberOfPlayers: 6,
          roles: ['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'],
        },
      });
      deps = createTestDeps(state);
      service = new NightFlowService(deps);

      const startPromise = service.startNight(['wolf']);
      await jest.advanceTimersByTimeAsync(5000);
      await jest.runAllTimersAsync();
      await startPromise;

      // Advance through wolf action
      const nightFlow = service.getNightFlow();
      if (nightFlow) {
        nightFlow.dispatch(NightEvent.ActionSubmitted);
      }

      jest.clearAllMocks();

      // This should trigger endNight since no more roles
      await service.advanceToNextAction();

      // Should have played night end audio
      expect(mockAudioService.playNightEndAudio).toHaveBeenCalled();
    });
  });
});
