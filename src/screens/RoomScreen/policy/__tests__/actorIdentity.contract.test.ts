/**
 * actorIdentity.contract.test.ts - Contract tests for actor identity single source of truth
 *
 * These tests lock the behavior of getActorIdentity to ensure:
 * 1. When not delegating (controlledSeat=null): actorSeatForUi = mySeat
 * 2. When delegating (controlledSeat=botSeat): actorSeatForUi = botSeat
 * 3. isDelegating flag is correctly set
 * 4. No default value fallbacks - null in = null out
 */

import { getActorIdentity, isActorIdentityValid } from '../actorIdentity';

describe('getActorIdentity contract', () => {
  describe('when NOT delegating (controlledSeat=null)', () => {
    it('returns mySeat/myRole as actor identity', () => {
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
    it('returns bot seat/role as actor identity', () => {
      const result = getActorIdentity({
        mySeatNumber: 0, // Host's real seat
        myRole: 'wolf',
        effectiveSeat: 5, // Bot seat being controlled
        effectiveRole: 'seer', // Bot's role
        controlledSeat: 5,
      });

      expect(result.actorSeatForUi).toBe(5);
      expect(result.actorRoleForUi).toBe('seer');
      expect(result.isDelegating).toBe(true);
    });

    it('isDelegating is true even if effectiveSeat is same as mySeat', () => {
      // Edge case: controlling the seat you're actually sitting on (shouldn't happen but test the flag)
      const result = getActorIdentity({
        mySeatNumber: 3,
        myRole: 'wolf',
        effectiveSeat: 3,
        effectiveRole: 'wolf',
        controlledSeat: 3, // Controlling same seat (weird but valid)
      });

      expect(result.isDelegating).toBe(true);
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
});
