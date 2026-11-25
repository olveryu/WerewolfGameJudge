/**
 * resolveStepProgress — the night progress derivation for games that keep their own step list.
 * Werewolf reads its progress from the engine, which owns the step position.
 */
import { resolveStepProgress } from '../nightProgress';

const STEPS = ['evilReveal', 'merlinReveal', 'percivalReveal'] as const;
const LABELS = {
  evilReveal: '坏人互认',
  merlinReveal: '梅林的视野',
  percivalReveal: '派西维尔的视野',
} as const;

describe('resolveStepProgress', () => {
  it('resolves 1-based progress with the step label', () => {
    expect(resolveStepProgress(STEPS, 'evilReveal', LABELS)).toEqual({
      current: 1,
      total: 3,
      label: '坏人互认',
    });
    expect(resolveStepProgress(STEPS, 'percivalReveal', LABELS)).toEqual({
      current: 3,
      total: 3,
      label: '派西维尔的视野',
    });
  });

  it('returns null for a step outside the list or without a label', () => {
    expect(resolveStepProgress<string>(STEPS, 'unknown', LABELS)).toBeNull();
    expect(resolveStepProgress(STEPS, 'merlinReveal', { evilReveal: '坏人互认' })).toBeNull();
  });
});
