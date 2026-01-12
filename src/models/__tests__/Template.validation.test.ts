import { validateTemplateRoles, MINIMUM_PLAYERS } from '../Template';
import type { RoleName } from '../roles';

describe('validateTemplateRoles', () => {
  it('rejects empty roles array', () => {
    const result = validateTemplateRoles([]);
    expect(result).not.toBeNull();
    expect(result).toContain(`${MINIMUM_PLAYERS}`);
  });

  it('accepts all-villager template (no wolf / no night action restrictions)', () => {
    const roles: RoleName[] = ['villager', 'villager', 'villager', 'villager'];
    const result = validateTemplateRoles(roles);
    expect(result).toBeNull();
  });

  it('accepts a normal template', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
    const result = validateTemplateRoles(roles);
    expect(result).toBeNull();
  });

  it('rejects invalid role name (defensive)', () => {
    const roles = ['wolf', 'seer', 'NOT_A_ROLE'] as unknown as RoleName[];
    const result = validateTemplateRoles(roles);
    expect(result).not.toBeNull();
    expect(result).toContain('无效角色');
  });

  it('rejects when fewer than MINIMUM_PLAYERS', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch'];
    if (roles.length < MINIMUM_PLAYERS) {
      const result = validateTemplateRoles(roles);
      expect(result).not.toBeNull();
    }
  });
});
