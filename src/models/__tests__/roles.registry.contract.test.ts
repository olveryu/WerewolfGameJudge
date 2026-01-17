/**
 * Contract tests for role registry
 *
 * Guarantees:
 * 1. ROLE_SPECS is single source of truth for role definitions
 * 2. getRoleSpec() returns consistent data from ROLE_SPECS
 * 3. All RoleId values map to valid role specs
 * 4. Role metadata (displayName, faction, etc.) is complete
 */
import { ROLE_SPECS, getRoleSpec, isValidRoleId, getAllRoleIds, RoleId } from '../roles';

describe('Role Registry Contract Tests', () => {
  describe('ROLE_SPECS is single source of truth', () => {
    it('ROLE_SPECS contains all expected base roles', () => {
      const baseRoles: RoleId[] = ['villager', 'wolf', 'seer', 'witch', 'hunter', 'guard'];
      for (const roleId of baseRoles) {
        expect(ROLE_SPECS[roleId]).toBeDefined();
      }
    });

    it('every RoleId has a corresponding spec', () => {
      const allRoleIds = getAllRoleIds();
      for (const roleId of allRoleIds) {
        expect(ROLE_SPECS[roleId]).toBeDefined();
        expect(ROLE_SPECS[roleId].displayName).toBeTruthy();
      }
    });

    it('getAllRoleIds returns keys of ROLE_SPECS', () => {
      const allRoleIds = getAllRoleIds();
      const specKeys = Object.keys(ROLE_SPECS) as RoleId[];
      expect(new Set(allRoleIds)).toEqual(new Set(specKeys));
    });
  });

  describe('getRoleSpec() returns consistent data', () => {
    it('returns spec for valid roleId', () => {
      const spec = getRoleSpec('villager');
      expect(spec).toBeDefined();
      expect(spec.displayName).toBe('普通村民');
      expect(spec.faction).toBe('villager');
    });

    it('returns same reference as ROLE_SPECS for same roleId', () => {
      const allRoleIds = getAllRoleIds();
      for (const roleId of allRoleIds) {
        expect(getRoleSpec(roleId)).toBe(ROLE_SPECS[roleId]);
      }
    });

    it('returns undefined for invalid roleId', () => {
      // getRoleSpec returns undefined for invalid roleId (not throws)
      const result = getRoleSpec('not_a_role' as RoleId);
      expect(result).toBeUndefined();
    });
  });

  describe('isValidRoleId validation', () => {
    it('returns true for all valid roleIds', () => {
      const allRoleIds = getAllRoleIds();
      for (const roleId of allRoleIds) {
        expect(isValidRoleId(roleId)).toBe(true);
      }
    });

    it('returns false for invalid strings', () => {
      expect(isValidRoleId('not_a_role')).toBe(false);
      expect(isValidRoleId('')).toBe(false);
      expect(isValidRoleId(null as unknown as string)).toBe(false);
      expect(isValidRoleId(undefined as unknown as string)).toBe(false);
    });
  });

  describe('Role spec completeness', () => {
    it('every spec has required fields', () => {
      const allRoleIds = getAllRoleIds();
      for (const roleId of allRoleIds) {
        const spec = getRoleSpec(roleId);
        expect(spec.displayName).toBeTruthy();
        expect(spec.faction).toBeTruthy();
        expect(['villager', 'wolf', 'god', 'special']).toContain(spec.faction);
      }
    });

    it('wolf faction roles are marked correctly', () => {
      const wolfRoles: RoleId[] = ['wolf', 'wolfQueen', 'wolfRobot', 'darkWolfKing'];
      for (const roleId of wolfRoles) {
        const spec = getRoleSpec(roleId);
        expect(spec.faction).toBe('wolf');
      }
    });

    it('god faction roles are marked correctly', () => {
      const godRoles: RoleId[] = [
        'seer',
        'witch',
        'hunter',
        'guard',
        'psychic',
        'dreamcatcher',
        'magician',
      ];
      for (const roleId of godRoles) {
        const spec = getRoleSpec(roleId);
        expect(spec.faction).toBe('god');
      }
    });

    it('villager faction roles are marked correctly', () => {
      const spec = getRoleSpec('villager');
      expect(spec.faction).toBe('villager');
    });
  });

  describe('Role displayName uniqueness', () => {
    it('all displayNames are unique', () => {
      const allRoleIds = getAllRoleIds();
      const displayNames = allRoleIds.map((id) => getRoleSpec(id).displayName);
      const uniqueNames = new Set(displayNames);
      expect(uniqueNames.size).toBe(displayNames.length);
    });
  });

  describe('RoleId stability', () => {
    it('RoleId values match ROLE_SPECS keys (no drift)', () => {
      // This ensures the derived RoleId type matches actual spec keys
      const allRoleIds = getAllRoleIds();
      for (const roleId of allRoleIds) {
        // Type check: roleId should be assignable to keyof typeof ROLE_SPECS
        const _keyCheck: keyof typeof ROLE_SPECS = roleId;
        expect(_keyCheck).toBe(roleId);
      }
    });
  });
});
