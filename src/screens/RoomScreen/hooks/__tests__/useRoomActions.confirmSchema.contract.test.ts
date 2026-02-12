/**
 * Contract test: Hunter/DarkWolfKing confirm schema design
 *
 * This test locks the schema-driven design for confirm-type actions:
 * - kind='confirm' means: no target selection, user only confirms status
 * - Target is determined by context (the player themselves)
 * - UI shows status (can shoot / cannot shoot) via bottom button
 *
 * Behavior:
 * - Seat tap has NO effect (action is via bottom button only)
 * - Bottom button triggers status check dialog
 * - canShoot logic now lives in resolvers (see wolfRobot.resolver.test.ts)
 */

import { SCHEMAS } from '@/models/roles/spec/schemas';

describe('confirm schema contract (hunter/darkWolfKing)', () => {
  describe('hunterConfirm schema', () => {
    it('should be confirm kind (no target selection)', () => {
      expect(SCHEMAS.hunterConfirm.kind).toBe('confirm');
    });

    it('should have id matching schema key', () => {
      expect(SCHEMAS.hunterConfirm.id).toBe('hunterConfirm');
    });

    it('should have bottomActionText for status check button', () => {
      expect(SCHEMAS.hunterConfirm.ui?.bottomActionText).toBeDefined();
      expect(typeof SCHEMAS.hunterConfirm.ui?.bottomActionText).toBe('string');
      expect(SCHEMAS.hunterConfirm.ui?.bottomActionText?.length).toBeGreaterThan(0);
    });

    it('should have prompt for action message', () => {
      expect(SCHEMAS.hunterConfirm.ui?.prompt).toBeDefined();
      expect(typeof SCHEMAS.hunterConfirm.ui?.prompt).toBe('string');
    });

    it('should have canSkip=true (for nightmare block skip button)', () => {
      // confirm schema needs canSkip to show skip button when blocked by nightmare
      expect(SCHEMAS.hunterConfirm.canSkip).toBe(true);
    });

    it('should NOT have constraints (no target selection)', () => {
      expect((SCHEMAS.hunterConfirm as any).constraints).toBeUndefined();
    });
  });

  describe('darkWolfKingConfirm schema', () => {
    it('should be confirm kind (no target selection)', () => {
      expect(SCHEMAS.darkWolfKingConfirm.kind).toBe('confirm');
    });

    it('should have id matching schema key', () => {
      expect(SCHEMAS.darkWolfKingConfirm.id).toBe('darkWolfKingConfirm');
    });

    it('should have bottomActionText for status check button', () => {
      expect(SCHEMAS.darkWolfKingConfirm.ui?.bottomActionText).toBeDefined();
      expect(typeof SCHEMAS.darkWolfKingConfirm.ui?.bottomActionText).toBe('string');
      expect(SCHEMAS.darkWolfKingConfirm.ui?.bottomActionText?.length).toBeGreaterThan(0);
    });

    it('should have prompt for action message', () => {
      expect(SCHEMAS.darkWolfKingConfirm.ui?.prompt).toBeDefined();
      expect(typeof SCHEMAS.darkWolfKingConfirm.ui?.prompt).toBe('string');
    });

    it('should have canSkip=true (for nightmare block skip button)', () => {
      // confirm schema needs canSkip to show skip button when blocked by nightmare
      expect(SCHEMAS.darkWolfKingConfirm.canSkip).toBe(true);
    });

    it('should NOT have constraints (no target selection)', () => {
      expect((SCHEMAS.darkWolfKingConfirm as any).constraints).toBeUndefined();
    });
  });

  describe('confirm schema symmetry', () => {
    it('hunter and darkWolfKing should have identical schema structure', () => {
      // Both are confirm kind
      expect(SCHEMAS.hunterConfirm.kind).toBe(SCHEMAS.darkWolfKingConfirm.kind);

      // Both have the same displayName pattern
      expect(SCHEMAS.hunterConfirm.displayName).toBe(SCHEMAS.darkWolfKingConfirm.displayName);

      // Both have bottomActionText
      expect(SCHEMAS.hunterConfirm.ui?.bottomActionText).toBeDefined();
      expect(SCHEMAS.darkWolfKingConfirm.ui?.bottomActionText).toBeDefined();
    });

    it('both should use the same bottom button text', () => {
      // They should have identical button text for consistency
      expect(SCHEMAS.hunterConfirm.ui?.bottomActionText).toBe(
        SCHEMAS.darkWolfKingConfirm.ui?.bottomActionText,
      );
    });
  });
});
