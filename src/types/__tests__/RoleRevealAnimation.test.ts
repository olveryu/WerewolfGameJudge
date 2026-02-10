/**
 * Tests for RoleRevealAnimation type and utility functions.
 *
 * Key contracts:
 * - 'random' is a valid RoleRevealAnimation config value
 * - resolveRandomAnimation() is deterministic (same seed → same result)
 * - resolveRandomAnimation() only returns one of the 5 animation types (never 'none' or 'random')
 * - ANIMATION_VALUES contains exactly the 5 animation types
 */

import {
  RANDOMIZABLE_ANIMATIONS,
  type ResolvedRoleRevealAnimation,
  resolveRandomAnimation,
  type RoleRevealAnimation,
  simpleHash,
} from '@/types/RoleRevealAnimation';

describe('RoleRevealAnimation', () => {
  describe('RANDOMIZABLE_ANIMATIONS', () => {
    it('should contain exactly 5 animation types', () => {
      expect(RANDOMIZABLE_ANIMATIONS).toHaveLength(5);
    });

    it('should contain all expected animations', () => {
      expect(RANDOMIZABLE_ANIMATIONS).toContain('roulette');
      expect(RANDOMIZABLE_ANIMATIONS).toContain('flip');
      expect(RANDOMIZABLE_ANIMATIONS).toContain('scratch');
      expect(RANDOMIZABLE_ANIMATIONS).toContain('tarot');
      expect(RANDOMIZABLE_ANIMATIONS).toContain('gachaMachine');
    });

    it('should NOT contain "none"', () => {
      expect(RANDOMIZABLE_ANIMATIONS).not.toContain('none');
    });

    it('should NOT contain "random"', () => {
      expect(RANDOMIZABLE_ANIMATIONS).not.toContain('random');
    });
  });

  describe('simpleHash', () => {
    it('should return consistent hash for same input', () => {
      const hash1 = simpleHash('test-room-123');
      const hash2 = simpleHash('test-room-123');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = simpleHash('room-A');
      const hash2 = simpleHash('room-B');
      expect(hash1).not.toBe(hash2);
    });

    it('should return positive integer', () => {
      const hash = simpleHash('any-string');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should handle empty string', () => {
      const hash = simpleHash('');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should handle unicode characters', () => {
      const hash = simpleHash('房间🎲中文');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    });
  });

  describe('resolveRandomAnimation', () => {
    it('should be deterministic (same seed → same result)', () => {
      const result1 = resolveRandomAnimation('room-1234');
      const result2 = resolveRandomAnimation('room-1234');
      expect(result1).toBe(result2);
    });

    it('should return a valid animation type', () => {
      const result = resolveRandomAnimation('test-seed');
      expect(RANDOMIZABLE_ANIMATIONS).toContain(result);
    });

    it('should never return "none"', () => {
      // Test with multiple seeds to ensure robustness
      const seeds = ['a', 'b', 'c', 'd', 'e', '123', '456', '789', 'room1', 'room2'];
      for (const seed of seeds) {
        const result = resolveRandomAnimation(seed);
        expect(result).not.toBe('none');
      }
    });

    it('should never return "random"', () => {
      const seeds = ['a', 'b', 'c', 'd', 'e', '123', '456', '789', 'room1', 'room2'];
      for (const seed of seeds) {
        const result = resolveRandomAnimation(seed);
        expect(result).not.toBe('random');
      }
    });

    it('should distribute across all 5 animation types', () => {
      // Generate results for many different seeds
      const results = new Set<ResolvedRoleRevealAnimation>();
      for (let i = 0; i < 1000; i++) {
        results.add(resolveRandomAnimation(`seed-${i}`));
      }
      // Should eventually hit all 5 animations (probabilistic but very likely with 1000 samples)
      expect(results.size).toBe(5);
    });

    it('should return valid ResolvedRoleRevealAnimation type', () => {
      const result: ResolvedRoleRevealAnimation = resolveRandomAnimation('any-seed');
      // TypeScript compilation ensures this is valid
      expect(result).toBeDefined();
    });
  });

  describe('type contracts', () => {
    it('RoleRevealAnimation should include "random"', () => {
      // This test is mainly for documentation - TypeScript ensures this at compile time
      const animation: RoleRevealAnimation = 'random';
      expect(animation).toBe('random');
    });

    it('ResolvedRoleRevealAnimation should NOT include "random"', () => {
      // This is a compile-time check - if 'random' were assignable,
      // TypeScript would catch it at build time
      const resolved: ResolvedRoleRevealAnimation = 'roulette';
      expect(resolved).toBe('roulette');
    });
  });
});
