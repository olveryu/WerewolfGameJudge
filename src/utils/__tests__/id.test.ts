/**
 * Tests for ID generation utilities
 */

import { newRejectionId, newRequestId, randomHex } from '@/utils/id';

describe('ID utilities', () => {
  describe('randomHex', () => {
    it('should return hex string of requested length', () => {
      const hex8 = randomHex(8);
      expect(hex8).toMatch(/^[0-9a-f]{8}$/);
      expect(hex8.length).toBe(8);

      const hex16 = randomHex(16);
      expect(hex16).toMatch(/^[0-9a-f]{16}$/);
      expect(hex16.length).toBe(16);
    });

    it('should generate unique values (no Math.random)', () => {
      const values = new Set<string>();
      for (let i = 0; i < 100; i++) {
        values.add(randomHex(8));
      }
      expect(values.size).toBe(100);
    });
  });

  describe('newRequestId', () => {
    it('should return a non-empty string', () => {
      const id = newRequestId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs (100 calls should produce 100 unique values)', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(newRequestId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('newRejectionId', () => {
    it('should return a non-empty string', () => {
      const id = newRejectionId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs (100 calls should produce 100 unique values)', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(newRejectionId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
