import { STANDARD_SIDE_EFFECTS } from '../../../protocol/common';
import { handlerRejection, handlerSuccess } from '../types';

describe('werewolf handler result factories', () => {
  it('default success sideEffects use the platform state-change policy', () => {
    const result = handlerSuccess([]);

    expect(result.kind).toBe('success');
    expect(result.sideEffects).toBe(STANDARD_SIDE_EFFECTS);
    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });

  it('default rejection sideEffects use the platform state-change policy', () => {
    const result = handlerRejection('rejected', []);

    expect(result.kind).toBe('rejection');
    expect(result.sideEffects).toBe(STANDARD_SIDE_EFFECTS);
    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});
