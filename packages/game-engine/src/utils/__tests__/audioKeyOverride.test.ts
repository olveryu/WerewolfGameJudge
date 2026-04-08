/**
 * audioKeyOverride Unit Tests
 *
 * Covers: resolveSeerAudioKey
 */

import { resolveSeerAudioKey } from '../audioKeyOverride';

describe('resolveSeerAudioKey', () => {
  it('should return original audioKey when seerLabelMap is undefined', () => {
    expect(resolveSeerAudioKey('seer')).toBe('seer');
    expect(resolveSeerAudioKey('mirrorSeer')).toBe('mirrorSeer');
  });

  it('should return seer_N when audioKey has a label in the map', () => {
    const labelMap = { seer: 1, mirrorSeer: 2 } as const;
    expect(resolveSeerAudioKey('seer', labelMap)).toBe('seer_1');
    expect(resolveSeerAudioKey('mirrorSeer', labelMap)).toBe('seer_2');
  });

  it('should return original audioKey when key is not in seerLabelMap', () => {
    const labelMap = { seer: 1 } as const;
    expect(resolveSeerAudioKey('guard', labelMap)).toBe('guard');
    expect(resolveSeerAudioKey('witch', labelMap)).toBe('witch');
  });

  it('should handle label value of 0 correctly', () => {
    // label 0 is falsy but should still produce seer_0
    const labelMap = { seer: 0 } as const;
    expect(resolveSeerAudioKey('seer', labelMap)).toBe('seer_0');
  });
});
