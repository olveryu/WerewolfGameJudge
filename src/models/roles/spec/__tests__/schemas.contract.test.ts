/**
 * Action Schemas Contract Tests
 *
 * Validates the SCHEMAS registry for consistency.
 */

import { SCHEMAS, type SchemaId, getAllSchemaIds, isValidSchemaId } from '../index';
import { NIGHT_STEPS } from '../index';

describe('SCHEMAS contract', () => {
  it('should have exactly 14 schemas', () => {
    // seerCheck, witchAction, guardProtect, psychicCheck, dreamcatcherDream,
    // magicianSwap, hunterConfirm, wolfKill, wolfQueenCharm, nightmareBlock,
    // gargoyleCheck, wolfRobotLearn, darkWolfKingConfirm, slackerChooseIdol
    expect(getAllSchemaIds()).toHaveLength(14);
  });

  it('every schema should have required fields', () => {
    for (const [id, schema] of Object.entries(SCHEMAS) as [SchemaId, (typeof SCHEMAS)[SchemaId]][]) {
      expect(schema.id).toBe(id);
      expect(schema.kind).toMatch(/^(chooseSeat|confirm|compound|swap|wolfVote)$/);
    }
  });

  describe('chooseSeat schemas', () => {
    const chooseSeatSchemas: SchemaId[] = [
      'seerCheck',
      'guardProtect',
      'psychicCheck',
      'dreamcatcherDream',
      'wolfQueenCharm',
      'nightmareBlock',
      'gargoyleCheck',
      'wolfRobotLearn',
      'slackerChooseIdol',
    ];

    it('should have correct chooseSeat schemas', () => {
      for (const schemaId of chooseSeatSchemas) {
        expect(SCHEMAS[schemaId].kind).toBe('chooseSeat');
      }
    });

    it('chooseSeat schemas should have constraints', () => {
      for (const schemaId of chooseSeatSchemas) {
        const schema = SCHEMAS[schemaId] as { constraints?: readonly string[] };
        expect(Array.isArray(schema.constraints)).toBe(true);
      }
    });
  });

  describe('confirm schemas', () => {
    const confirmSchemas: SchemaId[] = ['hunterConfirm', 'darkWolfKingConfirm'];

    it('should have correct confirm schemas', () => {
      for (const schemaId of confirmSchemas) {
        expect(SCHEMAS[schemaId].kind).toBe('confirm');
      }
    });
  });

  describe('compound schemas', () => {
    it('witchAction should be compound with steps', () => {
      expect(SCHEMAS.witchAction.kind).toBe('compound');
      expect(Array.isArray(SCHEMAS.witchAction.steps)).toBe(true);
      expect(SCHEMAS.witchAction.steps).toHaveLength(2);
    });
  });

  describe('special schemas', () => {
    it('magicianSwap should have kind=swap', () => {
      expect(SCHEMAS.magicianSwap.kind).toBe('swap');
    });

    it('wolfKill should have kind=wolfVote', () => {
      expect(SCHEMAS.wolfKill.kind).toBe('wolfVote');
    });
  });

  describe('schema references in specs', () => {
    it('every schemaId referenced in NIGHT_STEPS should exist in SCHEMAS', () => {
      for (const step of NIGHT_STEPS) {
        expect(isValidSchemaId(step.schemaId)).toBe(true);
      }
    });

    it('every schema should be referenced by at least one role', () => {
      const referencedSchemaIds = new Set<SchemaId>();
      // Collect referenced schemas from the canonical night steps table.
      for (const step of NIGHT_STEPS) {
        referencedSchemaIds.add(step.schemaId);
      }

      // All 14 schemas should be referenced
      expect(referencedSchemaIds.size).toBe(14);
    });
  });

  describe('helper functions', () => {
    it('isValidSchemaId should return true for valid IDs', () => {
      expect(isValidSchemaId('seerCheck')).toBe(true);
      expect(isValidSchemaId('witchAction')).toBe(true);
      expect(isValidSchemaId('wolfKill')).toBe(true);
    });

    it('isValidSchemaId should return false for invalid IDs', () => {
      expect(isValidSchemaId('unknown-schema')).toBe(false);
      expect(isValidSchemaId('seer-check')).toBe(false); // kebab-case is invalid
    });

    it('getAllSchemaIds should return all schema IDs', () => {
      const ids = getAllSchemaIds();
      expect(ids).toContain('seerCheck');
      expect(ids).toContain('wolfKill');
      expect(ids).toContain('witchAction');
    });
  });
});
