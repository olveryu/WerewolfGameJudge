/**
 * Tests for ID generation utilities
 */

import { newRequestId, newRejectionId } from '../id';

describe('ID utilities', () => {
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
