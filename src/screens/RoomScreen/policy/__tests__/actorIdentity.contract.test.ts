/**
 * actorIdentity.contract.test.ts - Contract tests for actor identity single source of truth
 *
 * These tests lock the behavior of getActorIdentity to ensure:
 * 1. When not delegating (controlledSeat=null): actorSeatForUi = mySeatNumber, actorRoleForUi = myRole
 * 2. When delegating (controlledSeat=botSeat): actorSeatForUi = effectiveSeat, actorRoleForUi = effectiveRole
 * 3. Consistency check: when delegating, effectiveSeat MUST equal controlledSeat (fail-fast)
 * 4. isDelegating flag is correctly set
 * 5. No default value fallbacks - null in = null out
 */

import { getActorIdentity, isActorIdentityValid } from '@/screens/RoomScreen/policy/actorIdentity';

describe('getActorIdentity contract', () => {
  describe('when NOT delegating (controlledSeat=null)', () => {
    it('returns mySeatNumber/myRole as actor identity (NOT effectiveSeat/effectiveRole)', () => {
      const result = getActorIdentity({
        mySeatNumber: 3,
        myRole: 'seer',
        effectiveSeat: 3, // = mySeatNumber when not controlling
        effectiveRole: 'seer',
        controlledSeat: null,
      });

      expect(result.actorSeatForUi).toBe(3);
      expect(result.actorRoleForUi).toBe('seer');
      expect(result.isDelegating).toBe(false);
    });

    it('uses mySeatNumber even if effectiveSeat differs (edge case prevention)', () => {
      // This shouldn't happen in practice, but tests that we use mySeat not effective
      const result = getActorIdentity({
        mySeatNumber: 3,
        myRole: 'seer',
        effectiveSeat: 5, // Inconsistent with mySeat - should be ignored when not delegating
        effectiveRole: 'wolf',
        controlledSeat: null,
      });

      expect(result.actorSeatForUi).toBe(3); // Uses mySeatNumber
      expect(result.actorRoleForUi).toBe('seer'); // Uses myRole
      expect(result.isDelegating).toBe(false);
    });

    it('returns null actor identity when not seated', () => {
      const result = getActorIdentity({
        mySeatNumber: null,
        myRole: null,
        effectiveSeat: null,
        effectiveRole: null,
        controlledSeat: null,
      });

      expect(result.actorSeatForUi).toBeNull();
      expect(result.actorRoleForUi).toBeNull();
      expect(result.isDelegating).toBe(false);
    });
  });

  describe('when delegating (controlledSeat=botSeat)', () => {
    it('returns effectiveSeat/effectiveRole as actor identity when consistent', () => {
      const result = getActorIdentity({
        mySeatNumber: 0, // Host's real seat
        myRole: 'wolf',
        effectiveSeat: 5, // Bot seat being controlled
        effectiveRole: 'seer', // Bot's role
        controlledSeat: 5, // Matches effectiveSeat
      });

      expect(result.actorSeatForUi).toBe(5);
      expect(result.actorRoleForUi).toBe('seer');
      expect(result.isDelegating).toBe(true);
    });

    it('FAIL-FAST: returns null identity when effectiveSeat !== controlledSeat (drift prevention)', () => {
      // This tests the consistency check - if effectiveSeat doesn't match controlledSeat,
      // something is wrong and we should fail-fast (return invalid identity)
      const result = getActorIdentity({
        mySeatNumber: 0,
        myRole: 'wolf',
        effectiveSeat: 3, // WRONG - should be 5
        effectiveRole: 'hunter',
        controlledSeat: 5, // Expects seat 5
      });

      expect(result.actorSeatForUi).toBeNull();
      expect(result.actorRoleForUi).toBeNull();
      expect(result.isDelegating).toBe(true); // Still delegating, just invalid
      expect(isActorIdentityValid(result)).toBe(false);
    });

    it('isDelegating is true when controlling same seat as mySeat (edge case)', () => {
      // Edge case: controlling the seat you're actually sitting on
      const result = getActorIdentity({
        mySeatNumber: 3,
        myRole: 'wolf',
        effectiveSeat: 3,
        effectiveRole: 'wolf',
        controlledSeat: 3, // Controlling same seat
      });

      expect(result.actorSeatForUi).toBe(3);
      expect(result.actorRoleForUi).toBe('wolf');
      expect(result.isDelegating).toBe(true); // Flag is based on controlledSeat !== null
    });
  });

  describe('isActorIdentityValid', () => {
    it('returns true when both seat and role are valid', () => {
      const identity = getActorIdentity({
        mySeatNumber: 0,
        myRole: 'wolf',
        effectiveSeat: 0,
        effectiveRole: 'wolf',
        controlledSeat: null,
      });

      expect(isActorIdentityValid(identity)).toBe(true);
    });

    it('returns false when seat is null', () => {
      const identity = getActorIdentity({
        mySeatNumber: null,
        myRole: null,
        effectiveSeat: null,
        effectiveRole: null,
        controlledSeat: null,
      });

      expect(isActorIdentityValid(identity)).toBe(false);
    });

    it('returns false when role is null', () => {
      const identity = getActorIdentity({
        mySeatNumber: 0,
        myRole: null,
        effectiveSeat: 0,
        effectiveRole: null,
        controlledSeat: null,
      });

      expect(isActorIdentityValid(identity)).toBe(false);
    });

    it('returns false for inconsistent delegation state', () => {
      const identity = getActorIdentity({
        mySeatNumber: 0,
        myRole: 'wolf',
        effectiveSeat: 3, // Mismatches controlledSeat
        effectiveRole: 'seer',
        controlledSeat: 5,
      });

      expect(isActorIdentityValid(identity)).toBe(false);
    });
  });
});

describe('actor identity integration with policy context', () => {
  it('controlledSeat switch changes actor identity for UI decisions', () => {
    // Simulate Host (seat 0, wolf) not controlling any bot
    const notControlling = getActorIdentity({
      mySeatNumber: 0,
      myRole: 'wolf',
      effectiveSeat: 0,
      effectiveRole: 'wolf',
      controlledSeat: null,
    });

    expect(notControlling.actorSeatForUi).toBe(0);
    expect(notControlling.actorRoleForUi).toBe('wolf');
    expect(notControlling.isDelegating).toBe(false);

    // Now Host takes over bot at seat 5 (seer)
    const controllingBot = getActorIdentity({
      mySeatNumber: 0,
      myRole: 'wolf',
      effectiveSeat: 5,
      effectiveRole: 'seer',
      controlledSeat: 5,
    });

    expect(controllingBot.actorSeatForUi).toBe(5);
    expect(controllingBot.actorRoleForUi).toBe('seer');
    expect(controllingBot.isDelegating).toBe(true);
  });

  it('releasing control reverts to real identity', () => {
    // Host releases control - back to real identity
    const released = getActorIdentity({
      mySeatNumber: 0,
      myRole: 'wolf',
      effectiveSeat: 0, // Back to mySeat
      effectiveRole: 'wolf',
      controlledSeat: null, // No longer controlling
    });

    expect(released.actorSeatForUi).toBe(0);
    expect(released.actorRoleForUi).toBe('wolf');
    expect(released.isDelegating).toBe(false);
  });
});
