/**
 * Role card contract — what every role file must provide for display.
 *
 * The flat description is exactly the card sections joined in render order,
 * the sections follow the writing rules documented on `RoleDescription`,
 * and the wolf recognition and team facts the room relies on are pinned.
 */

import { describe, expect, it } from 'vitest';

import {
  Faction,
  getAllRoleIds,
  getRoleCard,
  getRoleStructuredDescription,
  type RoleCard,
  type RoleId,
  Team,
} from '../catalog';
import { getWerewolfRoleDefinition } from '../nightPlan';
import type { RoleDescription } from '../role';

/** Valid field keys in RoleDescription, in render order */
const VALID_FIELDS: readonly (keyof RoleDescription)[] = [
  'skill',
  'passive',
  'trigger',
  'restriction',
  'special',
  'winCondition',
];

/** Each clause between these separators renders as one bullet. */
const CLAUSE_SEPARATOR = '；';

/** Wording variants replaced by one house phrase; the key is banned, the value is what to write. */
const BANNED_WORDING: Readonly<Record<string, string>> = {
  不可: '不能',
  公投: '投票放逐',
  投票出局: '投票放逐',
  狼队全灭: '其他狼人全部出局',
  第二天起: '从第二夜起',
  '。': CLAUSE_SEPARATOR,
};

/** A longer clause is several rules in one bullet; split it. */
const MAX_CLAUSE_LENGTH = 45;

/** Arabic digits directly before a counter word; counts are written in Chinese numerals. */
const ARABIC_COUNT = /\d\s*[名张次瓶人票]/;

