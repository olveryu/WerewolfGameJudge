import { calculateBackoff } from '../backoff';

describe('calculateBackoff', () => {
  // Use fixed random for deterministic tests
  const fixedRandom = (v: number) => () => v;

  it('returns baseMs * jitter at attempt 0', () => {
    // exponential = 1000 * 2^0 = 1000, capped = 1000
    // jitter with random=1 → 1000 * (0.5 + 1 * 0.5) = 1000
    expect(calculateBackoff(0, 1000, 30_000, fixedRandom(1))).toBe(1000);
  });

  it('applies exponential growth by attempt', () => {
    // attempt=3 → 1000 * 2^3 = 8000, random=1 → 8000 * 1.0 = 8000
    expect(calculateBackoff(3, 1000, 30_000, fixedRandom(1))).toBe(8000);
  });

  it('caps at maxMs', () => {
    // attempt=20 → 1000 * 2^20 = 1,048,576,000, capped = 30000
    // random=1 → 30000 * 1.0 = 30000
    expect(calculateBackoff(20, 1000, 30_000, fixedRandom(1))).toBe(30_000);
  });

  it('applies full jitter with random=0 → lower bound (50%)', () => {
    // attempt=2 → 1000 * 2^2 = 4000
    // random=0 → 4000 * (0.5 + 0 * 0.5) = 4000 * 0.5 = 2000
    expect(calculateBackoff(2, 1000, 30_000, fixedRandom(0))).toBe(2000);
  });

  it('applies full jitter with random=0.5 → midpoint (75%)', () => {
    // attempt=2 → 4000
    // random=0.5 → 4000 * (0.5 + 0.5 * 0.5) = 4000 * 0.75 = 3000
    expect(calculateBackoff(2, 1000, 30_000, fixedRandom(0.5))).toBe(3000);
  });

  it('rounds to integer', () => {
    // attempt=1 → 2000, random=0.3 → 2000 * (0.5 + 0.3*0.5) = 2000 * 0.65 = 1300
    expect(calculateBackoff(1, 1000, 30_000, fixedRandom(0.3))).toBe(1300);
  });

  it('uses default parameters when not provided', () => {
    const result = calculateBackoff(0);
    // base=1000, max=30000, jitter range: [500, 1000]
    expect(result).toBeGreaterThanOrEqual(500);
    expect(result).toBeLessThanOrEqual(1000);
  });

  it('handles attempt=0 with custom base', () => {
    // exponential = 500 * 2^0 = 500, random=1 → 500
    expect(calculateBackoff(0, 500, 30_000, fixedRandom(1))).toBe(500);
  });
});
