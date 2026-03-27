/**
 * V1 ↔ V2 Equivalence Contract Tests
 *
 * Verifies that ROLE_SPECS_V2 faithfully mirrors the V1 data:
 * ROLE_SPECS (identity/classification) + NIGHT_STEPS (step order) + SCHEMAS (UI).
 * Any mismatch between V1 and V2 is a migration bug.
 */

import { ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles/spec';
import { NIGHT_STEPS } from '@werewolf/game-engine/models/roles/spec';
import type { RoleSpec } from '@werewolf/game-engine/models/roles/spec/spec.types';
import { Faction, Team } from '@werewolf/game-engine/models/roles/spec/types';

import type { RoleSpecV2 } from '../roleSpec.types';
import { ROLE_SPECS_V2 } from '../specs';

const v1Ids = Object.keys(ROLE_SPECS).sort() as RoleId[];
const v2Ids = Object.keys(ROLE_SPECS_V2).sort();

describe('V1 ↔ V2 key-set equivalence', () => {
  it('V2 should contain the same 36 role IDs as V1', () => {
    expect(v2Ids).toEqual(v1Ids);
  });

  it('should have exactly 36 roles', () => {
    expect(v2Ids).toHaveLength(36);
  });
});

describe('V1 ↔ V2 per-role identity equivalence', () => {
  for (const roleId of v1Ids) {
    const v1 = ROLE_SPECS[roleId] as RoleSpec;
    const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;

    describe(roleId, () => {
      it('id should match', () => {
        expect(v2.id).toBe(v1.id);
      });

      it('displayName should match', () => {
        expect(v2.displayName).toBe(v1.displayName);
      });

      it('shortName should match', () => {
        expect(v2.shortName).toBe(v1.shortName);
      });

      it('emoji should match', () => {
        expect(v2.emoji).toBe(v1.emoji);
      });

      it('faction should match', () => {
        expect(v2.faction).toBe(v1.faction);
      });

      it('team should match', () => {
        expect(v2.team).toBe(v1.team);
      });

      it('description should match', () => {
        expect(v2.description).toBe(v1.description);
      });

      it('structuredDescription should match', () => {
        if (v1.structuredDescription) {
          expect(v2.structuredDescription).toEqual(v1.structuredDescription);
        }
      });

      it('night1.hasAction should match', () => {
        expect(v2.night1.hasAction).toBe(v1.night1.hasAction);
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

describe('V2 recognition ↔ V1 wolfMeeting equivalence', () => {
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

  it('wolf pack members: V2 recognition should match V1 wolfMeeting', () => {
    for (const roleId of wolfPackMembers) {
      const v1 = ROLE_SPECS[roleId] as RoleSpec;
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;

      expect(v2.recognition?.canSeeWolves).toBe(v1.wolfMeeting?.canSeeWolves);
      expect(v2.recognition?.participatesInWolfVote).toBe(v1.wolfMeeting?.participatesInWolfVote);
    }
  });

  it('lone wolves: V2 recognition should match V1 wolfMeeting', () => {
    for (const roleId of loneWolves) {
      const v1 = ROLE_SPECS[roleId] as RoleSpec;
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;

      expect(v2.recognition?.canSeeWolves).toBe(v1.wolfMeeting?.canSeeWolves);
      expect(v2.recognition?.participatesInWolfVote).toBe(v1.wolfMeeting?.participatesInWolfVote);
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

describe('V2 immunities ↔ V1 flags equivalence', () => {
  it('roles with V1 immuneToPoison flag should have V2 poison immunity', () => {
    for (const roleId of v1Ids) {
      const v1 = ROLE_SPECS[roleId] as RoleSpec;
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;

      const v1HasPoisonImmunity = v1.flags?.immuneToPoison === true;
      const v2HasPoisonImmunity = v2.immunities?.some((i) => i.kind === 'poison') ?? false;

      expect(v2HasPoisonImmunity).toBe(v1HasPoisonImmunity);
    }
  });

  it('roles with V1 immuneToWolfKill flag should have V2 wolfAttack immunity', () => {
    for (const roleId of v1Ids) {
      const v1 = ROLE_SPECS[roleId] as RoleSpec;
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;

      const v1HasWolfImmunity = v1.flags?.immuneToWolfKill === true;
      const v2HasWolfImmunity = v2.immunities?.some((i) => i.kind === 'wolfAttack') ?? false;

      expect(v2HasWolfImmunity).toBe(v1HasWolfImmunity);
    }
  });

  it('roles with V1 reflectsDamage flag should have V2 nightDamage immunity', () => {
    for (const roleId of v1Ids) {
      const v1 = ROLE_SPECS[roleId] as RoleSpec;
      const v2 = ROLE_SPECS_V2[roleId as keyof typeof ROLE_SPECS_V2] as RoleSpecV2;

      const v1HasReflect = v1.flags?.reflectsDamage === true;
      const v2HasNightDamageImmunity =
        v2.immunities?.some((i) => i.kind === 'nightDamage') ?? false;

      // spiritKnight has reflectsDamage AND nightDamage immunity
      if (v1HasReflect) {
        expect(v2HasNightDamageImmunity).toBe(true);
      }
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
