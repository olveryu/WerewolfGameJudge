/**
 * Role Specs Contract Tests
 *
 * Validates ROLE_SPECS integrity: identity/classification,
 * nightSteps/NIGHT_STEPS alignment, recognition, immunities.
 */

import {
  NIGHT_STEPS,
  ROLE_SPECS,
  type RoleId,
  type RoleSpec,
} from '@werewolf/game-engine/models/roles/spec';
import { Faction, Team } from '@werewolf/game-engine/models/roles/spec/types';

const allIds = Object.keys(ROLE_SPECS).sort() as RoleId[];

describe('ROLE_SPECS registry', () => {
  it('should have exactly 41 roles', () => {
    expect(allIds).toHaveLength(41);
  });
});

describe('V2 per-role identity contract', () => {
  for (const roleId of allIds) {
    const spec = ROLE_SPECS[roleId] as RoleSpec;

    describe(roleId, () => {
      it('id should match key', () => {
        expect(spec.id).toBe(roleId);
      });

      it('displayName should be non-empty', () => {
        expect(spec.displayName).toBeTruthy();
      });

      it('shortName should be non-empty', () => {
        expect(spec.shortName).toBeTruthy();
      });

      it('emoji should be non-empty', () => {
        expect(spec.emoji).toBeTruthy();
      });

      it('faction should be valid', () => {
        expect(Object.values(Faction)).toContain(spec.faction);
      });

      it('team should be valid', () => {
        expect(Object.values(Team)).toContain(spec.team);
      });

      it('description should be non-empty', () => {
        expect(spec.description).toBeTruthy();
      });
    });
  }
});

describe('nightSteps ↔ NIGHT_STEPS equivalence', () => {
  const nightStepsByRole = new Map<string, (typeof NIGHT_STEPS)[number][]>();
  for (const step of NIGHT_STEPS) {
    const existing = nightStepsByRole.get(step.roleId) ?? [];
    existing.push(step);
    nightStepsByRole.set(step.roleId, existing);
  }

  it('roles with nightSteps should have nightSteps defined', () => {
    for (const roleId of allIds) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      const hasSteps = (spec.nightSteps?.length ?? 0) > 0;
      const inNightSteps = nightStepsByRole.has(roleId);
      if (hasSteps) {
        expect(spec.nightSteps?.length).toBeGreaterThanOrEqual(1);
      }
      expect(hasSteps).toBe(inNightSteps);
    }
  });

  it('roles without nightSteps should not appear in NIGHT_STEPS', () => {
    for (const roleId of allIds) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      if ((spec.nightSteps?.length ?? 0) === 0) {
        expect(nightStepsByRole.has(roleId)).toBe(false);
      }
    }
  });

  it('spec stepId set should match NIGHT_STEPS schemaId set per role', () => {
    for (const roleId of allIds) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      const derivedSteps = nightStepsByRole.get(roleId) ?? [];

      const specStepIds = (spec.nightSteps ?? []).map((s: { stepId: string }) => s.stepId).sort();
      const derivedSchemaIds = derivedSteps.map((s) => s.id).sort();

      expect(specStepIds).toEqual(derivedSchemaIds);
    }
  });

  it('spec audioKey should match NIGHT_STEPS audioKey per step', () => {
    for (const roleId of allIds) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      const derivedSteps = nightStepsByRole.get(roleId) ?? [];

      for (const specStep of spec.nightSteps ?? []) {
        const derivedStep = derivedSteps.find((s) => s.id === specStep.stepId);
        if (derivedStep) {
          expect(specStep.audioKey).toBe(derivedStep.audioKey);
        }
      }
    }
  });
});

