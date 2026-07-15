import { rollGoldenDraws, rollNormalDraws } from '../earnings';

describe('draw ticket earnings', () => {
  it.each([
    [0, 1],
    [0.299_999, 1],
    [0.3, 2],
    [0.65, 3],
    [0.85, 4],
    [0.95, 5],
  ])('maps normal draw RNG value %s to %s draws', (rngValue, expected) => {
    expect(rollNormalDraws(() => rngValue)).toBe(expected);
  });

  it.each([
    [0, 1],
    [0.349_999, 1],
    [0.35, 2],
    [0.7, 3],
    [0.88, 4],
    [0.96, 5],
  ])('maps golden draw RNG value %s to %s draws', (rngValue, expected) => {
    expect(rollGoldenDraws(() => rngValue)).toBe(expected);
  });

  it('fails fast when an injected RNG violates its contract', () => {
    expect(() => rollNormalDraws(() => 1)).toThrow('[FAIL-FAST]');
    expect(() => rollGoldenDraws(() => Number.NaN)).toThrow('[FAIL-FAST]');
  });
});
