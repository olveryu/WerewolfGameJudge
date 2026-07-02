import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import {
  MINIMUM_PLAYERS,
  validateTemplateRoles,
} from '@werewolf/game-engine/werewolf/models/Template';

describe('validateTemplateRoles', () => {
  it('rejects empty roles array', () => {
    const result = validateTemplateRoles([]);
    expect(result).not.toBeNull();
    expect(result).toContain(`${MINIMUM_PLAYERS}`);
  });

  it('accepts all-villager template (no wolf / no night action restrictions)', () => {
    const roles: RoleId[] = ['villager', 'villager', 'villager', 'villager'];
    const result = validateTemplateRoles(roles);
    expect(result).toBeNull();
  });

  it('accepts a normal template', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'witch', 'villager'];
    const result = validateTemplateRoles(roles);
    expect(result).toBeNull();
  });

  it('rejects invalid role name (defensive)', () => {
    const roles = ['wolf', 'seer', 'NOT_A_ROLE'] as unknown as RoleId[];
    const result = validateTemplateRoles(roles);
    expect(result).not.toBeNull();
    expect(result).toContain('无效角色');
  });

  it('rejects when fewer than MINIMUM_PLAYERS', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'witch'];
    if (roles.length < MINIMUM_PLAYERS) {
      const result = validateTemplateRoles(roles);
      expect(result).not.toBeNull();
    }
  });

  describe('treasureMaster bottom card prerequisites', () => {
    it('rejects treasureMaster without regular wolf', () => {
      // Has god (seer) + villager, but no wolf
      const roles: RoleId[] = [
        'treasureMaster',
        'seer',
        'witch',
        'villager',
        'villager',
        'villager',
        'villager',
      ];
      const result = validateTemplateRoles(roles);
      expect(result).toContain('普通狼人');
    });

    it('rejects treasureMaster without god faction', () => {
      // Has wolf + villager, but no god
      const roles: RoleId[] = [
        'treasureMaster',
        'wolf',
        'villager',
        'villager',
        'villager',
        'villager',
      ];
      const result = validateTemplateRoles(roles);
      expect(result).toContain('神职');
    });

    it('rejects treasureMaster without villager faction', () => {
      // Has wolf + god, but no villager
      const roles: RoleId[] = ['treasureMaster', 'wolf', 'seer', 'witch', 'hunter', 'guard'];
      const result = validateTemplateRoles(roles);
      expect(result).toContain('村民');
    });

    it('accepts treasureMaster with wolf + god + villager', () => {
      const roles: RoleId[] = [
        'treasureMaster',
        'wolf',
        'wolf',
        'seer',
        'witch',
        'villager',
        'villager',
        'villager',
      ];
      const result = validateTemplateRoles(roles);
      expect(result).toBeNull();
    });
  });
});