describe('structuredDescription contract', () => {
  const allRoles = getAllRoleIds();

  it('every role should have structuredDescription defined', () => {
    const missing: string[] = [];
    for (const id of allRoles) {
      const spec: RoleCard = getRoleCard(id);
      if (!spec.structuredDescription) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every structuredDescription should have at least one non-empty field', () => {
    for (const id of allRoles) {
      const desc = getRoleStructuredDescription(id);
      if (!desc) continue;
      const fieldCount = VALID_FIELDS.filter((key) => desc[key] != null).length;
      expect(fieldCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('every structuredDescription field value should be a non-empty string', () => {
    for (const id of allRoles) {
      const desc = getRoleStructuredDescription(id);
      if (!desc) continue;
      for (const key of VALID_FIELDS) {
        const value = desc[key];
        if (value != null) {
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('flat description is exactly the structured fields joined in render order', () => {
    const drifted: string[] = [];
    for (const id of allRoles) {
      const spec: RoleCard = getRoleCard(id);
      const desc = spec.structuredDescription;
      if (!desc) continue;
      const joined = VALID_FIELDS.map((key) => desc[key])
        .filter((value) => value != null)
        .join(CLAUSE_SEPARATOR);
      if (spec.description !== joined) drifted.push(id);
    }
    expect(drifted).toEqual([]);
  });

  it('structuredDescription fields are declared in render order', () => {
    const misordered: string[] = [];
    for (const id of allRoles) {
      const desc = getRoleStructuredDescription(id);
      if (!desc) continue;
      const declared = Object.keys(desc);
      const expected = VALID_FIELDS.filter((key) => desc[key] != null);
      if (declared.join(',') !== expected.join(',')) misordered.push(id);
    }
    expect(misordered).toEqual([]);
  });

  it('every clause is a non-empty, trimmed bullet of one rule', () => {
    const malformed: string[] = [];
    for (const id of allRoles) {
      const desc = getRoleStructuredDescription(id);
      if (!desc) continue;
      for (const key of VALID_FIELDS) {
        const value = desc[key];
        if (value == null) continue;
        for (const clause of value.split(CLAUSE_SEPARATOR)) {
          const isBullet =
            clause.length > 0 && clause === clause.trim() && clause.length <= MAX_CLAUSE_LENGTH;
          if (!isBullet) malformed.push(`${id}.${key}: "${clause}"`);
        }
      }
    }
    expect(malformed).toEqual([]);
  });

  it('uses one house phrase per concept and Chinese numerals for counts', () => {
    const violations: string[] = [];
    for (const id of allRoles) {
      const desc = getRoleStructuredDescription(id);
      if (!desc) continue;
      for (const key of VALID_FIELDS) {
        const value = desc[key];
        if (value == null) continue;
        for (const [banned, preferred] of Object.entries(BANNED_WORDING)) {
          if (value.includes(banned)) {
            violations.push(`${id}.${key}: "${banned}" → "${preferred}"`);
          }
        }
        if (ARABIC_COUNT.test(value)) violations.push(`${id}.${key}: Arabic count`);
      }
    }
    expect(violations).toEqual([]);
  });

  describe('getRoleStructuredDescription()', () => {
    it('should return RoleDescription for wolf', () => {
      const desc = getRoleStructuredDescription('wolf');
      expect(desc).toBeDefined();
      expect(desc.skill).toContain('袭击');
    });

    it('should return multi-field RoleDescription for spiritKnight', () => {
      const desc = getRoleStructuredDescription('spiritKnight');
      expect(desc).toBeDefined();
      expect(desc.passive).toContain('免疫所有夜间致死效果');
      expect(desc.trigger).toBeDefined();
      expect(desc.restriction).toBeDefined();
    });

    it('should return winCondition for avenger', () => {
      const desc = getRoleStructuredDescription('avenger');
      expect(desc).toBeDefined();
      expect(desc.winCondition).toContain('屠城');
    });

    it('should return winCondition for shadow', () => {
      const desc = getRoleStructuredDescription('shadow');
      expect(desc).toBeDefined();
      expect(desc.winCondition).toContain('屠城');
    });
  });
});

describe('role catalog facts', () => {
  it('lists exactly 50 roles', () => {
    expect(getAllRoleIds()).toHaveLength(50);
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
      'wolfWitch',
      'awakenedGargoyle',
    ];

    const loneWolves: RoleId[] = ['gargoyle', 'wolfRobot', 'scarletWolfKing'];

    it('wolf pack members should see wolves and participate in vote', () => {
      for (const roleId of wolfPackMembers) {
        const recognition = getWerewolfRoleDefinition(roleId).traits.recognition;
        expect(recognition?.canSeeWolves).toBe(true);
        expect(recognition?.participatesInWolfVote).toBe(true);
      }
    });

    it('lone wolves should not see wolves and not participate in vote', () => {
      for (const roleId of loneWolves) {
        const recognition = getWerewolfRoleDefinition(roleId).traits.recognition;
        expect(recognition?.canSeeWolves).toBe(false);
        expect(recognition?.participatesInWolfVote).toBe(false);
      }
    });
  });

  describe('seer check rule (team field)', () => {
    it('all wolf-faction roles should have team=Team.Wolf (except hiddenWolf)', () => {
      const wolfRoles = getAllRoleIds().filter((id) => getRoleCard(id).faction === Faction.Wolf);
      for (const roleId of wolfRoles) {
        if (roleId === 'hiddenWolf') {
          // hiddenWolf checks as Good — design intent
          expect(getRoleCard(roleId).team).toBe(Team.Good);
        } else {
          expect(getRoleCard(roleId).team).toBe(Team.Wolf);
        }
      }
    });

    it('slacker should have team=Team.Third (for UI display)', () => {
      expect(getRoleCard('slacker').team).toBe(Team.Third);
    });

    it('god roles should have team=Team.Good', () => {
      const godRoles = getAllRoleIds().filter((id) => getRoleCard(id).faction === Faction.God);
      for (const roleId of godRoles) {
        expect(getRoleCard(roleId).team).toBe(Team.Good);
      }
    });
  });

  describe('slacker and wolfRobot skill copy (2026-11-10 rulings)', () => {
    it('slacker never becomes a wolf: no transform trigger anywhere', () => {
      expect(getRoleCard('slacker').description).not.toContain('变为狼人');
      expect(getRoleCard('slacker').description).not.toContain('变成狼人');
      expect(getRoleCard('slacker').description).not.toContain('加入狼队');
      expect(getRoleCard('slacker').structuredDescription.trigger).toBeUndefined();
      expect(getRoleCard('slacker').description).toContain('与榜样阵营共同胜利');
    });

    it('wildChild still transforms when its idol is voted out', () => {
      expect(getRoleCard('wildChild').description).toContain('变为狼人');
      expect(getRoleCard('wildChild').structuredDescription.trigger).toContain('变为狼人');
    });

    it('wolfRobot learn rules: guard and wolf are special cases, others inherit', () => {
      const description = getRoleCard('wolfRobot').description;
      expect(description).toContain('若学习到守卫');
      expect(description).toContain('从次夜起');
      expect(description).toContain('毒药反弹至施法者自身');
      expect(description).toContain('毒药反弹至施法者自身；若学习到狼人');
      expect(description).toContain('限用一次');
      expect(description).toContain('可额外袭击一名玩家，限用一次');
      expect(description).toContain('学习其他角色时正常继承其技能');
      expect((description.match(/限用一次/g) ?? []).length).toBe(1);
      expect(description).not.toContain('学到守卫');
      expect(description).not.toContain('学到狼人');
      expect(description).not.toContain('下一晚');
      expect(description).not.toContain('仅可使用');
      expect(description).not.toContain('仅限一次');
      expect(description).not.toContain('多一刀');
      expect(description).not.toContain('双刀');
      expect(description).not.toContain('免疫狼刀');
      const structured = getRoleCard('wolfRobot').structuredDescription;
      expect(structured?.skill).toContain('学习其他角色时正常继承其技能');
      expect(structured?.skill).not.toContain('若学习到守卫');
      expect(structured?.skill).not.toContain('若学习到狼人');
      expect(structured?.special).toContain('若学习到守卫');
      expect(structured?.special).toContain('从次夜起');
      expect(structured?.special).toContain('毒药反弹至施法者自身');
      expect(structured?.special).toContain('毒药反弹至施法者自身；若学习到狼人');
      expect(structured?.special).toContain('限用一次');
      expect(structured?.special).toContain('若学习到狼人');
      expect(structured?.special).toContain('可额外袭击一名玩家，限用一次');
      expect(structured?.special).toContain('其他狼人全部出局后可主导袭击');
      expect((structured?.special?.match(/限用一次/g) ?? []).length).toBe(1);
    });
  });
});
