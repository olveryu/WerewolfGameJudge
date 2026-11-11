/**
 * Structured Description Contract Tests
 *
 * Validates that every role has structuredDescription defined, that the flat description is
 * exactly the structured fields joined in render order, and that the fields follow the writing
 * rules documented on `RoleDescription`.
 */

import {
  getAllRoleIds,
  ROLE_SPECS,
} from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec';
import type { RoleDescription } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec/roleSpec.types';
import type { RoleSpec } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec/roleSpec.types';
import { getRoleStructuredDescription } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec/specs';

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
      const spec: RoleSpec = ROLE_SPECS[id];
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
      const spec: RoleSpec = ROLE_SPECS[id];
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
      expect(desc!.skill).toContain('袭击');
    });

    it('should return multi-field RoleDescription for spiritKnight', () => {
      const desc = getRoleStructuredDescription('spiritKnight');
      expect(desc).toBeDefined();
      expect(desc!.passive).toBeDefined();
      expect(desc!.trigger).toBeDefined();
      expect(desc!.restriction).toBeDefined();
    });

    it('should return winCondition for avenger', () => {
      const desc = getRoleStructuredDescription('avenger');
      expect(desc).toBeDefined();
      expect(desc!.winCondition).toContain('屠城');
    });

    it('should return winCondition for shadow', () => {
      const desc = getRoleStructuredDescription('shadow');
      expect(desc).toBeDefined();
      expect(desc!.winCondition).toContain('屠城');
    });
  });
});
