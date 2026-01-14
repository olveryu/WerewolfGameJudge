/**
 * Role Specs Contract Tests
 * 
 * Validates the ROLE_SPECS registry against the authoritative requirements.
 */

import { ROLE_SPECS, type RoleId, getRoleSpec, isValidRoleId, getAllRoleIds, NIGHT_STEPS } from '../index';
import { SCHEMAS } from '../schemas';
import { Faction } from '../types';
import type { RoleSpec } from '../spec.types';

describe('ROLE_SPECS contract', () => {
  it('should have exactly 22 roles', () => {
    expect(getAllRoleIds()).toHaveLength(22);
  });

  it('every role should have required fields', () => {
    for (const [id, spec] of Object.entries(ROLE_SPECS) as [RoleId, RoleSpec][]) {
      expect(spec.id).toBe(id);
      expect(spec.displayName).toBeTruthy();
      expect(spec.faction).toBeDefined();
      expect(spec.team).toMatch(/^(wolf|good|third)$/);
      expect(spec.night1).toBeDefined();
      expect(spec.ux).toBeDefined();
    }
  });

  it('roles with hasAction=true should appear exactly once in NIGHT_STEPS', () => {
    const rolesWithAction = getAllRoleIds().filter((id: RoleId) => ROLE_SPECS[id].night1.hasAction);
    const rolesInSteps = NIGHT_STEPS.map(s => s.roleId);

    for (const roleId of rolesWithAction) {
      const count = rolesInSteps.filter(r => r === roleId).length;
      expect(count).toBe(1);
    }
  });

  describe('witch spec', () => {
    it('witch save action should have notSelf constraint in schema', () => {
      // Night-1-only: 女巫不能自救规则定义在 schema.witchAction.save.constraints
      // 不再使用 flags.canSaveSelf，避免双写
      const witchSchema = SCHEMAS.witchAction;
      expect(witchSchema.kind).toBe('compound');
      if (witchSchema.kind === 'compound') {
        const saveStep = witchSchema.steps.find((s: { stepId: string }) => s.stepId === 'save');
        expect(saveStep?.constraints).toContain('notSelf');
      }
    });
  });

  describe('spiritKnight spec', () => {
    it('should have wolfMeeting with canSeeWolves=true and participatesInWolfVote=true', () => {
      expect(ROLE_SPECS.spiritKnight.wolfMeeting?.canSeeWolves).toBe(true);
      expect(ROLE_SPECS.spiritKnight.wolfMeeting?.participatesInWolfVote).toBe(true);
    });

    it('should have immuneToNightDamage=true', () => {
      expect(ROLE_SPECS.spiritKnight.flags?.immuneToNightDamage).toBe(true);
    });
  });

  describe('gargoyle and wolfRobot specs', () => {
    it('gargoyle should not see wolves and not participate in vote', () => {
      expect(ROLE_SPECS.gargoyle.wolfMeeting?.canSeeWolves).toBe(false);
      expect(ROLE_SPECS.gargoyle.wolfMeeting?.participatesInWolfVote).toBe(false);
    });

    it('wolfRobot should not see wolves and not participate in vote', () => {
      expect(ROLE_SPECS.wolfRobot.wolfMeeting?.canSeeWolves).toBe(false);
      expect(ROLE_SPECS.wolfRobot.wolfMeeting?.participatesInWolfVote).toBe(false);
    });
  });

  describe('dreamcatcher spec', () => {
    it('dreamcatcher step should use audioKey "dreamcatcher" in NIGHT_STEPS', () => {
      const step = NIGHT_STEPS.find(s => s.roleId === 'dreamcatcher');
      expect(step?.audioKey).toBe('dreamcatcher');
    });

    it('should NOT have a "celebrity" key in ROLE_SPECS', () => {
      expect(isValidRoleId('celebrity')).toBe(false);
    });
  });

  describe('nightmare spec', () => {
    it('nightmare step should have actsSolo=true (from NIGHT_STEPS visibility)', () => {
      const step = NIGHT_STEPS.find(s => s.roleId === 'nightmare');
      expect(step?.visibility.actsSolo).toBe(true);
    });

    it('should participate in wolf meeting (canSeeWolves=true, participatesInWolfVote=true)', () => {
      expect(ROLE_SPECS.nightmare.wolfMeeting?.canSeeWolves).toBe(true);
      expect(ROLE_SPECS.nightmare.wolfMeeting?.participatesInWolfVote).toBe(true);
    });

    it('nightmare should come before wolf in NIGHT_STEPS', () => {
      const roleOrder = NIGHT_STEPS.map(s => s.roleId);
      expect(roleOrder.indexOf('nightmare')).toBeLessThan(roleOrder.indexOf('wolf'));
    });
  });

  describe('night-1 action roles', () => {
    const expectedNight1Roles: RoleId[] = [
      'magician',      // -2
      'slacker',       // -1
      'wolfRobot',     // 0
      'dreamcatcher',  // 1
      'gargoyle',      // 1
      'nightmare',     // 2
      'guard',         // 3
      'wolf',          // 5
      'wolfQueen',     // 6
      'witch',         // 10
      'seer',          // 15
      'psychic',       // 16
      'hunter',        // 20
      'darkWolfKing',  // 25
    ];

    it('should have correct night-1 action roles', () => {
      const actualNight1Roles = getAllRoleIds().filter((id: RoleId) => ROLE_SPECS[id].night1.hasAction);
      const sortedActual = [...actualNight1Roles].sort((a, b) => a.localeCompare(b));
      const sortedExpected = [...expectedNight1Roles].sort((a, b) => a.localeCompare(b));
      expect(sortedActual).toEqual(sortedExpected);
    });
  });

  describe('no night-1 action roles', () => {
    const expectedNoActionRoles: RoleId[] = [
      'villager',
      'idiot',
      'knight',
      'witcher',
      'graveyardKeeper',
      'wolfKing',
      'bloodMoon',
      'spiritKnight',
    ];

    it('should have correct no-action roles', () => {
      const actualNoActionRoles = getAllRoleIds().filter((id: RoleId) => !ROLE_SPECS[id].night1.hasAction);
      const sortedActual = [...actualNoActionRoles].sort((a, b) => a.localeCompare(b));
      const sortedExpected = [...expectedNoActionRoles].sort((a, b) => a.localeCompare(b));
      expect(sortedActual).toEqual(sortedExpected);
    });

    it('graveyardKeeper should have hasAction=false (no info on night-1)', () => {
      expect(ROLE_SPECS.graveyardKeeper.night1.hasAction).toBe(false);
    });

    it('witcher should have hasAction=false (starts from night-2)', () => {
      expect(ROLE_SPECS.witcher.night1.hasAction).toBe(false);
    });
  });

  describe('wolf meeting configuration', () => {
    const wolfPackMembers: RoleId[] = [
      'wolf',
      'wolfQueen',
      'wolfKing',
      'darkWolfKing',
      'nightmare',
      'bloodMoon',
      'spiritKnight',
    ];

    const loneWolves: RoleId[] = [
      'gargoyle',
      'wolfRobot',
    ];

    it('wolf pack members should see wolves and participate in vote', () => {
      for (const roleId of wolfPackMembers) {
        const spec = ROLE_SPECS[roleId] as RoleSpec;
        expect(spec.wolfMeeting?.canSeeWolves).toBe(true);
        expect(spec.wolfMeeting?.participatesInWolfVote).toBe(true);
      }
    });

    it('lone wolves should not see wolves and not participate in vote', () => {
      for (const roleId of loneWolves) {
        const spec = ROLE_SPECS[roleId] as RoleSpec;
        expect(spec.wolfMeeting?.canSeeWolves).toBe(false);
        expect(spec.wolfMeeting?.participatesInWolfVote).toBe(false);
      }
    });
  });

  describe('seer check rule (team field)', () => {
    it('all wolf-faction roles should have team="wolf"', () => {
      const wolfRoles = getAllRoleIds().filter(id => ROLE_SPECS[id].faction === Faction.Wolf);
      for (const roleId of wolfRoles) {
        expect(ROLE_SPECS[roleId].team).toBe('wolf');
      }
    });

    it('slacker should have team="third" (for UI display)', () => {
      expect(ROLE_SPECS.slacker.team).toBe('third');
    });

    it('god roles should have team="good"', () => {
      const godRoles = getAllRoleIds().filter(id => ROLE_SPECS[id].faction === Faction.God);
      for (const roleId of godRoles) {
        expect(ROLE_SPECS[roleId].team).toBe('good');
      }
    });
  });

  describe('night1.hasAction ↔ NIGHT_STEPS alignment (M3c contract)', () => {
    it('night1.hasAction should match NIGHT_STEPS presence for all roles', () => {
      const stepsRoleIds = new Set(NIGHT_STEPS.map(s => s.roleId));
      
      for (const roleId of getAllRoleIds()) {
        const spec = ROLE_SPECS[roleId];
        const hasStepInNightSteps = stepsRoleIds.has(roleId);
        expect(spec.night1.hasAction).toBe(hasStepInNightSteps);
      }
    });

    it('night1 should NOT contain legacy fields (order/schemaId/actsSolo)', () => {
      for (const roleId of getAllRoleIds()) {
        const night1 = ROLE_SPECS[roleId].night1 as Record<string, unknown>;
        expect(night1).not.toHaveProperty('order');
        expect(night1).not.toHaveProperty('schemaId');
        expect(night1).not.toHaveProperty('actsSolo');
      }
    });
  });

  describe('helper functions', () => {
    it('getRoleSpec should return correct spec', () => {
      const seerSpec = getRoleSpec('seer');
      expect(seerSpec.displayName).toBe('预言家');
    });

    it('isValidRoleId should return true for valid IDs', () => {
      expect(isValidRoleId('seer')).toBe(true);
      expect(isValidRoleId('witch')).toBe(true);
    });

    it('isValidRoleId should return false for invalid IDs', () => {
      expect(isValidRoleId('celebrity')).toBe(false);
      expect(isValidRoleId('unknown')).toBe(false);
    });
  });
});
