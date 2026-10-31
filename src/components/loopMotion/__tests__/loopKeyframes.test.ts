import {
  createLoopRuleCache,
  loopAnimationProps,
  type LoopFrame,
  unwrapDegrees,
} from '../loopKeyframes';

interface Dot {
  x: number;
  opacity: number;
}

const identityFrames = (samples: readonly Dot[]) => ({
  frames: samples.map(
    (d): LoopFrame => ({
      translateX: d.x,
      translateY: 0,
      rotateDeg: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: d.opacity,
    }),
  ),
  layout: { count: samples.length },
});

/** A wave translated by one full period per loop: `sample(1)` differs from `sample(0)`. */
const travelling = (t: number, size: number): Dot => ({ x: t * size, opacity: 1 });

describe('createLoopRuleCache', () => {
  it('samples 15/s with a floor of 24 and puts sample(1) at 100%', () => {
    const getRule = createLoopRuleCache(identityFrames);
    const { rule, layout } = getRule(travelling, 100, 4000);

    // 4000 ms / (1000/15) = 60 intervals → 61 samples including t = 1
    expect(layout.count).toBe(61);
    const keyframes = rule.cssRules;
    expect(keyframes['0%']?.transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ translateX: 0 })]),
    );
    expect(keyframes['100%']?.transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ translateX: 100 })]),
    );

    const short = getRule(travelling, 100, 300);
    expect(short.layout.count).toBe(25);
  });

  it('shares one rule per (sampler, size, duration) and splits on any of them', () => {
    const getRule = createLoopRuleCache(identityFrames);
    const a = getRule(travelling, 80, 2000);
    expect(getRule(travelling, 80, 2000).rule).toBe(a.rule);
    expect(getRule(travelling, 81, 2000).rule).not.toBe(a.rule);
    // Sub-device-pixel differences (jest PixelRatio = 2 → 0.5 px grid) share the rule.
    expect(getRule(travelling, 80.1, 2000).rule).toBe(a.rule);
    expect(getRule(travelling, 80.4, 2000).rule).not.toBe(a.rule);
    expect(getRule(travelling, 80, 2001).rule).not.toBe(a.rule);
    const other = (t: number, size: number): Dot => travelling(t, size);
    expect(getRule(other, 80, 2000).rule).not.toBe(a.rule);
  });

  it('rejects non-positive durations and sizes', () => {
    const getRule = createLoopRuleCache(identityFrames);
    expect(() => getRule(travelling, 80, 0)).toThrow('Loop duration must be positive');
    expect(() => getRule(travelling, 0, 2000)).toThrow('Loop size must be positive');
  });
});

describe('loopAnimationProps', () => {
  it('turns phase into a negative delay on an infinite linear loop', () => {
    const { rule } = createLoopRuleCache(identityFrames)(travelling, 80, 2000);
    expect(loopAnimationProps(rule, 2000, 0.25)).toEqual({
      animationName: rule,
      animationDuration: 2000,
      animationDelay: -500,
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
    });
  });
});

describe('unwrapDegrees', () => {
  it('keeps consecutive angles within 180° of each other across the ±180° seam', () => {
    expect(unwrapDegrees([170, 179, -179, -170, -90])).toEqual([170, 179, 181, 190, 270]);
    expect(unwrapDegrees([-170, -179, 179, 170])).toEqual([-170, -179, -181, -190]);
  });

  it('carries the previous angle through undefined (zero-length) frames', () => {
    expect(unwrapDegrees([null, 90, null, null, 100])).toEqual([90, 90, 90, 90, 100]);
  });

  it('rejects a sequence with no defined angle', () => {
    expect(() => unwrapDegrees([null, null])).toThrow('at least one defined angle');
  });
});
