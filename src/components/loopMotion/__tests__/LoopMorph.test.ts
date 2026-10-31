import { windowWeight } from '../LoopMorph';

const N = 4;
const weightsAt = (phase: number, mode: 'crossfade' | 'stacked' | 'step') =>
  Array.from({ length: N }, (_, k) => windowWeight(phase, k, N, mode));

describe('LoopMorph windowWeight', () => {
  it('crossfade weights form a partition of unity', () => {
    for (const phase of [0, 0.1, 0.125, 0.3, 0.6, 0.99]) {
      const sum = weightsAt(phase, 'crossfade').reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('stacked keeps the lower variant opaque and fades the upper one', () => {
    // Segment 1 → 2: variant 1 (lower) stays 1, variant 2 fades in.
    expect(weightsAt(0.25, 'stacked')).toEqual([0, 1, 0, 0]);
    expect(weightsAt(0.375, 'stacked')).toEqual([0, 1, 0.5, 0]);
    // Wrap segment 3 → 0: incoming 0 is lower, so it holds 1 and 3 fades out.
    expect(weightsAt(0.75, 'stacked')).toEqual([1, 0, 0, 1]);
    expect(weightsAt(0.875, 'stacked')).toEqual([1, 0, 0, 0.5]);
  });

  it('stacked always has at least one variant at full weight', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(Math.max(...weightsAt(i / 40, 'stacked'))).toBe(1);
    }
  });

  it('step shows exactly one variant', () => {
    expect(weightsAt(0.3, 'step')).toEqual([0, 1, 0, 0]);
    expect(weightsAt(0.99, 'step')).toEqual([0, 0, 0, 1]);
  });
});
