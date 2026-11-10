/**
 * Contract tests for resolveEquippedRevealEffect.
 *
 * Verifies:
 * - 'random' resolves deterministically via roomCode + userId
 * - null/undefined → null (no animation)
 * - Valid effect IDs pass through
 * - Invalid IDs → null (fail-safe, no silent wrong animation)
 * - All canonical ROLE_REVEAL_EFFECT_IDS are accepted
 */

import { ROLE_REVEAL_EFFECT_IDS } from '@game-judge/game-engine/product/rewards';

import { resolveEquippedRevealEffect } from '../resolveEquippedRevealEffect';

describe('resolveEquippedRevealEffect', () => {
  it('returns null for null/undefined equipped effect', () => {
    expect(resolveEquippedRevealEffect(null, 'ROOM1', 'user1')).toBeNull();
    expect(resolveEquippedRevealEffect(undefined, 'ROOM1', 'user1')).toBeNull();
  });

  it('resolves "random" deterministically from roomCode + userId', () => {
    const first = resolveEquippedRevealEffect('random', 'ROOM1', 'user1');
    const second = resolveEquippedRevealEffect('random', 'ROOM1', 'user1');
    expect(first).toBe(second);
    expect(first).not.toBeNull();
    // Different user → potentially different result, but still valid
    const other = resolveEquippedRevealEffect('random', 'ROOM1', 'user2');
    expect(other === null || (ROLE_REVEAL_EFFECT_IDS as readonly string[]).includes(other)).toBe(
      true,
    );
  });

  it('passes through valid effect IDs', () => {
    expect(resolveEquippedRevealEffect('tarot', 'ROOM1', 'user1')).toBe('tarot');
    expect(resolveEquippedRevealEffect('scratch', 'ROOM1', 'user1')).toBe('scratch');
  });

  it('returns null for invalid effect IDs (fail-safe)', () => {
    expect(resolveEquippedRevealEffect('nonexistent', 'ROOM1', 'user1')).toBeNull();
    expect(resolveEquippedRevealEffect('', 'ROOM1', 'user1')).toBeNull();
  });

  it('accepts all canonical ROLE_REVEAL_EFFECT_IDS', () => {
    for (const id of ROLE_REVEAL_EFFECT_IDS) {
      expect(resolveEquippedRevealEffect(id, 'ROOM1', 'user1')).toBe(id);
    }
  });
});
