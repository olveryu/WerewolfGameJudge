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
 * - Status is determined by getConfirmRoleCanShoot() (poisoned = cannot shoot)
 */

import { SCHEMAS } from '../../../../models/roles/spec/schemas';
import { getConfirmRoleCanShoot } from '../../../../models/Room';
import type { GameRoomLike } from '../../../../models/Room';
import type { RoleId } from '../../../../models/roles';
import type { RoleAction } from '../../../../models/actions';
import { makeActionWitch, makeWitchPoison } from '../../../../models/actions';

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

  describe('getConfirmRoleCanShoot behavior', () => {
    const createMockRoom = (
      role: 'hunter' | 'darkWolfKing',
      roleSeat: number,
      poisonedSeat: number | null,
    ): GameRoomLike => {
      const players = new Map<
        number,
        { uid: string; seatNumber: number; role: RoleId | null; hasViewedRole: boolean }
      >();
      for (let i = 0; i < 12; i++) {
        players.set(i, {
          uid: `p${i}`,
          seatNumber: i,
          role: i === roleSeat ? role : 'villager',
          hasViewedRole: true,
        });
      }

      const actions = new Map<RoleId, RoleAction>();
      if (poisonedSeat !== null) {
        actions.set('witch', makeActionWitch(makeWitchPoison(poisonedSeat)));
      }

      return {
        template: { name: 'test', numberOfPlayers: 12, roles: [] },
        players,
        actions,
        wolfVotes: new Map(),
        currentActionerIndex: 0,
      };
    };

    it('hunter can shoot when NOT poisoned', () => {
      const room = createMockRoom('hunter', 5, null);
      expect(getConfirmRoleCanShoot(room, 'hunter')).toBe(true);
    });

    it('hunter CANNOT shoot when poisoned', () => {
      const room = createMockRoom('hunter', 5, 5); // poisoned at seat 5
      expect(getConfirmRoleCanShoot(room, 'hunter')).toBe(false);
    });

    it('darkWolfKing can shoot when NOT poisoned', () => {
      const room = createMockRoom('darkWolfKing', 3, null);
      expect(getConfirmRoleCanShoot(room, 'darkWolfKing')).toBe(true);
    });

    it('darkWolfKing CANNOT shoot when poisoned', () => {
      const room = createMockRoom('darkWolfKing', 3, 3); // poisoned at seat 3
      expect(getConfirmRoleCanShoot(room, 'darkWolfKing')).toBe(false);
    });

    it('poisoning a different seat does NOT affect the role', () => {
      const room = createMockRoom('hunter', 5, 7); // hunter at 5, poisoned at 7
      expect(getConfirmRoleCanShoot(room, 'hunter')).toBe(true);
    });
  });
});
