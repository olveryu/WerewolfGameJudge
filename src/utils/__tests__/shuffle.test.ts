/**
 * Tests for Fisher-Yates shuffle utility
 */

import type { Rng } from '@/utils/random';
import { shuffleArray } from '@/utils/shuffle';

describe('shuffleArray', () => {
  it('returns a new array, does not mutate original', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    const result = shuffleArray(original);
    expect(original).toEqual(copy); // original untouched
    expect(result).not.toBe(original); // different reference
  });

  it('returns empty array for empty input', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    expect(shuffleArray([42])).toEqual([42]);
  });

  it('contains same elements after shuffle', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const result = shuffleArray(input);
    expect(result).toHaveLength(input.length);
    expect(result.sort()).toEqual([...input].sort());
  });

  it('uses deterministic rng for predictable output', () => {
    // Fixed sequence: 0.1, 0.9, 0.5, 0.3, 0.7
    const values = [0.1, 0.9, 0.5, 0.3, 0.7];
    let idx = 0;
    const fixedRng: Rng = () => values[idx++ % values.length];

    const result1 = shuffleArray([1, 2, 3, 4, 5], fixedRng);
    idx = 0;
    const result2 = shuffleArray([1, 2, 3, 4, 5], fixedRng);

    expect(result1).toEqual(result2);
  });

  it('works with non-number types', () => {
    const input = ['a', 'b', 'c'];
    const result = shuffleArray(input);
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });
});
