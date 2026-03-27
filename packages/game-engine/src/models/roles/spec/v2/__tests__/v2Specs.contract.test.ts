/**
 * V2 Role Specs Contract Tests
 *
 * Validates ROLE_SPECS_V2 integrity: identity/classification,
 * nightSteps/NIGHT_STEPS alignment, recognition, immunities.
 */

import { ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles/spec';
import { NIGHT_STEPS } from '@werewolf/game-engine/models/roles/spec';
import { Faction, Team } from '@werewolf/game-engine/models/roles/spec/types';

import type { RoleSpecV2 } from '../roleSpec.types';
import { ROLE_SPECS_V2 } from '../specs';

const v1Ids = Object.keys(ROLE_SPECS).sort() as RoleId[];
const v2Ids = Object.keys(ROLE_SPECS_V2).sort();

describe('V1 ↔ V2 key-set equivalence', () => {
  it('ROLE_SPECS and ROLE_SPECS_V2 should be the same object', () => {
    expect(ROLE_SPECS).toBe(ROLE_SPECS_V2);
  });

  it('should have exactly 36 roles', () => {
    expect(v2Ids).toHaveLength(36);
  });
});

describe('V2 per-role identity contract', () => {
  for (const roleId of v1Ids) {
    const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;

    describe(roleId, () => {
      it('id should match key', () => {
        expect(v2.id).toBe(roleId);
      });

      it('displayName should be non-empty', () => {
        expect(v2.displayName).toBeTruthy();
      });

      it('shortName should be non-empty', () => {
        expect(v2.shortName).toBeTruthy();
      });

      it('emoji should be non-empty', () => {
        expect(v2.emoji).toBeTruthy();
      });

      it('faction should be valid', () => {
        expect(Object.values(Faction)).toContain(v2.faction);
      });

      it('team should be valid', () => {
        expect(Object.values(Team)).toContain(v2.team);
      });

      it('description should be non-empty', () => {
        expect(v2.description).toBeTruthy();
      });

      it('night1.hasAction should be boolean', () => {
        expect(typeof v2.night1.hasAction).toBe('boolean');
      });
    });
  }
});

describe('V2 nightSteps ↔ V1 NIGHT_STEPS equivalence', () => {
  const v1StepsByRole = new Map<string, (typeof NIGHT_STEPS)[number][]>();
  for (const step of NIGHT_STEPS) {
    const existing = v1StepsByRole.get(step.roleId) ?? [];
    existing.push(step);
    v1StepsByRole.set(step.roleId, existing);
  }

  it('roles with hasAction=true should have nightSteps defined', () => {
    for (const roleId of v2Ids) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      if (v2.night1.hasAction) {
        expect(v2.nightSteps?.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('roles with hasAction=false should not have nightSteps (or have empty)', () => {
    for (const roleId of v2Ids) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      if (!v2.night1.hasAction) {
        expect(v2.nightSteps ?? []).toHaveLength(0);
      }
    }
  });

  it('V2 stepId set should match V1 NIGHT_STEPS schemaId set per role', () => {
    for (const roleId of v2Ids) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      const v1Steps = v1StepsByRole.get(roleId) ?? [];

      const v2StepIds = (v2.nightSteps ?? []).map((s) => s.stepId).sort();
      const v1SchemaIds = v1Steps.map((s) => s.id).sort();

      expect(v2StepIds).toEqual(v1SchemaIds);
    }
  });

  it('V2 audioKey should match V1 NIGHT_STEPS audioKey per step', () => {
    for (const roleId of v2Ids) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      const v1Steps = v1StepsByRole.get(roleId) ?? [];

      for (const v2Step of v2.nightSteps ?? []) {
        const v1Step = v1Steps.find((s) => s.id === v2Step.stepId);
        if (v1Step) {
          expect(v2Step.audioKey).toBe(v1Step.audioKey);
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
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      expect(v2.recognition?.canSeeWolves).toBe(true);
      expect(v2.recognition?.participatesInWolfVote).toBe(true);
    }
  });

  it('lone wolves should have canSeeWolves=false, participatesInWolfVote=false', () => {
    for (const roleId of loneWolves) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      expect(v2.recognition?.canSeeWolves).toBe(false);
      expect(v2.recognition?.participatesInWolfVote).toBe(false);
    }
  });

  it('non-wolf roles should not have recognition', () => {
    const nonWolfIds = v2Ids.filter((id) => {
      const v2 = ROLE_SPECS_V2[id as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      return v2.faction !== Faction.Wolf;
    });

    for (const roleId of nonWolfIds) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      expect(v2.recognition).toBeUndefined();
    }
  });
});

describe('V2 immunities contract', () => {
  it('spiritKnight should have wolfAttack + poison + nightDamage immunities', () => {
    const kinds = ROLE_SPECS_V2.spiritKnight.immunities?.map((i) => i.kind) ?? [];
    expect(kinds).toContain('wolfAttack');
    expect(kinds).toContain('poison');
    expect(kinds).toContain('nightDamage');
  });

  it('wolfQueen should have wolfAttack immunity', () => {
    const kinds = ROLE_SPECS_V2.wolfQueen.immunities?.map((i) => i.kind) ?? [];
    expect(kinds).toContain('wolfAttack');
  });

  it('poison-immune roles should have poison immunity', () => {
    const poisonImmuneRoles: RoleId[] = ['witcher', 'dancer', 'spiritKnight', 'masquerade'];
    for (const roleId of poisonImmuneRoles) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      const hasPoisonImmunity = v2.immunities?.some((i) => i.kind === 'poison') ?? false;
      expect(hasPoisonImmunity).toBe(true);
    }
  });
});

describe('V2 faction/team consistency', () => {
  it('all wolf-faction roles should have team=Wolf', () => {
    const wolfRoles = v2Ids.filter(
      (id) =>
        (ROLE_SPECS_V2[id as keyof typeof ROLE_SPECS_V2] as RoleSpecV2).faction === Faction.Wolf,
    );
    for (const roleId of wolfRoles) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      expect(v2.team).toBe(Team.Wolf);
    }
  });

  it('all god-faction roles should have team=Good', () => {
    const godRoles = v2Ids.filter(
      (id) =>
        (ROLE_SPECS_V2[id as keyof typeof ROLE_SPECS_V2] as RoleSpecV2).faction === Faction.God,
    );
    for (const roleId of godRoles) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      expect(v2.team).toBe(Team.Good);
    }
  });

  it('third-party roles should have team=Third', () => {
    const thirdRoles = v2Ids.filter(
      (id) =>
        (ROLE_SPECS_V2[id as keyof typeof ROLE_SPECS_V2] as RoleSpecV2).faction === Faction.Special,
    );
    for (const roleId of thirdRoles) {
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;
      expect(v2.team).toBe(Team.Third);
    }
  });
});

describe('V2 displayAs equivalence', () => {
  it('mirrorSeer and drunkSeer should displayAs seer', () => {
    expect(ROLE_SPECS_V2.mirrorSeer.displayAs).toBe('seer');
    expect(ROLE_SPECS_V2.drunkSeer.displayAs).toBe('seer');
  });

  it('no other role should have displayAs', () => {
    const rolesWithDisplayAs = v2Ids.filter(
      (id) =>
        (ROLE_SPECS_V2[id as keyof typeof ROLE_SPECS_V2] as RoleSpecV2).displayAs !== undefined,
    );
    expect(rolesWithDisplayAs.sort()).toEqual(['drunkSeer', 'mirrorSeer']);
  });
});
