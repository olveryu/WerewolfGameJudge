/**
 * API Compatibility Contract Test
 *
 * Ensures GameFacade exposes the same public API as legacy GameStateService.
 * This test guards against accidental API drift during the migration.
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md Phase 2
 */

import { GameFacade } from '../../facade/GameFacade';
import { GameStateService } from '../../../legacy';

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
        'function'
      );
    });
  });

  describe('Singleton pattern', () => {
    it('GameFacade.getInstance() should always return the same instance', () => {
      const instance1 = GameFacade.getInstance();
      const instance2 = GameFacade.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('GameFacade should delegate to GameStateService singleton', () => {
      // Access the private legacy via any cast (test-only)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (facade as any).legacy;
      expect(delegate).toBe(legacyService);
    });
  });

  describe('Delegation behavior', () => {
    it('getState should return the same state object', () => {
      // Both should return the same underlying state reference
      const facadeState = facade.getState();
      const legacyState = legacyService.getState();

      // They should be the same object (delegation, not copy)
      expect(facadeState).toBe(legacyState);
    });

    it('isHostPlayer should return the same value', () => {
      expect(facade.isHostPlayer()).toBe(legacyService.isHostPlayer());
    });

    it('getMyUid should return the same value', () => {
      expect(facade.getMyUid()).toBe(legacyService.getMyUid());
    });
  });
});
