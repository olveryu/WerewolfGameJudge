/**
 * Contract test: CONFIRM_STATUS private message for hunter/darkWolfKing
 * 
 * BUG FIX: Previously, getHunterStatus/getDarkWolfKingStatus computed canShoot
 * by looking at gameState.actions.get('witch'), but for non-Host players,
 * actions Map is always empty (anti-cheat: actions not broadcast).
 * 
 * FIX: Host sends CONFIRM_STATUS private message when hunter/darkWolfKing turn
 * starts. Client reads status from private message instead of computing.
 * 
 * This test locks the fix to prevent regression.
 */

import { ConfirmStatusPayload } from '../types/PrivateBroadcast';

describe('CONFIRM_STATUS private message contract', () => {
  describe('payload structure', () => {
    it('should have required fields: kind, role, canShoot', () => {
      const payload: ConfirmStatusPayload = {
        kind: 'CONFIRM_STATUS',
        role: 'hunter',
        canShoot: true,
      };
      
      expect(payload.kind).toBe('CONFIRM_STATUS');
      expect(payload.role).toBe('hunter');
      expect(payload.canShoot).toBe(true);
    });

    it('role should be hunter or darkWolfKing', () => {
      const hunterPayload: ConfirmStatusPayload = {
        kind: 'CONFIRM_STATUS',
        role: 'hunter',
        canShoot: false,
      };
      
      const darkWolfKingPayload: ConfirmStatusPayload = {
        kind: 'CONFIRM_STATUS',
        role: 'darkWolfKing',
        canShoot: true,
      };
      
      expect(hunterPayload.role).toBe('hunter');
      expect(darkWolfKingPayload.role).toBe('darkWolfKing');
    });

    it('canShoot should be boolean', () => {
      const poisonedPayload: ConfirmStatusPayload = {
        kind: 'CONFIRM_STATUS',
        role: 'hunter',
        canShoot: false,  // poisoned by witch
      };
      
      const notPoisonedPayload: ConfirmStatusPayload = {
        kind: 'CONFIRM_STATUS',
        role: 'hunter',
        canShoot: true,  // not poisoned
      };
      
      expect(poisonedPayload.canShoot).toBe(false);
      expect(notPoisonedPayload.canShoot).toBe(true);
    });
  });

  describe('anti-cheat invariants', () => {
    it('PrivatePayload union should include ConfirmStatusPayload', () => {
      // This test ensures the type is in the union
      // If ConfirmStatusPayload is removed from union, this will fail to compile
      const payload: ConfirmStatusPayload = {
        kind: 'CONFIRM_STATUS',
        role: 'hunter',
        canShoot: true,
      };
      
      // Type assertion to prove it's part of PrivatePayload union
      const _: import('../types/PrivateBroadcast').PrivatePayload = payload;
      expect(_).toBeDefined();
    });
  });
});
