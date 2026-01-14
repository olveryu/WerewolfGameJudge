/**
 * Night Plan Contract Tests
 *
 * Validates the buildNightPlan function and NightPlan structure.
 */

import { buildNightPlan, type NightPlanStep, ROLE_SPECS, type RoleId, NIGHT_STEPS } from '../index';

describe('buildNightPlan', () => {
  describe('basic functionality', () => {
    it('should return empty plan for no roles', () => {
      const plan = buildNightPlan([]);
      expect(plan.steps).toHaveLength(0);
    });

    it('should return empty plan for roles with no night-1 actions', () => {
      const plan = buildNightPlan(['villager', 'idiot', 'knight']);
      expect(plan.steps).toHaveLength(0);
    });

    it('should build plan with single role', () => {
      const plan = buildNightPlan(['seer']);
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].roleId).toBe('seer');
    });
  });

  describe('ordering', () => {
    it('should order steps by NIGHT_STEPS sequence (single source of truth)', () => {
      const plan = buildNightPlan(['seer', 'witch', 'guard']);
      // NIGHT_STEPS order defines guard -> witch -> seer
      expect(plan.steps.map((s: NightPlanStep) => s.roleId)).toEqual(['guard', 'witch', 'seer']);
    });

  it('should handle magician before seer when both present', () => {
      const plan = buildNightPlan(['seer', 'magician']);
      expect(plan.steps[0].roleId).toBe('magician');
    });

  it('should handle slacker after magician when both present', () => {
      const plan = buildNightPlan(['magician', 'slacker', 'seer']);
      expect(plan.steps.map((s: NightPlanStep) => s.roleId)).toEqual(['magician', 'slacker', 'seer']);
    });

    it('should produce correct order for full standard 12-player game', () => {
      const roles: RoleId[] = [
        'seer', 'witch', 'hunter', 'guard',
        'wolf', 'wolf', 'wolf', 'wolfQueen',
        'villager', 'villager', 'villager', 'villager',
      ];
      const plan = buildNightPlan(roles);

      // Expected sequence is derived from NIGHT_STEPS for roles present.
      expect(plan.steps.map((s: NightPlanStep) => s.roleId)).toEqual([
        'guard',
        'wolf',
        'wolfQueen',
        'witch',
        'seer',
        'hunter',
      ]);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate multiple wolves', () => {
      const plan = buildNightPlan(['wolf', 'wolf', 'wolf']);
      const wolfSteps = plan.steps.filter((s: NightPlanStep) => s.roleId === 'wolf');
      expect(wolfSteps).toHaveLength(1);
    });

    it('should not deduplicate different roles', () => {
      const plan = buildNightPlan(['seer', 'witch']);
      expect(plan.steps).toHaveLength(2);
    });
  });

  describe('fail-fast validation', () => {
    it('should throw on invalid roleId', () => {
      expect(() => buildNightPlan(['seer', 'invalidRole' as RoleId])).toThrow(
        /Invalid roleIds.*invalidRole/
      );
    });

    it('should throw on celebrity (which is not a valid roleId)', () => {
      expect(() => buildNightPlan(['celebrity' as RoleId])).toThrow(
        /Invalid roleIds.*celebrity/
      );
    });
  });

  describe('step properties', () => {
    it('each step should have roleId, schemaId, and order', () => {
      const plan = buildNightPlan(['seer', 'witch', 'guard']);
      for (const [idx, step] of plan.steps.entries()) {
        expect(step.roleId).toBeTruthy();
        expect(step.schemaId).toBeTruthy();
        expect(typeof step.order).toBe('number');
        expect(step.order).toBe(idx);
      }
    });

    it('order should be a contiguous 0..n-1 sequence (plan-local index semantics)', () => {
      const plan = buildNightPlan(['seer', 'witch', 'guard']);
      expect(plan.steps.map(s => s.order)).toEqual([0, 1, 2]);
    });

    it('seer step should have correct properties', () => {
      const plan = buildNightPlan(['seer']);
      const seerStep = plan.steps[0];
      expect(seerStep.roleId).toBe('seer');
      expect(seerStep.schemaId).toBe('seerCheck');
  expect(seerStep.order).toBe(0);
    });
  });

  describe('actsSolo handling', () => {
    it('nightmare step should have actsSolo=true', () => {
      const plan = buildNightPlan(['nightmare']);
      const nightmareStep = plan.steps.find((s: NightPlanStep) => s.roleId === 'nightmare');
      expect(nightmareStep?.actsSolo).toBe(true);
    });

    it('wolf step should not have actsSolo=true', () => {
      const plan = buildNightPlan(['wolf']);
      const wolfStep = plan.steps.find((s: NightPlanStep) => s.roleId === 'wolf');
      expect(wolfStep?.actsSolo).toBeFalsy();
    });
  });

  describe('NIGHT_STEPS alignment', () => {
    it('orders steps based on table index for a full plan input', () => {
      const plan = buildNightPlan(Object.keys(ROLE_SPECS));
      expect(plan.steps.map(s => s.roleId)).toEqual(NIGHT_STEPS.map(s => s.roleId));
      expect(plan.steps.map(s => s.schemaId)).toEqual(NIGHT_STEPS.map(s => s.id));
    });

    it('audioKey should stay aligned with ROLE_SPECS UX audioKey (transition contract)', () => {
      for (const step of NIGHT_STEPS) {
        expect(ROLE_SPECS[step.roleId].ux.audioKey).toBe(step.audioKey);
      }
    });
  });
});
