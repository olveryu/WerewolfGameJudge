/**
 * shared handler utilities — pure function tests
 *
 * isValidSeat / resultToStatus 不依赖 DO，可直接测试。
 */

import { describe, expect, it } from 'vitest';

import { isValidSeat, resultToStatus } from '../handlers/shared';

describe('isValidSeat', () => {
  it('accepts 0', () => {
    expect(isValidSeat(0)).toBe(true);
  });

  it('accepts positive integers', () => {
    expect(isValidSeat(5)).toBe(true);
    expect(isValidSeat(11)).toBe(true);
  });

  it('rejects negative numbers', () => {
    expect(isValidSeat(-1)).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(isValidSeat(1.5)).toBe(false);
    expect(isValidSeat(NaN)).toBe(false);
    expect(isValidSeat(Infinity)).toBe(false);
  });

  it('rejects non-numbers', () => {
    expect(isValidSeat('0')).toBe(false);
    expect(isValidSeat(null)).toBe(false);
    expect(isValidSeat(undefined)).toBe(false);
  });
});

describe('resultToStatus', () => {
  it('returns 200 for success', () => {
    expect(resultToStatus({ success: true })).toBe(200);
  });

  it('returns 500 for INTERNAL_ERROR', () => {
    expect(resultToStatus({ success: false, reason: 'INTERNAL_ERROR' })).toBe(500);
  });

  it('returns 400 for other failures', () => {
    expect(resultToStatus({ success: false, reason: 'INVALID_STATE' })).toBe(400);
    expect(resultToStatus({ success: false })).toBe(400);
  });
});
