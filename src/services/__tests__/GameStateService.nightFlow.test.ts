/**
 * GameStateService NightFlowController Integration Tests
 * 
 * Tests only the NightFlowController integration points:
 * - startGame() initializes nightFlow
 * - restartGame() resets nightFlow
 * - handlePlayerAction() guard logic
 * - dispatch() error recovery
 * 
 * Does NOT test:
 * - Wolf voting logic
 * - Death calculation
 * - Full audio flow
 */

import { GameStateService, GameStatus } from '../GameStateService';
import { NightPhase, NightEvent } from '../NightFlowController';
import { GameTemplate } from '../../models/Template';
import { RoleName } from '../../models/roles';

// =============================================================================
// Mocks
// =============================================================================

// Mock BroadcastService
jest.mock('../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock AudioService
jest.mock('../AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
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

/**
 * Create a minimal GameTemplate for testing
 */
function createTestTemplate(actionOrder: RoleName[]): GameTemplate {
  // Template needs roles array matching actionOrder length + some villagers
  const roles: RoleName[] = [...actionOrder];
  // Fill remaining with villagers to make a valid template
  while (roles.length < 6) {
    roles.push('villager');
  }
  
  return {
    name: 'Test Template',
    roles,
    numberOfPlayers: roles.length,
    actionOrder,
  };
}

/**
 * Reset GameStateService singleton for testing
 */
function resetGameStateService(): GameStateService {
  // Reset singleton by accessing private static instance
  (GameStateService as any).instance = undefined;
  return GameStateService.getInstance();
}

/**
 * Setup a GameStateService in ready state (ready to startGame)
 */
async function setupReadyState(
  service: GameStateService,
  actionOrder: RoleName[] = ['wolf', 'witch', 'seer']
): Promise<void> {
  const template = createTestTemplate(actionOrder);
  
  // Initialize as host
  await service.initializeAsHost('TEST01', 'host-uid', template);
  
  // Fill with bots
  await service.fillWithBots();
  
  // Assign roles
  await service.assignRoles();
  
  // Mark all as viewed (simulate all players viewed roles)
  const state = service.getState()!;
  state.players.forEach((player) => {
    if (player) {
      player.hasViewedRole = true;
    }
  });
  state.status = GameStatus.ready;
}

/**
 * Get private nightFlow from service
 */
function getNightFlow(service: GameStateService): any {
  return (service as any).nightFlow;
}

/**
 * Get private state from service
 */
function getState(service: GameStateService): any {
  return (service as any).state;
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService NightFlowController Integration', () => {
  let service: GameStateService;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    service = resetGameStateService();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  // ===========================================================================
  // 1. startGame() initializes nightFlow
  // ===========================================================================

  describe('startGame() initializes nightFlow', () => {
    it('should create nightFlow when startGame is called', async () => {
      // Given: Host in ready state
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      
      // When: Start game (run all timers to complete async flow)
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      // Then: nightFlow should be created
      const nightFlow = getNightFlow(service);
      expect(nightFlow).not.toBeNull();
    });

    it('should initialize nightFlow with correct actionOrder from template', async () => {
      // Given: Host in ready state with specific action order
      const actionOrder: RoleName[] = ['wolf', 'witch', 'seer'];
      await setupReadyState(service, actionOrder);
      
      // When: Start game
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      // Then: nightFlow.actionOrder should match template
      const nightFlow = getNightFlow(service);
      expect(nightFlow.actionOrder).toEqual(actionOrder);
    });

    it('should sync currentActionerIndex to 0 after startGame', async () => {
      // Given: Host in ready state
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      
      // When: Start game
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      // Then: Both state and nightFlow should have index 0
      const nightFlow = getNightFlow(service);
      const state = getState(service);
      expect(state.currentActionerIndex).toBe(0);
      expect(nightFlow.currentActionIndex).toBe(0);
    });
  });

  // ===========================================================================
  // 2. restartGame() resets nightFlow
  // ===========================================================================

  describe('restartGame() resets nightFlow', () => {
    it('should set nightFlow to null after restartGame', async () => {
      // Given: Game has started (nightFlow exists)
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      expect(getNightFlow(service)).not.toBeNull();
      
      // When: Restart game
      await service.restartGame();
      
      // Then: nightFlow should be null
      expect(getNightFlow(service)).toBeNull();
    });

    it('should allow starting a new game after restartGame', async () => {
      // Given: Game started then restarted
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      const startPromise1 = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise1;
      await service.restartGame();
      
      // When: Setup and start new game
      await service.assignRoles();
      const state = getState(service);
      state.players.forEach((player: any) => {
        if (player) player.hasViewedRole = true;
      });
      state.status = GameStatus.ready;
      
      const startPromise2 = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise2;
      
      // Then: New nightFlow should be created
      const nightFlow = getNightFlow(service);
      expect(nightFlow).not.toBeNull();
      expect(nightFlow.actionOrder).toEqual(['wolf', 'witch', 'seer']);
    });
  });

  // ===========================================================================
  // 3. handlePlayerAction() guard logic
  // ===========================================================================

  describe('handlePlayerAction() guard logic', () => {
    it('should ignore action when nightFlow phase is not WaitingForAction', async () => {
      // Given: Game started, manually set nightFlow to a non-WaitingForAction phase
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      const nightFlow = getNightFlow(service);
      const state = getState(service);
      state.status = GameStatus.ongoing;
      
      // Force nightFlow to RoleBeginAudio phase (not WaitingForAction)
      // Reset and dispatch to get to a known state
      nightFlow.dispatch(NightEvent.Reset);
      nightFlow.dispatch(NightEvent.StartNight);
      // Now phase is NightBeginAudio, not WaitingForAction
      expect(nightFlow.phase).toBe(NightPhase.NightBeginAudio);
      
      // When: Try to submit action
      const handlePlayerAction = (service as any).handlePlayerAction.bind(service);
      await handlePlayerAction(0, 'wolf', 3);
      
      // Then: Action should NOT be recorded
      expect(state.actions.has('wolf')).toBe(false);
    });

    it('should ignore action when role does not match nightFlow.currentRole', async () => {
      // Given: Game started, nightFlow in WaitingForAction for 'wolf'
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      const nightFlow = getNightFlow(service);
      const state = getState(service);
      state.status = GameStatus.ongoing;
      
      // Manually set nightFlow to WaitingForAction for wolf
      nightFlow.dispatch(NightEvent.Reset);
      nightFlow.dispatch(NightEvent.StartNight);
      nightFlow.dispatch(NightEvent.NightBeginAudioDone);
      nightFlow.dispatch(NightEvent.RoleBeginAudioDone);
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
      expect(nightFlow.currentRole).toBe('wolf');
      
      // When: Try to submit action for wrong role (witch instead of wolf)
      const handlePlayerAction = (service as any).handlePlayerAction.bind(service);
      await handlePlayerAction(0, 'witch', 3);
      
      // Then: Action should NOT be recorded
      expect(state.actions.has('witch')).toBe(false);
    });

    it('should record action when phase is WaitingForAction and role matches', async () => {
      // Given: Game started, nightFlow in WaitingForAction for 'wolf'
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      const nightFlow = getNightFlow(service);
      const state = getState(service);
      state.status = GameStatus.ongoing;
      
      // Manually set nightFlow to WaitingForAction for wolf
      nightFlow.dispatch(NightEvent.Reset);
      nightFlow.dispatch(NightEvent.StartNight);
      nightFlow.dispatch(NightEvent.NightBeginAudioDone);
      nightFlow.dispatch(NightEvent.RoleBeginAudioDone);
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
      expect(nightFlow.currentRole).toBe('wolf');
      
      // When: Submit correct action
      const handlePlayerAction = (service as any).handlePlayerAction.bind(service);
      await handlePlayerAction(0, 'wolf', 3);
      
      // Then: Action should be recorded
      expect(state.actions.get('wolf')).toBe(3);
    });
  });

  // ===========================================================================
  // 4. dispatch() error recovery
  // ===========================================================================

  describe('dispatch() error recovery', () => {
    it('should not throw when dispatch fails with InvalidNightTransitionError', async () => {
      // Given: Game started
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      const nightFlow = getNightFlow(service);
      const state = getState(service);
      state.status = GameStatus.ongoing;
      
      // Force nightFlow to Ended state (terminal)
      nightFlow.dispatch(NightEvent.Reset);
      nightFlow.dispatch(NightEvent.StartNight);
      nightFlow.dispatch(NightEvent.NightBeginAudioDone);
      // Now we have no roles, so it goes to NightEndAudio
      // For this test, let's manually force Ended state
      (nightFlow as any)._phase = NightPhase.Ended;
      
      // When: Call advanceToNextAction which will try to dispatch RoleEndAudioDone
      // This should throw InvalidNightTransitionError but be caught
      const advanceToNextAction = (service as any).advanceToNextAction.bind(service);
      
      // Then: Should not throw, should log error
      await expect(advanceToNextAction()).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should fallback to manual index advance when RoleEndAudioDone dispatch fails', async () => {
      // Given: Game started with action order
      await setupReadyState(service, ['wolf', 'witch', 'seer']);
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      const nightFlow = getNightFlow(service);
      const state = getState(service);
      state.status = GameStatus.ongoing;
      state.currentActionerIndex = 0;
      
      // Force nightFlow to a phase where RoleEndAudioDone will fail
      (nightFlow as any)._phase = NightPhase.Ended;
      
      // When: Call advanceToNextAction
      const advanceToNextAction = (service as any).advanceToNextAction.bind(service);
      await advanceToNextAction();
      
      // Then: currentActionerIndex should still be incremented (fallback)
      expect(state.currentActionerIndex).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
