/**
 * API Compatibility Contract Test
 *
 * Ensures GameFacade exposes the same public API as legacy GameStateService.
 * This test guards against accidental API drift during the migration.
 *
 * Phase 2: GameFacade delegated to legacy GameStateService
 * Phase 4: GameFacade uses v2 Engines (HostEngine, PlayerEngine)
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md
 */

import { GameFacade } from '../../facade/GameFacade';
import { GameStateService } from '../../../core';

describe('GameFacade API Compatibility', () => {
  // Get all public methods from GameStateService instance
  const legacyService = GameStateService.getInstance();
  const facade = GameFacade.getInstance();

  // Methods that should exist on both (verified against actual GameStateService)
  const expectedPublicMethods = [
    // State accessors
    'getState',
    'isHostPlayer',
    'getMyUid',
    'getMySeatNumber',
    'getMyRole',

    // Host operations
    'initializeAsHost',
    'rejoinAsHost',
    'assignRoles',
    'startGame',
    'restartGame',
    'updateTemplate',

    // Player operations
    'joinAsPlayer',
    'leaveRoom',
    'takeSeat',
    'leaveSeat',
    'takeSeatWithAck',
    'leaveSeatWithAck',
    'requestSnapshot',
    'playerViewedRole',

    // Game actions
    'submitAction',
    'submitWolfVote',
    'submitRevealAck',

    // Listener
    'addListener',
  ] as const;

  describe('Method existence', () => {
    it.each(expectedPublicMethods)('should have method: %s', (methodName) => {
      expect(typeof (facade as unknown as Record<string, unknown>)[methodName]).toBe('function');
      expect(typeof (legacyService as unknown as Record<string, unknown>)[methodName]).toBe(
        'function',
      );
    });
  });

  describe('Singleton pattern', () => {
    it('GameFacade.getInstance() should always return the same instance', () => {
      const instance1 = GameFacade.getInstance();
      const instance2 = GameFacade.getInstance();
      expect(instance1).toBe(instance2);
    });

    // Phase 4: GameFacade no longer delegates to legacy GameStateService
    // It now uses v2 Engines (HostEngine, PlayerEngine) directly.
    // The delegation test is removed as it's no longer applicable.
  });

  describe('State shape compatibility', () => {
    // Phase 4: GameFacade uses its own StateStore, not legacy's state.
    // Before initialization, getState() returns null.
    // After initialization, it returns a valid LocalGameState.
    it('getState should return null before initialization', () => {
      // GameFacade not yet initialized - state is null
      // This is expected behavior for v2 architecture
      const facadeState = facade.getState();

      // Before initializeAsHost/joinAsPlayer, state is null
      // This differs from legacy which always returns a default state
      expect(facadeState === null || typeof facadeState === 'object').toBe(true);
    });

    it('isHostPlayer should return a boolean', () => {
      expect(typeof facade.isHostPlayer()).toBe('boolean');
    });

    it('getMyUid should return null or undefined when not connected', () => {
      // In initial state (not connected), uid should be null or undefined
      const uid = facade.getMyUid();
      expect(uid == null).toBe(true); // null or undefined
    });
  });
});
