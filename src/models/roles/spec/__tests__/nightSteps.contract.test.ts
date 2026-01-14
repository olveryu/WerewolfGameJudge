/**
 * Night Steps Contract Tests
 * 
 * Validates NIGHT_STEPS as the single source of truth for night action order.
 */

import { NIGHT_STEPS, getAllStepIds, getStepSpec, getStepsByRole } from '../nightSteps';
import { ROLE_SPECS, isValidRoleId } from '../specs';
import type { RoleSpec } from '../spec.types';
import { isValidSchemaId } from '../schemas';

describe('NIGHT_STEPS contract', () => {
  describe('uniqueness', () => {
    it('stepId should be unique', () => {
      const stepIds = NIGHT_STEPS.map(s => s.id);
      const uniqueIds = new Set(stepIds);
      expect(uniqueIds.size).toBe(stepIds.length);
    });

    it('array order should be stable (snapshot)', () => {
      const stepIds = getAllStepIds();
      expect(stepIds).toMatchSnapshot();
    });
  });

  describe('reference validity', () => {
    it('every roleId should be a valid RoleId', () => {
      for (const step of NIGHT_STEPS) {
        expect(isValidRoleId(step.roleId)).toBe(true);
      }
    });

    it('every schemaId should be a valid SchemaId', () => {
      for (const step of NIGHT_STEPS) {
        expect(isValidSchemaId(step.schemaId)).toBe(true);
      }
    });

    it('stepId should equal schemaId (strong constraint)', () => {
      for (const step of NIGHT_STEPS) {
        expect(step.id).toBe(step.schemaId);
      }
    });

    it('audioKey should be non-empty', () => {
      for (const step of NIGHT_STEPS) {
        expect(step.audioKey).toBeTruthy();
      }
    });
  });

  describe('Night-1-only red line', () => {
    it('should NOT contain cross-night fields', () => {
      for (const step of NIGHT_STEPS) {
        // TypeScript 层已禁止，这里做运行时断言
        const stepAny = step as unknown as Record<string, unknown>;
        expect(stepAny.previousNight).toBeUndefined();
        expect(stepAny.lastNight).toBeUndefined();
        expect(stepAny.night2).toBeUndefined();
      }
    });
  });

  describe('alignment with ROLE_SPECS', () => {
    it('every step.roleId must have hasAction=true in ROLE_SPECS', () => {
      for (const step of NIGHT_STEPS) {
        const roleSpec = ROLE_SPECS[step.roleId];
        expect(roleSpec.night1.hasAction).toBe(true);
      }
    });

    it('every role with hasAction=true should appear exactly once in NIGHT_STEPS', () => {
      const rolesWithAction = Object.entries(ROLE_SPECS)
        .filter(([_, spec]) => spec.night1.hasAction)
        .map(([id]) => id);

      const rolesInSteps = NIGHT_STEPS.map(s => s.roleId);

      // Each role with action should appear exactly once
      for (const roleId of rolesWithAction) {
        const count = rolesInSteps.filter(r => r === roleId).length;
        expect(count).toBe(1);
      }

      // No extra roles in NIGHT_STEPS
      expect(rolesInSteps.length).toBe(rolesWithAction.length);
    });
  });

  describe('visibility contract', () => {
    it('every step should have visibility defined', () => {
      for (const step of NIGHT_STEPS) {
        expect(step.visibility).toBeDefined();
        expect(typeof step.visibility.actsSolo).toBe('boolean');
      }
    });

    it('actsSolo=true should not have wolfMeetingPhase=true', () => {
      for (const step of NIGHT_STEPS) {
        if (step.visibility.actsSolo) {
          expect(step.visibility.wolfMeetingPhase).not.toBe(true);
        }
      }
    });

    it('wolf meeting steps should be derived from NIGHT_STEPS (snapshot)', () => {
      const wolfMeetingStepIds = NIGHT_STEPS
        .filter(s => s.visibility.wolfMeetingPhase === true)
        .map(s => s.id);
      expect(wolfMeetingStepIds).toMatchSnapshot();
    });

    it('wolfMeetingPhase=true must align with ROLE_SPECS wolfMeeting participants', () => {
      const wolfMeetingSteps = NIGHT_STEPS.filter(s => s.visibility.wolfMeetingPhase === true);
      for (const step of wolfMeetingSteps) {
  const spec = ROLE_SPECS[step.roleId] as RoleSpec;
        expect(spec.wolfMeeting?.canSeeWolves).toBe(true);
        expect(spec.wolfMeeting?.participatesInWolfVote).toBe(true);
      }
    });

    it('nightmare should have actsSolo=true (独立恐惧阶段)', () => {
      const step = getStepSpec('nightmareBlock');
      expect(step?.visibility.actsSolo).toBe(true);
    });
  });

  describe('helper functions', () => {
    it('getStepSpec should return correct step', () => {
      const seerStep = getStepSpec('seerCheck');
      expect(seerStep?.roleId).toBe('seer');
    });

    it('getStepSpec should return undefined for invalid stepId', () => {
      expect(getStepSpec('invalid')).toBeUndefined();
    });

    it('getStepsByRole should return steps for a role', () => {
      const wolfSteps = getStepsByRole('wolf');
      expect(wolfSteps).toHaveLength(1);
      expect(wolfSteps[0].id).toBe('wolfKill');
    });

    it('getAllStepIds should return all stepIds in order', () => {
      const stepIds = getAllStepIds();
      expect(stepIds.length).toBe(NIGHT_STEPS.length);
      expect(stepIds[0]).toBe('magicianSwap');
    });
  });
});
