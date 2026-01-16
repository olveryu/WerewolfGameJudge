import { getAllSchemaIds, getSchema } from '../../../models/roles/spec/schemas';

/**
 * Minimal UI coverage contract for all schemas.
 *
 * Goal:
 * - Every schema must at least have a smoke assertion that its UI copy is present/valid
 *   (hardcore A: no fallback).
 * - This is NOT a full RoomScreen integration test for every role.
 */

describe('RoomScreen schema ui coverage (contract)', () => {
  it('all schemas have required UI fields for RoomScreen rendering', () => {
    const ids = getAllSchemaIds();

    for (const id of ids) {
      const schema = getSchema(id);

      if (schema.kind === 'compound') {
        // Compound schema doesn't go through the normal confirm flow.
        // It must have prompt and stepSchemaIds.
        expect(typeof schema.ui?.prompt).toBe('string');
        expect(schema.ui?.prompt.length).toBeGreaterThan(0);
        expect(Array.isArray(schema.steps)).toBe(true);
        expect(schema.steps.length).toBeGreaterThan(0);
        for (const step of schema.steps) {
          // Ensure steps reference valid schema IDs.
          expect(typeof step.stepSchemaId).toBe('string');
          expect(step.stepSchemaId.length).toBeGreaterThan(0);
        }
        continue;
      }

      // All non-compound schemas must not rely on fallback UI.
      // (RoomScreen/useRoomActions will fail-fast if confirmText is missing.)
      expect(schema.ui).toBeDefined();
      expect(typeof schema.ui.prompt).toBe('string');
      expect(schema.ui.prompt.length).toBeGreaterThan(0);
      expect(typeof schema.ui.confirmText).toBe('string');
      expect(schema.ui.confirmText.length).toBeGreaterThan(0);

      // chooseSeat/swap schemas should have bottom action text (skip button).
      if (schema.kind === 'chooseSeat' || schema.kind === 'swap') {
        expect(typeof (schema as any).ui.bottomActionText).toBe('string');
        expect((schema as any).ui.bottomActionText.length).toBeGreaterThan(0);
      }

      // Display name should be stable, non-empty.
      expect(typeof schema.displayName).toBe('string');
      expect(schema.displayName.length).toBeGreaterThan(0);
    }
  });
});
