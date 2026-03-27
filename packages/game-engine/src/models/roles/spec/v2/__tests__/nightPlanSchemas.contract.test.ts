/**
 * V2 Night Plan + Schemas Equivalence Tests
 *
 * Verifies that V2 builders produce output equivalent to V1:
 * - buildNightPlanFromV2() matches buildNightPlan() for all preset templates
 * - buildSchemasFromV2() matches SCHEMAS for key set + actionKind + constraints + canSkip
 */

import {
  buildNightPlan,
  NIGHT_STEPS,
  ROLE_SPECS,
  type RoleId,
  SCHEMAS,
  type SchemaUi,
} from '@werewolf/game-engine/models/roles/spec';
import {
  buildNightPlanFromV2,
  buildSchemasFromV2,
  NIGHT_STEP_ORDER,
  ROLE_SPECS_V2,
} from '@werewolf/game-engine/models/roles/spec/v2';
import { PRESET_TEMPLATES } from '@werewolf/game-engine/models/Template';

// =============================================================================
// Night Plan Equivalence
// =============================================================================

describe('buildNightPlanFromV2 ↔ buildNightPlan equivalence', () => {
  describe.each(PRESET_TEMPLATES)('preset "$name"', ({ roles }) => {
    it('should produce identical step sequence', () => {
      const v1 = buildNightPlan(roles);
      const v2 = buildNightPlanFromV2(roles);

      expect(v2.steps.map((s) => s.stepId)).toEqual(v1.steps.map((s) => s.stepId));
      expect(v2.steps.map((s) => s.roleId)).toEqual(v1.steps.map((s) => s.roleId));
    });

    it('should produce identical step count', () => {
      const v1 = buildNightPlan(roles);
      const v2 = buildNightPlanFromV2(roles);

      expect(v2.length).toBe(v1.length);
    });

    it('should produce identical audioKeys', () => {
      const v1 = buildNightPlan(roles);
      const v2 = buildNightPlanFromV2(roles);

      expect(v2.steps.map((s) => s.audioKey)).toEqual(v1.steps.map((s) => s.audioKey));
    });

    it('should produce contiguous 0..n-1 order', () => {
      const v2 = buildNightPlanFromV2(roles);

      expect(v2.steps.map((s) => s.order)).toEqual(v2.steps.map((_, i) => i));
    });
  });

  it('should produce identical plan for ALL roles', () => {
    const allRoles = Object.keys(ROLE_SPECS) as RoleId[];
    const v1 = buildNightPlan(allRoles);
    const v2 = buildNightPlanFromV2(allRoles);

    expect(v2.steps.map((s) => s.stepId)).toEqual(v1.steps.map((s) => s.stepId));
    expect(v2.steps.map((s) => s.roleId)).toEqual(v1.steps.map((s) => s.roleId));
    expect(v2.steps.map((s) => s.audioKey)).toEqual(v1.steps.map((s) => s.audioKey));
  });

  it('NIGHT_STEP_ORDER should match NIGHT_STEPS order', () => {
    expect(NIGHT_STEP_ORDER).toEqual(NIGHT_STEPS.map((s) => s.id));
  });
});

// =============================================================================
// Schemas Equivalence
// =============================================================================

describe('buildSchemasFromV2 ↔ SCHEMAS equivalence', () => {
  const v2Schemas = buildSchemasFromV2();
  const v1SchemaKeys = Object.keys(SCHEMAS).sort();
  const v2SchemaKeys = Object.keys(v2Schemas).sort();

  it('should produce same schema key set', () => {
    expect(v2SchemaKeys).toEqual(v1SchemaKeys);
  });

  describe.each(v1SchemaKeys)('schema "%s"', (schemaId) => {
    const v1 = SCHEMAS[schemaId as keyof typeof SCHEMAS];

    const v2 = v2Schemas[schemaId]!;

    it('should have same actionKind', () => {
      expect(v2.kind).toBe(v1.kind);
    });

    it('should have same displayName', () => {
      expect(v2.displayName).toBe(v1.displayName);
    });

    if ('constraints' in v1) {
      it('should have same constraints', () => {
        expect('constraints' in v2 ? v2.constraints : []).toEqual(v1.constraints);
      });
    }

    if ('canSkip' in v1) {
      it('should have same canSkip', () => {
        expect('canSkip' in v2 ? v2.canSkip : undefined).toBe(v1.canSkip);
      });
    }

    if ('meeting' in v1) {
      it('should have same meeting config', () => {
        expect('meeting' in v2 ? v2.meeting : undefined).toEqual(v1.meeting);
      });
    }

    if ('requireAllAcks' in v1) {
      it('should have same requireAllAcks', () => {
        expect('requireAllAcks' in v2 ? v2.requireAllAcks : undefined).toBe(v1.requireAllAcks);
      });
    }

    if ('minTargets' in v1) {
      it('should have same minTargets', () => {
        expect('minTargets' in v2 ? v2.minTargets : undefined).toBe(v1.minTargets);
      });
    }

    if ('maxTargets' in v1) {
      it('should have same maxTargets', () => {
        expect('maxTargets' in v2 ? v2.maxTargets : undefined).toBe(v1.maxTargets);
      });
    }

    if (v1.ui) {
      const v1Ui = v1.ui as SchemaUi;

      it('should have matching ui.revealKind', () => {
        expect(v2.ui?.revealKind).toBe(v1Ui.revealKind);
      });

      it('should have matching ui.revealResultFormat', () => {
        expect(v2.ui?.revealResultFormat).toBe(v1Ui.revealResultFormat);
      });

      it('should have matching ui.revealTitlePrefix', () => {
        expect(v2.ui?.revealTitlePrefix).toBe(v1Ui.revealTitlePrefix);
      });

      it('should have matching ui.prompt', () => {
        expect(v2.ui?.prompt).toBe(v1Ui.prompt);
      });

      if (v1Ui.confirmStatusUi) {
        it('should have matching ui.confirmStatusUi', () => {
          expect(v2.ui?.confirmStatusUi).toEqual(v1Ui.confirmStatusUi);
        });
      }
    }

    if (v1.kind === 'compound' && 'steps' in v1) {
      it('should have same compound steps', () => {
        const v2Compound = v2 as typeof v1;
        expect(v2Compound.steps.length).toBe(v1.steps.length);
        v1.steps.forEach((v1Step, idx) => {
          const v2Step = v2Compound.steps[idx];
          expect(v2Step.key).toBe(v1Step.key);
          expect(v2Step.displayName).toBe(v1Step.displayName);
          expect(v2Step.kind).toBe(v1Step.kind);
          expect(v2Step.constraints).toEqual(v1Step.constraints);
          expect(v2Step.canSkip).toBe(v1Step.canSkip);
        });
      });
    }
  });

  it('V2 specs nightSteps should cover all NIGHT_STEPS entries', () => {
    // Every V1 NIGHT_STEPS entry should have a corresponding V2 nightStep
    const v2StepIds = new Set<string>();
    for (const spec of Object.values(ROLE_SPECS_V2)) {
      const roleSpec = spec as { nightSteps?: readonly { stepId: string }[] };
      if (roleSpec.nightSteps) {
        for (const step of roleSpec.nightSteps) {
          v2StepIds.add(step.stepId);
        }
      }
    }

    for (const step of NIGHT_STEPS) {
      expect(v2StepIds.has(step.id)).toBe(true);
    }
  });
});
