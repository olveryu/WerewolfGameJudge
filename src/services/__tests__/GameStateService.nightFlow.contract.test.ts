/**
 * GameStateService NightFlow Contract Tests (Step 5)
 * 
 * Tests only observable behavior contracts:
 * - Broadcast message sequences (STATE_UPDATE, ROLE_TURN, etc.)
 * - currentActionerIndex progression
 * - state.actions write/reject
 * 
 * Does NOT test:
 * - Internal nightFlow phase
 * - Audio call order
 * - Wolf voting
 * - Death calculation
 */

import { GameStateService, GameStatus } from '../GameStateService';
import { GameTemplate } from '../../models/Template';
import { RoleName } from '../../models/roles';
import { isActionTarget, getActionTargetSeat, makeActionTarget } from '../../models/actions';

// =============================================================================
// Mocks
// =============================================================================

// Capture broadcastAsHost calls for contract assertions
const broadcastCalls: Array<{ type: string; [key: string]: any }> = [];

// Capture sendPrivate calls for anti-cheat assertions
const privateCalls: Array<{ type: string; toUid: string; payload: any }> = [];

// Mock BroadcastService
jest.mock('../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockImplementation((msg: any) => {
        broadcastCalls.push(msg);
        return Promise.resolve();
      }),
      broadcastPublic: jest.fn().mockImplementation((msg: any) => {
        broadcastCalls.push(msg);
        return Promise.resolve();
      }),
      sendPrivate: jest.fn().mockImplementation((msg: any) => {
        privateCalls.push(msg);
        return Promise.resolve();
      }),
      sendToHost: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock AudioService - immediate resolve, no order assertions
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
  const roles: RoleName[] = [...actionOrder];
  while (roles.length < 6) {
    roles.push('villager');
  }
  
  return {
    name: 'Contract Test Template',
    roles,
    numberOfPlayers: roles.length,
    actionOrder,
  };
}

/**
 * Reset GameStateService singleton for testing
 */
function resetGameStateService(): GameStateService {
  (GameStateService as any).instance = undefined;
  return GameStateService.getInstance();
}

/**
 * Setup a GameStateService in ready state (ready to startGame)
 * Assigns specific roles to specific seats for deterministic testing
 */
async function setupReadyStateWithRoles(
  service: GameStateService,
  actionOrder: RoleName[],
  seatRoleMap: Map<number, RoleName>
): Promise<void> {
  const template = createTestTemplate(actionOrder);
  
  await service.initializeAsHost('TEST01', 'host-uid', template);
  
  // Fill all seats with players (directly set state for testing - unique UIDs per seat)
  const state = service.getState()!;
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
  
  // Manually assign roles (bypass random shuffle)
  seatRoleMap.forEach((role, seat) => {
    const player = state.players.get(seat);
    if (player) {
      player.role = role;
      player.hasViewedRole = true;
    }
  });
  
  // Fill remaining seats with villager
  state.players.forEach((player, seat) => {
    if (player && !player.role) {
      player.role = 'villager';
      player.hasViewedRole = true;
    }
  });
  
  state.status = GameStatus.ready;
}

/**
 * Invoke private handlePlayerAction method
 */
async function invokeHandlePlayerAction(
  service: GameStateService,
  seat: number,
  role: RoleName,
  target: number | null,
  extra?: any
): Promise<void> {
  await (service as any).handlePlayerAction(seat, role, target, extra);
}

// =============================================================================
// Contract Tests
// =============================================================================