describe('V2 recognition contract', () => {
  const wolfPackMembers: RoleId[] = [
    'wolf',
    'wolfQueen',
    'wolfKing',
    'darkWolfKing',
    'nightmare',
    'bloodMoon',
    'spiritKnight',
    'wolfWitch',
    'awakenedGargoyle',
    'warden',
  ];

  const loneWolves: RoleId[] = ['gargoyle', 'wolfRobot', 'masquerade'];

  it('wolf pack members should have canSeeWolves=true, participatesInWolfVote=true', () => {
    for (const roleId of wolfPackMembers) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      expect(spec.recognition?.canSeeWolves).toBe(true);
      expect(spec.recognition?.participatesInWolfVote).toBe(true);
    }
  });

  it('lone wolves should have canSeeWolves=false, participatesInWolfVote=false', () => {
    for (const roleId of loneWolves) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      expect(spec.recognition?.canSeeWolves).toBe(false);
      expect(spec.recognition?.participatesInWolfVote).toBe(false);
    }
  });

  it('non-wolf roles should not have recognition', () => {
    const nonWolfIds = allIds.filter((id) => {
      const spec = ROLE_SPECS[id] as RoleSpec;
      return spec.faction !== Faction.Wolf;
    });

    for (const roleId of nonWolfIds) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      expect(spec.recognition).toBeUndefined();
    }
  });
});

describe('V2 immunities contract', () => {
  it('spiritKnight should have wolfAttack + poison + nightDamage immunities', () => {
    const kinds = ROLE_SPECS.spiritKnight.immunities?.map((i) => i.kind) ?? [];
    expect(kinds).toContain('wolfAttack');
    expect(kinds).toContain('poison');
    expect(kinds).toContain('nightDamage');
  });

  it('wolfQueen should have wolfAttack immunity', () => {
    const kinds = ROLE_SPECS.wolfQueen.immunities?.map((i) => i.kind) ?? [];
    expect(kinds).toContain('wolfAttack');
  });

  it('poison-immune roles should have poison immunity', () => {
    const poisonImmuneRoles: RoleId[] = ['witcher', 'dancer', 'spiritKnight', 'masquerade'];
    for (const roleId of poisonImmuneRoles) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      const hasPoisonImmunity = spec.immunities?.some((i) => i.kind === 'poison') ?? false;
      expect(hasPoisonImmunity).toBe(true);
    }
  });
});

describe('V2 faction/team consistency', () => {
  it('all wolf-faction roles should have team=Wolf', () => {
    const wolfRoles = allIds.filter((id) => (ROLE_SPECS[id] as RoleSpec).faction === Faction.Wolf);
    for (const roleId of wolfRoles) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      expect(spec.team).toBe(Team.Wolf);
    }
  });

  it('all god-faction roles should have team=Good', () => {
    const godRoles = allIds.filter((id) => (ROLE_SPECS[id] as RoleSpec).faction === Faction.God);
    for (const roleId of godRoles) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      expect(spec.team).toBe(Team.Good);
    }
  });

  it('third-party roles should have team=Third (except thief/cupid which have dynamic teams)', () => {
    // thief and cupid are Special faction but start as Team.Good:
    // - thief: identity changes to chosen card (effective team is chosen role's team)
    // - cupid: seer查验=好人, effective team computed from lover composition
    const DYNAMIC_TEAM_SPECIALS: RoleId[] = ['thief', 'cupid'];
    const thirdRoles = allIds.filter(
      (id) =>
        (ROLE_SPECS[id] as RoleSpec).faction === Faction.Special &&
        !DYNAMIC_TEAM_SPECIALS.includes(id),
    );
    for (const roleId of thirdRoles) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      expect(spec.team).toBe(Team.Third);
    }
    // Dynamic team roles should have team=Good (base state)
    for (const roleId of DYNAMIC_TEAM_SPECIALS) {
      const spec = ROLE_SPECS[roleId] as RoleSpec;
      expect(spec.team).toBe(Team.Good);
    }
  });
});

describe('V2 displayAs equivalence', () => {
  it('mirrorSeer and drunkSeer should displayAs seer', () => {
    expect(ROLE_SPECS.mirrorSeer.displayAs).toBe('seer');
    expect(ROLE_SPECS.drunkSeer.displayAs).toBe('seer');
  });

  it('no other role should have displayAs', () => {
    const rolesWithDisplayAs = allIds.filter(
      (id) => (ROLE_SPECS[id] as RoleSpec).displayAs !== undefined,
    );
    expect(rolesWithDisplayAs.sort()).toEqual(['drunkSeer', 'mirrorSeer']);
  });
});
