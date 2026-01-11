import { validateTemplateRoles, MINIMUM_PLAYERS } from '../Template';
import type { RoleName } from '../roles';

describe('validateTemplateRoles', () => {
  it('rejects empty roles array', () => {
    const result = validateTemplateRoles([]);
    expect(result).not.toBeNull();
    expect(result).toContain(`${MINIMUM_PLAYERS}`);
  });

  it('rejects all-villager template (no wolf, no night action)', () => {
    const roles: RoleName[] = ['villager', 'villager', 'villager', 'villager'];
    const result = validateTemplateRoles(roles);
    expect(result).not.toBeNull();
    // Either "no wolf" or "no night action" is acceptable
    expect(
      result!.includes('狼人') || result!.includes('夜晚')
    ).toBe(true);
  });

  it('accepts minimal playable template: wolf + seer + witch + villager', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
    const result = validateTemplateRoles(roles);
    expect(result).toBeNull();
  });

  it('rejects when fewer than MINIMUM_PLAYERS', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch'];
    if (roles.length < MINIMUM_PLAYERS) {
      const result = validateTemplateRoles(roles);
      expect(result).not.toBeNull();
    }
  });
});
