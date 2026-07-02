import { STANDARD_SIDE_EFFECTS } from '../../../protocol/common';
import { engineRejection, engineSuccess } from '../types';

describe('engine result factories', () => {
  it('default success sideEffects use the platform state-change policy', () => {
    const result = engineSuccess([{ type: 'NOOP' }]);

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.sideEffects).toBe(STANDARD_SIDE_EFFECTS);
      expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
      expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
    }
  });

  it('default rejection sideEffects use the platform state-change policy', () => {
    const result = engineRejection('rejected', [{ type: 'MARK_REJECTED' }]);

    expect(result.kind).toBe('rejection');
    if (result.kind === 'rejection') {
      expect(result.sideEffects).toBe(STANDARD_SIDE_EFFECTS);
      expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
      expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
    }
  });

  it('explicit empty sideEffects remain effect-free', () => {
    const result = engineSuccess([], []);

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.sideEffects).toEqual([]);
    }
  });
});