describe('GameStateService NightFlow Contract Tests', () => {
  let service: GameStateService;

  beforeEach(() => {
    // Clear broadcast capture
    broadcastCalls.length = 0;
    
    // Reset singleton
    service = resetGameStateService();
    
    // Use fake timers to skip 5s delay in startGame
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('C1: startGame broadcasts STATE_UPDATE with ongoing status', () => {
    it('should broadcast STATE_UPDATE with status=ongoing and currentActionerIndex=0', async () => {
      // Given: room is in ready state
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      // When: host calls startGame
      const startPromise = service.startGame();
      
      // Advance past the 5s delay
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // Then: at least one STATE_UPDATE with status=ongoing and currentActionerIndex=0
      const stateUpdates = broadcastCalls.filter(
        (msg) => msg.type === 'STATE_UPDATE'
      );
      
      expect(stateUpdates.length).toBeGreaterThanOrEqual(1);
      
      const ongoingUpdate = stateUpdates.find(
        (msg) => msg.state?.status === GameStatus.ongoing && msg.state?.currentActionerIndex === 0
      );
      expect(ongoingUpdate).toBeDefined();
    });
  });

  describe('C3: startGame broadcasts ROLE_TURN for first role', () => {
    it('should broadcast ROLE_TURN with role=actionOrder[0]', async () => {
      // Given: room is in ready state with actionOrder = [seer, witch]
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      // When: host calls startGame
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // Then: ROLE_TURN with role=seer appears
      const roleTurns = broadcastCalls.filter((msg) => msg.type === 'ROLE_TURN');
      expect(roleTurns.length).toBeGreaterThanOrEqual(1);
      
      const firstRoleTurn = roleTurns.find((msg) => msg.role === 'seer');
      expect(firstRoleTurn).toBeDefined();
    });
  });

  describe('C4: correct action writes to state.actions', () => {
    it('should record action in state.actions when role matches current turn', async () => {
      // Given: game is ongoing, currentActionerIndex=0 (seer's turn)
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // Clear broadcast calls to focus on action
      broadcastCalls.length = 0;
      
      // When: seer submits action with target=3
      await invokeHandlePlayerAction(service, 0, 'seer', 3);
      
      // Then: state.actions.get('seer') is a target action with seat 3
      const state = service.getState()!;
      const seerAction = state.actions.get('seer');
      expect(seerAction).toBeDefined();
      expect(isActionTarget(seerAction!)).toBe(true);
      expect(getActionTargetSeat(seerAction)).toBe(3);
    });
  });

  describe('C5: wrong role action is rejected', () => {
    it('should not record action when role does not match current turn', async () => {
      // Given: game is ongoing, currentActionerIndex=0 (seer's turn)
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // When: witch tries to submit action (wrong role)
      await invokeHandlePlayerAction(service, 1, 'witch', 2);
      
      // Then: state.actions.get('witch') is undefined
      const state = service.getState()!;
      expect(state.actions.get('witch')).toBeUndefined();
    });
  });

  describe('C6: correct action advances currentActionerIndex', () => {
    it('should advance currentActionerIndex from 0 to 1 after correct action', async () => {
      // Given: game is ongoing, currentActionerIndex=0 (seer's turn)
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      const stateBefore = service.getState()!;
      expect(stateBefore.currentActionerIndex).toBe(0);
      
      // When: seer submits correct action
      await invokeHandlePlayerAction(service, 0, 'seer', 3);
      
      // Then: currentActionerIndex is now 1
      const stateAfter = service.getState()!;
      expect(stateAfter.currentActionerIndex).toBe(1);
    });
  });

  describe('C7: advancing broadcasts ROLE_TURN for next role', () => {
    it('should broadcast ROLE_TURN with role=actionOrder[1] after first action', async () => {
      // Given: game is ongoing, currentActionerIndex=0 (seer's turn)
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // Clear broadcast calls to focus on next action
      broadcastCalls.length = 0;
      
      // When: seer submits correct action
      await invokeHandlePlayerAction(service, 0, 'seer', 3);
      
      // Then: ROLE_TURN with role=witch appears
      const roleTurns = broadcastCalls.filter((msg) => msg.type === 'ROLE_TURN');
      const witchTurn = roleTurns.find((msg) => msg.role === 'witch');
      expect(witchTurn).toBeDefined();
    });
  });

  // ===========================================================================
  // C8-C10: State Machine Strictness Tests
  // These tests verify that GameStateService respects NightFlowController authority
  // ===========================================================================

  describe('C8: duplicate RoleEndAudioDone is idempotent (no side effects)', () => {
    it('should not change currentActionerIndex when RoleEndAudioDone called in wrong phase', async () => {
      // Given: game is ongoing, currentActionerIndex=0 (seer's turn), phase=WaitingForAction
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      const stateBefore = service.getState()!;
      const indexBefore = stateBefore.currentActionerIndex;
      expect(indexBefore).toBe(0);
      
      // When: we directly call advanceToNextAction (simulating duplicate/stale callback)
      // WITHOUT first calling ActionSubmitted - phase is still WaitingForAction
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      
      // Access private method via any
      await (service as any).advanceToNextAction();
      
      // Then: currentActionerIndex should NOT have changed (idempotent)
      const stateAfter = service.getState()!;
      expect(stateAfter.currentActionerIndex).toBe(indexBefore);
      
      // And: debug log was called (not error)
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('RoleEndAudioDone ignored (idempotent)'),
        expect.anything(),
        expect.anything()
      );
      
      debugSpy.mockRestore();
    });

    it('should not call console.error when RoleEndAudioDone called in wrong phase', async () => {
      // Given: game is ongoing
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // When: we directly call advanceToNextAction without ActionSubmitted
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      
      await (service as any).advanceToNextAction();
      
      // Then: console.error should NOT have been called
      expect(errorSpy).not.toHaveBeenCalled();
      
      errorSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe('C9: endNight() in wrong phase is strict no-op (no death calc, no status change)', () => {
    it('should not throw or log error when endNight called in wrong phase', async () => {
      // Given: game is ongoing, first role's turn
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // Confirm we're in WaitingForAction phase (not NightEndAudio)
      expect(service.getState()!.currentActionerIndex).toBe(0);
      
      // When: we directly call endNight (simulating duplicate/stale callback)
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      
      // This should NOT throw
      await expect((service as any).endNight()).resolves.not.toThrow();
      
      // Then: console.error should NOT have been called
      expect(errorSpy).not.toHaveBeenCalled();
      
      errorSpy.mockRestore();
      debugSpy.mockRestore();
    });

    it('should NOT change status or lastNightDeaths when endNight called in wrong phase (strict)', async () => {
      // Given: game is ongoing, first role's turn
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      const stateBefore = service.getState()!;
      const statusBefore = stateBefore.status;
      const lastNightDeathsBefore = stateBefore.lastNightDeaths;
      
      // Confirm we're in WaitingForAction phase (not NightEndAudio)
      expect(statusBefore).toBe(GameStatus.ongoing);
      expect(lastNightDeathsBefore).toEqual([]);
      
      // When: we directly call endNight in wrong phase
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      
      await (service as any).endNight();
      
      // Then: status should NOT have changed (strict no-op)
      const stateAfter = service.getState()!;
      expect(stateAfter.status).toBe(statusBefore);
      expect(stateAfter.lastNightDeaths).toEqual(lastNightDeathsBefore);
      
      // And: debug log was called with phase info
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('endNight() ignored (strict no-op)'),
        expect.anything(),
        expect.anything()
      );
      
      debugSpy.mockRestore();
    });
  });

  describe('C10: ActionSubmitted is required before RoleEndAudioDone', () => {
    it('should successfully advance when ActionSubmitted is dispatched first', async () => {
      // Given: game is ongoing, seer's turn
      const actionOrder: RoleName[] = ['seer', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
        [1, 'witch'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      expect(service.getState()!.currentActionerIndex).toBe(0);
      
      // When: we submit action (which dispatches ActionSubmitted + RoleEndAudioDone)
      await invokeHandlePlayerAction(service, 0, 'seer', 3);
      
      // Then: currentActionerIndex advances to 1
      expect(service.getState()!.currentActionerIndex).toBe(1);
    });
  });

  describe('C11: handleWolfVote once-guard prevents duplicate finalize', () => {
    it('should skip finalize when wolf action already recorded (once-guard)', async () => {
      // Given: game is ongoing, wolf's turn
      const actionOrder: RoleName[] = ['wolf', 'witch'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'wolf'],
        [1, 'witch'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // Manually set wolf action as if already finalized
      const state = service.getState()!;
      state.actions.set('wolf', makeActionTarget(1));
      const indexBefore = state.currentActionerIndex;
      
      // When: wolf votes again (simulating duplicate finalize attempt)
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      
      await (service as any).handleWolfVote(0, 1);
      
      // Then: currentActionerIndex should NOT have changed (once-guard)
      expect(service.getState()!.currentActionerIndex).toBe(indexBefore);
      
      // And: debug log was called indicating once-guard
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('handleWolfVote finalize skipped (once-guard)'),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      
      debugSpy.mockRestore();
    });
  });

  // ===========================================================================
  // C12-C14: Strict Invariant Violation Tests (nightFlow === null when ongoing)
  // ===========================================================================

  describe('C12: advanceToNextAction throws when nightFlow is null and status is ongoing', () => {
    it('should throw strict invariant violation error', async () => {
      // Given: game is ongoing but nightFlow is forcibly set to null
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      // Force nightFlow to null (simulating a bug)
      (service as any).nightFlow = null;
      
      // Confirm status is ongoing
      expect(service.getState()!.status).toBe(GameStatus.ongoing);
      
      // When/Then: advanceToNextAction should throw
      await expect((service as any).advanceToNextAction()).rejects.toThrow(
        'advanceToNextAction: nightFlow is null - strict invariant violation'
      );
    });
  });

  describe('C13: endNight throws when nightFlow is null and status is ongoing', () => {
    it('should throw strict invariant violation error and not change status', async () => {
      // Given: game is ongoing but nightFlow is forcibly set to null
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      const statusBefore = service.getState()!.status;
      const lastNightDeathsBefore = service.getState()!.lastNightDeaths;
      
      // Force nightFlow to null
      (service as any).nightFlow = null;
      
      // When/Then: endNight should throw
      await expect((service as any).endNight()).rejects.toThrow(
        'endNight: nightFlow is null - strict invariant violation'
      );
      
      // And: status should NOT have changed
      expect(service.getState()!.status).toBe(statusBefore);
      expect(service.getState()!.lastNightDeaths).toEqual(lastNightDeathsBefore);
    });
  });

  describe('C14: handlePlayerAction throws when nightFlow is null and status is ongoing', () => {
    it('should throw strict invariant violation error and not record action', async () => {
      // Given: game is ongoing but nightFlow is forcibly set to null
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      const startPromise = service.startGame();
      await jest.advanceTimersByTimeAsync(5000);
      await startPromise;
      
      const actionsBefore = new Map(service.getState()!.actions);
      const indexBefore = service.getState()!.currentActionerIndex;
      
      // Force nightFlow to null
      (service as any).nightFlow = null;
      
      // When/Then: handlePlayerAction should throw
      await expect((service as any).handlePlayerAction(0, 'seer', 1)).rejects.toThrow(
        'handlePlayerAction: nightFlow is null - strict invariant violation'
      );
      
      // And: actions should NOT have been recorded, index should NOT change
      expect(service.getState()!.actions).toEqual(actionsBefore);
      expect(service.getState()!.currentActionerIndex).toBe(indexBefore);
    });
  });

  // ===========================================================================
  // C15: Boundary test - non-ongoing + nightFlow null should NOT throw
  // ===========================================================================

  describe('C15: non-ongoing status with nightFlow null should NOT throw', () => {
    it('advanceToNextAction should not throw when status is ready and nightFlow is null', async () => {
      // Given: game is in ready status (not ongoing)
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      // Confirm status is ready (not ongoing)
      expect(service.getState()!.status).toBe(GameStatus.ready);
      
      // nightFlow should be null before game starts
      expect((service as any).nightFlow).toBeNull();
      
      // When/Then: advanceToNextAction should NOT throw (just return silently)
      await expect((service as any).advanceToNextAction()).resolves.not.toThrow();
    });

    it('endNight should not throw when status is ready and nightFlow is null', async () => {
      // Given: game is in ready status (not ongoing)
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      expect(service.getState()!.status).toBe(GameStatus.ready);
      expect((service as any).nightFlow).toBeNull();
      
      // When/Then: endNight should NOT throw
      await expect((service as any).endNight()).resolves.not.toThrow();
    });

    it('handlePlayerAction should not throw when status is ready (early return before null check)', async () => {
      // Given: game is in ready status (not ongoing)
      const actionOrder: RoleName[] = ['seer'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'seer'],
      ]));
      
      expect(service.getState()!.status).toBe(GameStatus.ready);
      
      // When/Then: handlePlayerAction should NOT throw (returns early due to status check)
      await expect((service as any).handlePlayerAction(0, 'seer', 1)).resolves.not.toThrow();
    });

    it('handleWolfVote should not throw when status is ready (early return before null check)', async () => {
      // Given: game is in ready status (not ongoing)
      const actionOrder: RoleName[] = ['wolf'];
      await setupReadyStateWithRoles(service, actionOrder, new Map([
        [0, 'wolf'],
      ]));
      
      expect(service.getState()!.status).toBe(GameStatus.ready);
      
      // When/Then: handleWolfVote should NOT throw (returns early due to status check)
      await expect((service as any).handleWolfVote(0, 1)).resolves.not.toThrow();
    });
  });
});
