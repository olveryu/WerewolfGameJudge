/**
 * Structured Description Contract Tests
 *
 * Validates that all 36 roles have structuredDescription defined
 * and that structured content is semantically consistent with the flat description.
 */

import { getAllRoleIds, ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles/spec';
import type { RoleDescription, RoleSpec } from '@werewolf/game-engine/models/roles/spec/spec.types';
import { getRoleStructuredDescription } from '@werewolf/game-engine/models/roles/spec/specs';

/** Valid field keys in RoleDescription */
const VALID_FIELDS: readonly (keyof RoleDescription)[] = [
  'skill',
  'passive',
  'trigger',
  'restriction',
  'special',
  'winCondition',
];

describe('structuredDescription contract', () => {
  const allRoles = getAllRoleIds();

  it('every role should have structuredDescription defined', () => {
    const missing: string[] = [];
    for (const id of allRoles) {
      const spec = ROLE_SPECS[id] as RoleSpec;
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

  it('structuredDescription content should be covered by the flat description', () => {
    // Each structured field's text (after removing punctuation) should appear
    // as a substring or semantic segment in the flat description.
    // This is a loose check — we verify each clause appears in the original.
    for (const id of allRoles) {
      const spec = ROLE_SPECS[id] as RoleSpec;
      const desc = spec.structuredDescription;
      if (!desc) continue;
      const flat = spec.description;

      for (const key of VALID_FIELDS) {
        const value = desc[key];
        if (value == null) continue;
        // Split by semicolons and check each clause
        const clauses = value.split('；');
        for (const clause of clauses) {
          // At least one 4-character window from the clause should exist in flat.
          // Uses a sliding window instead of a fixed prefix to tolerate minor
          // rewording (e.g. "绑定时胜利条件" vs "绑定胜利条件").
          const windowSize = Math.min(4, clause.length);
          let found = false;
          for (let i = 0; i <= clause.length - windowSize; i++) {
            if (flat.includes(clause.slice(i, i + windowSize))) {
              found = true;
              break;
            }
          }
          expect(found).toBe(true);
        }
      }
    }
  });

  describe('getRoleStructuredDescription()', () => {
    it('should return RoleDescription for wolf', () => {
      const desc = getRoleStructuredDescription('wolf');
      expect(desc).toBeDefined();
      expect(desc!.skill).toContain('袭击');
    });

    it('should return multi-field RoleDescription for spiritKnight', () => {
      const desc = getRoleStructuredDescription('spiritKnight' as RoleId);
      expect(desc).toBeDefined();
      expect(desc!.passive).toBeDefined();
      expect(desc!.trigger).toBeDefined();
      expect(desc!.restriction).toBeDefined();
    });

    it('should return winCondition for avenger', () => {
      const desc = getRoleStructuredDescription('avenger' as RoleId);
      expect(desc).toBeDefined();
      expect(desc!.winCondition).toContain('屠城');
    });

    it('should return winCondition for shadow', () => {
      const desc = getRoleStructuredDescription('shadow' as RoleId);
      expect(desc).toBeDefined();
      expect(desc!.winCondition).toContain('屠城');
    });
  });
});
