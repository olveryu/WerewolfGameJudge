/**
 * Night Plan Contract Tests
 *
 * Validates the buildNightPlan function and NightPlan structure.
 */

import { buildNightPlan, type NightPlanStep, ROLE_SPECS, type RoleId } from '../index';

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
    it('should order steps by night1.order', () => {
      const plan = buildNightPlan(['seer', 'witch', 'guard']);
      // guard=3, witch=10, seer=15
      expect(plan.steps.map((s: NightPlanStep) => s.roleId)).toEqual(['guard', 'witch', 'seer']);
    });

    it('should handle magician order=-2 (first)', () => {
      const plan = buildNightPlan(['seer', 'magician']);
      expect(plan.steps[0].roleId).toBe('magician');
    });

    it('should handle slacker order=-1 (second after magician)', () => {
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

      // Expected order: guard(3), wolf(5) - only once, wolfQueen(6), witch(10), seer(15), hunter(20)
      const roleOrder = plan.steps.map((s: NightPlanStep) => s.roleId);

      // guard < wolf < wolfQueen < witch < seer < hunter
      const guardIdx = roleOrder.indexOf('guard');
      const wolfIdx = roleOrder.indexOf('wolf');
      const wolfQueenIdx = roleOrder.indexOf('wolfQueen');
      const witchIdx = roleOrder.indexOf('witch');
      const seerIdx = roleOrder.indexOf('seer');
      const hunterIdx = roleOrder.indexOf('hunter');

      expect(guardIdx).toBeLessThan(wolfIdx);
      expect(wolfIdx).toBeLessThan(wolfQueenIdx);
      expect(wolfQueenIdx).toBeLessThan(witchIdx);
      expect(witchIdx).toBeLessThan(seerIdx);
      expect(seerIdx).toBeLessThan(hunterIdx);
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
      for (const step of plan.steps) {
        expect(step.roleId).toBeTruthy();
        expect(step.schemaId).toBeTruthy();
        expect(typeof step.order).toBe('number');
      }
    });

    it('seer step should have correct properties', () => {
      const plan = buildNightPlan(['seer']);
      const seerStep = plan.steps[0];
      expect(seerStep.roleId).toBe('seer');
      expect(seerStep.schemaId).toBe('seerCheck');
      expect(seerStep.order).toBe(15);
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

  describe('night1 order values from specs', () => {
    const expectedOrders: Partial<Record<RoleId, number>> = {
      magician: -2,
      slacker: -1,
      wolfRobot: 0,
      dreamcatcher: 1,
      gargoyle: 1,
      nightmare: 2,
      guard: 3,
      wolf: 5,
      wolfQueen: 6,
      witch: 10,
      seer: 15,
      psychic: 16,
      hunter: 20,
      darkWolfKing: 25,
    };

    for (const [roleId, expectedOrder] of Object.entries(expectedOrders)) {
      it(`${roleId} should have order=${expectedOrder}`, () => {
        const spec = ROLE_SPECS[roleId as RoleId];
        if (spec.night1.hasAction) {
          expect(spec.night1.order).toBe(expectedOrder);
        }
      });
    }
  });
});
