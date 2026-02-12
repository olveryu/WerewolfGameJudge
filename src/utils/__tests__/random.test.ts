/**
 * Tests for secure random utilities
 */

import { randomBool, randomIntInclusive, Rng, secureRng } from '@/utils/random';

describe('randomIntInclusive', () => {
  it('should return min when range is single value', () => {
    const result = randomIntInclusive(1, 1);
    expect(result).toBe(1);
  });

  it('should return min when rng returns 0', () => {
    const fixedRng: Rng = () => 0;
    const result = randomIntInclusive(1, 10, fixedRng);
    expect(result).toBe(1);
  });

  it('should return max when rng returns value close to 1', () => {
    // 0.999... should give max value
    const fixedRng: Rng = () => 0.9999;
    const result = randomIntInclusive(1, 10, fixedRng);
    expect(result).toBe(10);
  });

  it('should return values in range with default rng', () => {
    for (let i = 0; i < 100; i++) {
      const result = randomIntInclusive(5, 15);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(15);
    }
  });

  it('should handle negative ranges', () => {
    const fixedRng: Rng = () => 0.5;
    const result = randomIntInclusive(-10, -5, fixedRng);
    expect(result).toBeGreaterThanOrEqual(-10);
    expect(result).toBeLessThanOrEqual(-5);
  });
});

describe('randomBool', () => {
  it('should return true when rng < 0.5', () => {
    const fixedRng: Rng = () => 0.3;
    expect(randomBool(fixedRng)).toBe(true);
  });

  it('should return false when rng >= 0.5', () => {
    const fixedRng: Rng = () => 0.5;
    expect(randomBool(fixedRng)).toBe(false);
  });

  it('should return true when rng is 0', () => {
    const fixedRng: Rng = () => 0;
    expect(randomBool(fixedRng)).toBe(true);
  });

  it('should return false when rng is close to 1', () => {
    const fixedRng: Rng = () => 0.9999;
    expect(randomBool(fixedRng)).toBe(false);
  });

  it('should produce both values with default rng over many iterations', () => {
    const results = new Set<boolean>();
    for (let i = 0; i < 100; i++) {
      results.add(randomBool());
    }
    // Should have both true and false
    expect(results.size).toBe(2);
  });
});

describe('secureRng', () => {
  it('should return values in [0, 1) range', () => {
    for (let i = 0; i < 100; i++) {
      const value = secureRng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should produce variety of values', () => {
    const values = new Set<number>();
    for (let i = 0; i < 50; i++) {
      values.add(secureRng());
    }
    // Should have many unique values
    expect(values.size).toBeGreaterThan(40);
  });
});
