/**
 * WitchActionCodec Tests
 */

import {
  WITCH_NO_ACTION,
  encodeWitchAction,
  encodeWitchSave,
  encodeWitchPoison,
  encodeWitchNoAction,
  decodeWitchAction,
  isWitchNoAction,
  isWitchSave,
  isWitchPoison,
  getWitchSaveTarget,
  getWitchPoisonTarget,
  parseWitchActionLegacy,
} from '../WitchActionCodec';

describe('WitchActionCodec', () => {
  describe('Constants', () => {
    it('WITCH_NO_ACTION should be -1', () => {
      expect(WITCH_NO_ACTION).toBe(-1);
    });
  });

  describe('encodeWitchAction', () => {
    it('should encode no action as -1', () => {
      expect(encodeWitchAction({ type: 'none' })).toBe(-1);
    });

    it('should encode save seat 0 as 0', () => {
      expect(encodeWitchAction({ type: 'save', target: 0 })).toBe(0);
    });

    it('should encode save seat 5 as 5', () => {
      expect(encodeWitchAction({ type: 'save', target: 5 })).toBe(5);
    });

    it('should encode poison seat 0 as -2', () => {
      expect(encodeWitchAction({ type: 'poison', target: 0 })).toBe(-2);
    });

    it('should encode poison seat 1 as -3', () => {
      expect(encodeWitchAction({ type: 'poison', target: 1 })).toBe(-3);
    });

    it('should encode poison seat 5 as -7', () => {
      expect(encodeWitchAction({ type: 'poison', target: 5 })).toBe(-7);
    });

    it('should throw for save without target', () => {
      expect(() => encodeWitchAction({ type: 'save' })).toThrow();
    });

    it('should throw for poison without target', () => {
      expect(() => encodeWitchAction({ type: 'poison' })).toThrow();
    });
  });

  describe('encodeWitchSave', () => {
    it('should encode save for seat 0', () => {
      expect(encodeWitchSave(0)).toBe(0);
    });

    it('should encode save for seat 11', () => {
      expect(encodeWitchSave(11)).toBe(11);
    });
  });

  describe('encodeWitchPoison', () => {
    it('should encode poison for seat 0', () => {
      expect(encodeWitchPoison(0)).toBe(-2);
    });

    it('should encode poison for seat 1', () => {
      expect(encodeWitchPoison(1)).toBe(-3);
    });

    it('should encode poison for seat 11', () => {
      expect(encodeWitchPoison(11)).toBe(-13);
    });
  });

  describe('encodeWitchNoAction', () => {
    it('should return -1', () => {
      expect(encodeWitchNoAction()).toBe(-1);
    });
  });

  describe('decodeWitchAction', () => {
    it('should decode undefined as no action', () => {
      expect(decodeWitchAction(undefined)).toEqual({ type: 'none' });
    });

    it('should decode -1 as no action', () => {
      expect(decodeWitchAction(-1)).toEqual({ type: 'none' });
    });

    it('should decode 0 as save seat 0', () => {
      expect(decodeWitchAction(0)).toEqual({ type: 'save', target: 0 });
    });

    it('should decode 5 as save seat 5', () => {
      expect(decodeWitchAction(5)).toEqual({ type: 'save', target: 5 });
    });

    it('should decode -2 as poison seat 0', () => {
      expect(decodeWitchAction(-2)).toEqual({ type: 'poison', target: 0 });
    });

    it('should decode -3 as poison seat 1', () => {
      expect(decodeWitchAction(-3)).toEqual({ type: 'poison', target: 1 });
    });

    it('should decode -7 as poison seat 5', () => {
      expect(decodeWitchAction(-7)).toEqual({ type: 'poison', target: 5 });
    });
  });

  describe('Roundtrip encoding/decoding', () => {
    it('no action roundtrip', () => {
      const original = { type: 'none' as const };
      const encoded = encodeWitchAction(original);
      const decoded = decodeWitchAction(encoded);
      expect(decoded).toEqual(original);
    });

    it('save roundtrip for all seats 0-11', () => {
      for (let seat = 0; seat < 12; seat++) {
        const original = { type: 'save' as const, target: seat };
        const encoded = encodeWitchAction(original);
        const decoded = decodeWitchAction(encoded);
        expect(decoded).toEqual(original);
      }
    });

    it('poison roundtrip for all seats 0-11', () => {
      for (let seat = 0; seat < 12; seat++) {
        const original = { type: 'poison' as const, target: seat };
        const encoded = encodeWitchAction(original);
        const decoded = decodeWitchAction(encoded);
        expect(decoded).toEqual(original);
      }
    });
  });

  describe('isWitchNoAction', () => {
    it('should return true for undefined', () => {
      expect(isWitchNoAction(undefined)).toBe(true);
    });

    it('should return true for -1', () => {
      expect(isWitchNoAction(-1)).toBe(true);
    });

    it('should return false for save action', () => {
      expect(isWitchNoAction(0)).toBe(false);
    });

    it('should return false for poison action', () => {
      expect(isWitchNoAction(-2)).toBe(false);
    });
  });

  describe('isWitchSave', () => {
    it('should return false for undefined', () => {
      expect(isWitchSave(undefined)).toBe(false);
    });

    it('should return false for no action', () => {
      expect(isWitchSave(-1)).toBe(false);
    });

    it('should return true for save action', () => {
      expect(isWitchSave(0)).toBe(true);
      expect(isWitchSave(5)).toBe(true);
    });

    it('should return false for poison action', () => {
      expect(isWitchSave(-2)).toBe(false);
    });
  });

  describe('isWitchPoison', () => {
    it('should return false for undefined', () => {
      expect(isWitchPoison(undefined)).toBe(false);
    });

    it('should return false for no action', () => {
      expect(isWitchPoison(-1)).toBe(false);
    });

    it('should return false for save action', () => {
      expect(isWitchPoison(0)).toBe(false);
    });

    it('should return true for poison action', () => {
      expect(isWitchPoison(-2)).toBe(true);
      expect(isWitchPoison(-7)).toBe(true);
    });
  });

  describe('getWitchSaveTarget', () => {
    it('should return undefined for no action', () => {
      expect(getWitchSaveTarget(-1)).toBeUndefined();
    });

    it('should return seat for save action', () => {
      expect(getWitchSaveTarget(0)).toBe(0);
      expect(getWitchSaveTarget(5)).toBe(5);
    });

    it('should return undefined for poison action', () => {
      expect(getWitchSaveTarget(-2)).toBeUndefined();
    });
  });

  describe('getWitchPoisonTarget', () => {
    it('should return undefined for no action', () => {
      expect(getWitchPoisonTarget(-1)).toBeUndefined();
    });

    it('should return undefined for save action', () => {
      expect(getWitchPoisonTarget(0)).toBeUndefined();
    });

    it('should return seat for poison action', () => {
      expect(getWitchPoisonTarget(-2)).toBe(0);
      expect(getWitchPoisonTarget(-3)).toBe(1);
      expect(getWitchPoisonTarget(-7)).toBe(5);
    });
  });

  describe('parseWitchActionLegacy', () => {
    it('should parse undefined as no action', () => {
      expect(parseWitchActionLegacy(undefined)).toEqual({
        killedByWitch: null,
        savedByWitch: null,
      });
    });

    it('should parse -1 as no action', () => {
      expect(parseWitchActionLegacy(-1)).toEqual({
        killedByWitch: null,
        savedByWitch: null,
      });
    });

    it('should parse save action', () => {
      expect(parseWitchActionLegacy(0)).toEqual({
        killedByWitch: null,
        savedByWitch: 0,
      });
      expect(parseWitchActionLegacy(5)).toEqual({
        killedByWitch: null,
        savedByWitch: 5,
      });
    });

    it('should parse poison action', () => {
      expect(parseWitchActionLegacy(-2)).toEqual({
        killedByWitch: 0,
        savedByWitch: null,
      });
      expect(parseWitchActionLegacy(-7)).toEqual({
        killedByWitch: 5,
        savedByWitch: null,
      });
    });
  });
});
