/**
 * WitchAction Tests
 */

import {
  getWitchPoisonTarget,
  getWitchSaveTarget,
  isWitchNone,
  isWitchPoison,
  isWitchSave,
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
  WitchAction,
} from '@/models/actions/WitchAction';

describe('WitchAction', () => {
  describe('Factory Functions', () => {
    it('makeWitchNone creates none action', () => {
      const action = makeWitchNone();
      expect(action).toEqual({ kind: 'none' });
    });

    it('makeWitchSave creates save action with target', () => {
      const action = makeWitchSave(5);
      expect(action).toEqual({ kind: 'save', targetSeat: 5 });
    });

    it('makeWitchPoison creates poison action with target', () => {
      const action = makeWitchPoison(3);
      expect(action).toEqual({ kind: 'poison', targetSeat: 3 });
    });

    it('makeWitchSave works for seat 0', () => {
      const action = makeWitchSave(0);
      expect(action).toEqual({ kind: 'save', targetSeat: 0 });
    });

    it('makeWitchPoison works for seat 0', () => {
      const action = makeWitchPoison(0);
      expect(action).toEqual({ kind: 'poison', targetSeat: 0 });
    });
  });

  describe('Type Guards', () => {
    it('isWitchNone returns true for none action', () => {
      expect(isWitchNone(makeWitchNone())).toBe(true);
      expect(isWitchNone(makeWitchSave(0))).toBe(false);
      expect(isWitchNone(makeWitchPoison(0))).toBe(false);
    });

    it('isWitchSave returns true for save action', () => {
      expect(isWitchSave(makeWitchNone())).toBe(false);
      expect(isWitchSave(makeWitchSave(0))).toBe(true);
      expect(isWitchSave(makeWitchPoison(0))).toBe(false);
    });

    it('isWitchPoison returns true for poison action', () => {
      expect(isWitchPoison(makeWitchNone())).toBe(false);
      expect(isWitchPoison(makeWitchSave(0))).toBe(false);
      expect(isWitchPoison(makeWitchPoison(0))).toBe(true);
    });
  });

  describe('Accessors', () => {
    it('getWitchSaveTarget returns target for save action', () => {
      expect(getWitchSaveTarget(makeWitchSave(5))).toBe(5);
      expect(getWitchSaveTarget(makeWitchSave(0))).toBe(0);
    });

    it('getWitchSaveTarget returns undefined for non-save actions', () => {
      expect(getWitchSaveTarget(makeWitchNone())).toBeUndefined();
      expect(getWitchSaveTarget(makeWitchPoison(5))).toBeUndefined();
    });

    it('getWitchPoisonTarget returns target for poison action', () => {
      expect(getWitchPoisonTarget(makeWitchPoison(5))).toBe(5);
      expect(getWitchPoisonTarget(makeWitchPoison(0))).toBe(0);
    });

    it('getWitchPoisonTarget returns undefined for non-poison actions', () => {
      expect(getWitchPoisonTarget(makeWitchNone())).toBeUndefined();
      expect(getWitchPoisonTarget(makeWitchSave(5))).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    it('discriminated union allows type narrowing', () => {
      const actions: WitchAction[] = [makeWitchNone(), makeWitchSave(5), makeWitchPoison(3)];

      for (const action of actions) {
        if (action.kind === 'save') {
          expect(action.targetSeat).toBe(5);
        } else if (action.kind === 'poison') {
          expect(action.targetSeat).toBe(3);
        } else {
          expect(action.kind).toBe('none');
        }
      }
    });
  });
});
