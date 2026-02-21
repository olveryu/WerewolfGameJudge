/**
 * roleDisplayUtils.contract.test - Contract test ensuring ROLE_ICONS covers all roles
 *
 * Verifies that every RoleId in ROLE_SPECS has a corresponding emoji in ROLE_ICONS,
 * and that ROLE_ICONS contains no stale entries absent from ROLE_SPECS.
 */
import { getAllRoleIds } from '@werewolf/game-engine/models/roles';

import { ROLE_ICONS } from '@/components/roleDisplayUtils';

describe('ROLE_ICONS coverage contract', () => {
  const allRoleIds = getAllRoleIds();

  it('covers every role in ROLE_SPECS', () => {
    const missing = allRoleIds.filter((id) => !(id in ROLE_ICONS));
    expect(missing).toEqual([]);
  });

  it('contains no stale entries absent from ROLE_SPECS', () => {
    const roleIdSet = new Set<string>(allRoleIds);
    const stale = Object.keys(ROLE_ICONS).filter((id) => !roleIdSet.has(id));
    expect(stale).toEqual([]);
  });

  it.each(allRoleIds)('%s has a non-empty emoji string', (roleId) => {
    expect(ROLE_ICONS[roleId]).toBeTruthy();
    expect(typeof ROLE_ICONS[roleId]).toBe('string');
  });
});
