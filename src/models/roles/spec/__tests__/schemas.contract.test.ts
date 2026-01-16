/**
 * Action Schemas Contract Tests
 *
 * Validates the SCHEMAS registry for consistency.
 */

import { SCHEMAS, type SchemaId, getAllSchemaIds, isValidSchemaId } from '../index';
import { NIGHT_STEPS } from '../index';

describe('SCHEMAS contract', () => {
  it('should include at least all NIGHT_STEPS schemas (and may include helper schemas)', () => {
    // NOTE: SCHEMAS may include helper schemas not directly referenced by NIGHT_STEPS
    // (e.g., compound sub-step schemas), but NIGHT_STEPS must remain the authoritative
    // runtime plan.
    const stepSchemaIds = new Set(NIGHT_STEPS.map((s) => s.id));
    const allSchemaIds = getAllSchemaIds();

    for (const stepId of stepSchemaIds) {
      expect(allSchemaIds).toContain(stepId);
    }
    expect(allSchemaIds.length).toBeGreaterThanOrEqual(stepSchemaIds.size);
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
    it('every step.id in NIGHT_STEPS should exist in SCHEMAS', () => {
      // step.id is the schemaId (single field design)
      for (const step of NIGHT_STEPS) {
        expect(isValidSchemaId(step.id)).toBe(true);
      }
    });

    it('every NIGHT_STEPS schema should exist in SCHEMAS', () => {
      const referencedSchemaIds = new Set<SchemaId>();
      for (const step of NIGHT_STEPS) {
        referencedSchemaIds.add(step.id);
      }
      for (const schemaId of referencedSchemaIds) {
        expect(isValidSchemaId(schemaId)).toBe(true);
      }
    });

    it('every NIGHT_STEPS schema should provide schema.ui.prompt (schema-driven UI contract)', () => {
      // Commit 1 gate: RoomScreen prompt text should be primarily schema-driven.
      for (const step of NIGHT_STEPS) {
        const schema = SCHEMAS[step.id];
        expect(schema.ui?.prompt).toBeTruthy();
        expect(typeof schema.ui?.prompt).toBe('string');
      }
    });
  });

  describe('schema.ui contract (RoomScreen orchestration)', () => {
    it('chooseSeat schemas should provide schema.ui.confirmText', () => {
      const missing: string[] = [];
      for (const schema of Object.values(SCHEMAS)) {
        if (schema.kind !== 'chooseSeat') continue;
        if (!schema.ui?.confirmText || typeof schema.ui.confirmText !== 'string') {
          missing.push(schema.id);
        }
      }

      // Helpful error message: list exactly which schemas are missing confirmText.
      expect(missing).toEqual([]);
    });

    it('schema.ui.revealKind is only allowed on chooseSeat schemas', () => {
      const illegal: string[] = [];
      const missingPrompt: string[] = [];
      const missingConfirmText: string[] = [];

      for (const schema of Object.values(SCHEMAS)) {
  if (!schema.ui) continue;
  if (!('revealKind' in schema.ui)) continue;

  const revealKind = schema.ui.revealKind;
        if (!revealKind) continue;

        if (schema.kind !== 'chooseSeat') {
          illegal.push(schema.id);
          continue;
        }

        if (!schema.ui?.prompt || typeof schema.ui.prompt !== 'string') {
          missingPrompt.push(schema.id);
        }

        if (!schema.ui?.confirmText || typeof schema.ui.confirmText !== 'string') {
          missingConfirmText.push(schema.id);
        }
      }

      expect(illegal).toEqual([]);
      expect(missingPrompt).toEqual([]);
      expect(missingConfirmText).toEqual([]);
    });

    it('wolfVote schema should provide schema.ui.emptyVoteText', () => {
      // Commit 1: text is schema-driven even if behavior stays the same for now.
      expect(SCHEMAS.wolfKill.kind).toBe('wolfVote');
      expect(SCHEMAS.wolfKill.ui?.emptyVoteText).toBeTruthy();
    });

    it('schemas that support bottom actions should provide schema.ui.bottomActionText', () => {
      // Commit 2 gate: RoomScreen bottom button text should be schema-driven for canSkip flows.
      for (const schema of Object.values(SCHEMAS)) {
        if (schema.kind === 'chooseSeat' || schema.kind === 'swap') {
          // Note: some schemas may set canSkip=false, but providing text keeps UI consistent.
          expect(schema.ui?.bottomActionText).toBeTruthy();
        }
      }
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
