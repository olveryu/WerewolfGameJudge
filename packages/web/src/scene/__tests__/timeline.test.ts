import {
  CSS_EASE_IN_OUT,
  Easing,
  settleMs,
  track,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from '@/scene/timeline';

/**
 * Expected values come from Reanimated 4.3.1's own `springUtils` and `Easing` (the previous
 * client's runtime), stepped frame by frame at 1 ms the way `springOnFrame` runs.
 */
const SAMPLE_MS = [50, 150, 300, 600, 1000, 1500, 2500] as const;

const REANIMATED = {
  /** BounceEnter: `withSpring(0, { damping: 8, stiffness: 180 })` from -0.5. */
  bounce: [
    -0.47304196173883933, -0.2887503408799402, 0.09975356966376196, 0.21425030292504024,
    -0.18229411549717456, 0.10496588237521128, 0.031052778815439504,
  ],
  /** PopEnter: `withSpring(1, { damping: 6, stiffness: 200 })` from 0. */
  pop: [
    0.06033711264410746, 0.47610005850464243, 1.3364385821940896, 1.362046077944748,
    0.6194585978228477, 1.1720631727931696, 0.9704302498470212,
  ],
  /** Epic child scale: `withSpring(1, { dampingRatio: 0.6, duration: 600 })` from 0.7. */
  epic: [0.8157039845251459, 1.0232714437359034, 0.999633479630184, 1.0000812114831688, 1, 1, 1],
};

describe('Reanimated easing', () => {
  it.each([
    ['out(cubic)', Easing.out(Easing.cubic), [0.271, 0.875, 0.999]],
    ['out(back(1.5))', Easing.out(Easing.back(1.5)), [0.3925, 1.0625, 1.0125]],
    ['inOut(quad)', Easing.inOut(Easing.quad), [0.02, 0.5, 0.98]],
  ])('%s matches Reanimated', (_name, easing, expected) => {
    [0.1, 0.5, 0.9].forEach((t, i) => expect(easing(t)).toBeCloseTo(expected[i]!, 10));
  });

  it('solves CSS ease-in-out', () => {
    expect(CSS_EASE_IN_OUT(0)).toBe(0);
    expect(CSS_EASE_IN_OUT(1)).toBe(1);
    expect(CSS_EASE_IN_OUT(0.5)).toBeCloseTo(0.5, 6);
    // cubic-bezier(0.42, 0, 0.58, 1) at x = 0.25 (reference: solved to 1e-9).
    expect(CSS_EASE_IN_OUT(0.25)).toBeCloseTo(0.129161, 5);
    expect(CSS_EASE_IN_OUT(0.75)).toBeCloseTo(1 - 0.129161, 5);
  });
});

describe('withTiming', () => {
  it('defaults to 300 ms of inOut(quad) and holds the target after it', () => {
    const value = track(0, withTiming(1));
    expect(value.at(0)).toBe(0);
    expect(value.at(150)).toBeCloseTo(0.5, 10);
    expect(value.at(30)).toBeCloseTo(0.02, 10);
    expect(value.at(300)).toBe(1);
    expect(value.endMs).toBe(300);
  });

  it('eases between arbitrary values', () => {
    const value = track(0.6, withTiming(0, { duration: 2000, easing: Easing.linear }));
    expect(value.at(500)).toBeCloseTo(0.45, 10);
  });
});

describe('withSpring', () => {
  it.each([
    ['bounce', -0.5, 0, { damping: 8, stiffness: 180 }],
    ['pop', 0, 1, { damping: 6, stiffness: 200 }],
    ['epic', 0.7, 1, { dampingRatio: 0.6, duration: 600 }],
  ] as const)('%s follows Reanimated frame stepping', (name, from, to, config) => {
    const value = track(from, withSpring(to, config));
    SAMPLE_MS.forEach((ms, i) => expect(value.at(ms)).toBeCloseTo(REANIMATED[name][i]!, 9));
  });

  it('snaps to the target where Reanimated stops (energy threshold)', () => {
    const value = track(0.7, withSpring(1, { dampingRatio: 0.6, duration: 600 }));
    // Reanimated finished on the 721st 1 ms frame.
    expect(value.endMs).toBeGreaterThan(720);
    expect(value.endMs).toBeLessThanOrEqual(721);
    expect(value.at(721)).toBe(1);
  });

  it('keeps the light default mass of 4 for physics configs (long wobble)', () => {
    expect(track(0, withSpring(1, { damping: 6, stiffness: 200 })).endMs).toBeGreaterThan(10_000);
  });

  it('finishes at once when already at the target', () => {
    expect(track(1, withSpring(1)).endMs).toBe(0);
  });
});

describe('withDelay and withSequence', () => {
  it('hold the start value, then chain from each finished value', () => {
    const value = track(
      0,
      withDelay(
        100,
        withSequence(
          withTiming(1, { duration: 200, easing: Easing.linear }),
          withTiming(0.5, { duration: 100, easing: Easing.linear }),
        ),
      ),
    );
    expect(value.at(50)).toBe(0);
    expect(value.at(200)).toBeCloseTo(0.5, 10);
    expect(value.at(350)).toBeCloseTo(0.75, 10);
    expect(value.at(400)).toBe(0.5);
    expect(value.endMs).toBe(400);
  });

  it('reports when every track has settled', () => {
    expect(settleMs(track(0), track(0, withTiming(1, { duration: 900 })))).toBe(900);
  });
});
