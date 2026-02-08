/**
 * Action Schemas Contract Tests
 *
 * Validates the SCHEMAS registry for consistency.
 */

import {
  SCHEMAS,
  type SchemaId,
  getAllSchemaIds,
  isValidSchemaId,
  BLOCKED_UI_DEFAULTS,
} from '@/models/roles/spec/index';
import { NIGHT_STEPS } from '@/models/roles/spec/index';
import type { CompoundSchema } from '@/models/roles/spec/schema.types';

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
    for (const [id, schema] of Object.entries(SCHEMAS) as [
      SchemaId,
      (typeof SCHEMAS)[SchemaId],
    ][]) {
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

    it('wolfKill.meeting should have correct MeetingConfig (schema-driven wolf visibility)', () => {
      // Contract: UI derives showWolves from schema.meeting.canSeeEachOther
      // This test ensures the meeting config exists and has correct values
      const wolfKill = SCHEMAS.wolfKill;
      expect(wolfKill.meeting).toBeDefined();
      expect(wolfKill.meeting.canSeeEachOther).toBe(true);
      expect(wolfKill.meeting.resolution).toBe('firstVote');
      expect(wolfKill.meeting.allowEmptyVote).toBe(true);
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
    it('chooseSeat/swap/confirm schemas should provide schema.ui.confirmTitle', () => {
      const missing: string[] = [];
      for (const schema of Object.values(SCHEMAS)) {
        if (schema.kind !== 'chooseSeat' && schema.kind !== 'swap' && schema.kind !== 'confirm')
          continue;
        if (!schema.ui?.confirmTitle || typeof schema.ui.confirmTitle !== 'string') {
          missing.push(schema.id);
        }
      }
      missing.sort();
      expect(missing).toEqual([]);
    });

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

    it('schema.ui.revealKind should be present on exactly the reveal-style chooseSeat schemas (anti-drift, derived)', () => {
      // Derivation strategy:
      // - Any schema that declares ui.revealKind is a reveal-schema.
      // - Reveal schemas must have kind=chooseSeat (enforced by other test).
      // - We additionally enforce: revealKind values are unique across schemas.
      // - And every RevealKind value is used exactly once.

      const revealSchemaIds: string[] = [];
      const revealKinds: string[] = [];

      for (const schema of Object.values(SCHEMAS)) {
        if (!schema.ui) continue;
        if (!('revealKind' in schema.ui)) continue;
        if (!schema.ui.revealKind) continue;
        revealSchemaIds.push(schema.id);
        revealKinds.push(schema.ui.revealKind);
      }

      // Keep failures deterministic
      revealSchemaIds.sort();
      revealKinds.sort();

      // If we ever add/remove a reveal kind, this test will force updating the UI schema.
      const expectedRevealKinds = ['gargoyle', 'psychic', 'seer', 'wolfRobot'];
      expect(revealKinds).toEqual(expectedRevealKinds);

      // Assert 1:1 mapping (no two schemas share same revealKind)
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const schema of Object.values(SCHEMAS)) {
        if (!schema.ui) continue;
        if (!('revealKind' in schema.ui)) continue;
        const rk = schema.ui.revealKind;
        if (!rk) continue;
        if (seen.has(rk)) duplicates.push(rk);
        seen.add(rk);
      }
      duplicates.sort();
      expect(duplicates).toEqual([]);

      // This snapshot-like list is intentionally explicit: reveal flow is sensitive.
      // If this changes, reviewers should inspect the UI/reveal ack flow carefully.
      expect(revealSchemaIds).toEqual([
        'gargoyleCheck',
        'psychicCheck',
        'seerCheck',
        'wolfRobotLearn',
      ]);
    });

    it('reveal-style chooseSeat schemas (schema.ui.revealKind) must be skippable (canSkip=true)', () => {
      const notSkippable: string[] = [];

      for (const schema of Object.values(SCHEMAS)) {
        if (!schema.ui) continue;
        if (!('revealKind' in schema.ui)) continue;
        if (!schema.ui.revealKind) continue;

        if (schema.kind !== 'chooseSeat') continue; // enforced elsewhere

        // chooseSeat schemas should always carry canSkip; treat missing/false as not skippable
        const canSkip = (schema as { canSkip?: boolean }).canSkip;
        if (!canSkip) notSkippable.push(schema.id);
      }

      notSkippable.sort();
      expect(notSkippable).toEqual([]);
    });

    it('reveal-style chooseSeat schemas (schema.ui.revealKind) should provide schema.ui.confirmTitle', () => {
      const missing: string[] = [];

      for (const schema of Object.values(SCHEMAS)) {
        if (schema.kind !== 'chooseSeat') continue;
        if (!schema.ui) continue;
        if (!('revealKind' in schema.ui)) continue;
        if (!schema.ui.revealKind) continue;

        if (!schema.ui.confirmTitle || typeof schema.ui.confirmTitle !== 'string') {
          missing.push(schema.id);
        }
      }

      missing.sort();
      expect(missing).toEqual([]);
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

  // =========================================================================
  // BLOCKED_UI_DEFAULTS contract (P2 schema-driven)
  // =========================================================================
  describe('BLOCKED_UI_DEFAULTS contract', () => {
    it('should have all required fields with non-empty string values', () => {
      expect(typeof BLOCKED_UI_DEFAULTS.title).toBe('string');
      expect(BLOCKED_UI_DEFAULTS.title.length).toBeGreaterThan(0);

      expect(typeof BLOCKED_UI_DEFAULTS.message).toBe('string');
      expect(BLOCKED_UI_DEFAULTS.message.length).toBeGreaterThan(0);

      expect(typeof BLOCKED_UI_DEFAULTS.skipButtonText).toBe('string');
      expect(BLOCKED_UI_DEFAULTS.skipButtonText.length).toBeGreaterThan(0);

      expect(typeof BLOCKED_UI_DEFAULTS.dismissButtonText).toBe('string');
      expect(BLOCKED_UI_DEFAULTS.dismissButtonText.length).toBeGreaterThan(0);
    });

    it('should have exactly 4 keys (anti-drift)', () => {
      const keys = Object.keys(BLOCKED_UI_DEFAULTS);
      expect(keys).toHaveLength(4);
      expect(keys).toContain('title');
      expect(keys).toContain('message');
      expect(keys).toContain('skipButtonText');
      expect(keys).toContain('dismissButtonText');
    });

    it('values snapshot (change detection)', () => {
      // If these values change, tests will fail - forcing explicit review
      expect(BLOCKED_UI_DEFAULTS.title).toBe('技能被封锁');
      expect(BLOCKED_UI_DEFAULTS.message).toBe('你被梦魇封锁了，本回合无法行动');
      expect(BLOCKED_UI_DEFAULTS.skipButtonText).toBe('跳过（技能被封锁）');
      expect(BLOCKED_UI_DEFAULTS.dismissButtonText).toBe('知道了');
    });
  });

  // =========================================================================
  // Witch promptTemplate contract (P3 schema-driven)
  // =========================================================================
  describe('witchAction.promptTemplate contract', () => {
    it('witchAction save step should have promptTemplate with {seat} placeholder', () => {
      const witchSchema = SCHEMAS.witchAction as CompoundSchema;
      expect(witchSchema.kind).toBe('compound');

      const saveStep = witchSchema.steps[0];
      expect(saveStep.key).toBe('save');
      expect(saveStep.ui?.promptTemplate).toBeDefined();
      expect(saveStep.ui?.promptTemplate).toContain('{seat}');
    });

    it('witchAction poison step should NOT have promptTemplate (static prompt)', () => {
      const witchSchema = SCHEMAS.witchAction as CompoundSchema;
      const poisonStep = witchSchema.steps[1];
      expect(poisonStep.key).toBe('poison');
      expect(poisonStep.ui?.promptTemplate).toBeUndefined();
    });
  });
});
