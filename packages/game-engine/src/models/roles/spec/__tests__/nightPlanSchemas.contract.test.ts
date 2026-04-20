/**
 * Night Plan + Schemas Builder Tests
 *
 * Verifies builder functions produce correct output:
 * - buildNightPlan() produces correct step sequences for preset templates
 * - buildSchemas() matches SCHEMAS registry for key set + actionKind + constraints + canSkip
 */

import {
  buildNightPlan,
  buildSchemas,
  NIGHT_STEP_ORDER,
  NIGHT_STEPS,
  ROLE_SPECS,
  type RoleId,
  SCHEMAS,
  type SchemaUi,
} from '@werewolf/game-engine/models/roles/spec';
import { PRESET_TEMPLATES } from '@werewolf/game-engine/models/Template';

// =============================================================================
// Night Plan Tests
// =============================================================================

describe('buildNightPlan', () => {
  describe.each(PRESET_TEMPLATES)('preset "$name"', ({ roles }) => {
    it('should produce valid step sequence', () => {
      const plan = buildNightPlan(roles);

      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.steps.map((s: { stepId: string }) => s.stepId).length).toBe(plan.length);
    });

    it('should have correct step count', () => {
      const plan = buildNightPlan(roles);

      expect(plan.length).toBe(plan.steps.length);
    });

    it('should produce valid audioKeys', () => {
      const plan = buildNightPlan(roles);

      for (const step of plan.steps) {
        expect(step.audioKey).toBeTruthy();
      }
    });

    it('should produce contiguous 0..n-1 order', () => {
      const plan = buildNightPlan(roles);

      expect(plan.steps.map((s: { order: number }) => s.order)).toEqual(
        plan.steps.map((_: unknown, i: number) => i),
      );
    });
  });

  it('should produce valid plan for ALL roles', () => {
    const allRoles = Object.keys(ROLE_SPECS) as RoleId[];
    const plan = buildNightPlan(allRoles);

    expect(plan.steps.map((s: { stepId: string }) => s.stepId).length).toBeGreaterThan(0);
    expect(plan.steps.map((s: { roleId: string }) => s.roleId).length).toBe(plan.length);
    expect(plan.steps.map((s: { audioKey: string }) => s.audioKey).length).toBe(plan.length);
  });

  it('NIGHT_STEP_ORDER should match NIGHT_STEPS order', () => {
    expect(NIGHT_STEP_ORDER).toEqual(NIGHT_STEPS.map((s: { id: string }) => s.id));
  });
});

// =============================================================================
// Schemas Tests
// =============================================================================

describe('buildSchemas ↔ SCHEMAS equivalence', () => {
  const builtSchemas = buildSchemas();
  const schemaKeys = Object.keys(SCHEMAS).sort();
  const builtSchemaKeys = Object.keys(builtSchemas).sort();

  it('should produce same schema key set', () => {
    expect(builtSchemaKeys).toEqual(schemaKeys);
  });

  describe.each(schemaKeys)('schema "%s"', (schemaId) => {
    const cached = SCHEMAS[schemaId as keyof typeof SCHEMAS];

    const built = builtSchemas[schemaId];

    it('should have same actionKind', () => {
      expect(built.kind).toBe(cached.kind);
    });

    it('should have same displayName', () => {
      expect(built.displayName).toBe(cached.displayName);
    });

    if ('constraints' in cached) {
      it('should have same constraints', () => {
        expect('constraints' in built ? built.constraints : []).toEqual(cached.constraints);
      });
    }

    if ('canSkip' in cached) {
      it('should have same canSkip', () => {
        expect('canSkip' in built ? built.canSkip : undefined).toBe(cached.canSkip);
      });
    }

    if ('meeting' in cached) {
      it('should have same meeting config', () => {
        expect('meeting' in built ? built.meeting : undefined).toEqual(cached.meeting);
      });
    }

    if ('requireAllAcks' in cached) {
      it('should have same requireAllAcks', () => {
        expect('requireAllAcks' in built ? built.requireAllAcks : undefined).toBe(
          cached.requireAllAcks,
        );
      });
    }

    if ('minTargets' in cached) {
      it('should have same minTargets', () => {
        expect('minTargets' in built ? built.minTargets : undefined).toBe(cached.minTargets);
      });
    }

    if ('maxTargets' in cached) {
      it('should have same maxTargets', () => {
        expect('maxTargets' in built ? built.maxTargets : undefined).toBe(cached.maxTargets);
      });
    }

    if (cached.ui) {
      const v1Ui = cached.ui as SchemaUi;

      it('should have matching ui.revealKind', () => {
        expect(built.ui?.revealKind).toBe(v1Ui.revealKind);
      });

      it('should have matching ui.revealResultFormat', () => {
        expect(built.ui?.revealResultFormat).toBe(v1Ui.revealResultFormat);
      });

      it('should have matching ui.revealTitlePrefix', () => {
        expect(built.ui?.revealTitlePrefix).toBe(v1Ui.revealTitlePrefix);
      });

      it('should have matching ui.prompt', () => {
        expect(built.ui?.prompt).toBe(v1Ui.prompt);
      });

      if (v1Ui.confirmStatusUi) {
        it('should have matching ui.confirmStatusUi', () => {
          expect(built.ui?.confirmStatusUi).toEqual(v1Ui.confirmStatusUi);
        });
      }
    }

    if (cached.kind === 'compound' && 'steps' in cached) {
      it('should have same compound steps', () => {
        const builtCompound = built as typeof cached;
        expect(builtCompound.steps.length).toBe(cached.steps.length);
        cached.steps.forEach((cachedStep, idx) => {
          const builtStep = builtCompound.steps[idx];
          expect(builtStep.key).toBe(cachedStep.key);
          expect(builtStep.displayName).toBe(cachedStep.displayName);
          expect(builtStep.kind).toBe(cachedStep.kind);
          expect(builtStep.constraints).toEqual(cachedStep.constraints);
          expect(builtStep.canSkip).toBe(cachedStep.canSkip);
        });
      });
    }
  });

  it('ROLE_SPECS nightSteps should cover all NIGHT_STEPS entries', () => {
    const allStepIds = new Set<string>();
    for (const spec of Object.values(ROLE_SPECS)) {
      const roleSpec = spec as { nightSteps?: readonly { stepId: string }[] };
      if (roleSpec.nightSteps) {
        for (const step of roleSpec.nightSteps) {
          allStepIds.add(step.stepId);
        }
      }
    }

    for (const step of NIGHT_STEPS) {
      expect(allStepIds.has(step.id)).toBe(true);
    }
  });
});
