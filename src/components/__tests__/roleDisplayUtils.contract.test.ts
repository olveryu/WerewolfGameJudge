/**
 * roleDisplayUtils.contract.test - Contract test ensuring every role has a non-empty emoji
 *
 * RoleSpec.emoji is a required field, so TypeScript enforces coverage at compile time.
 * This runtime test guards against empty-string or whitespace-only values.
 */
import { getAllRoleIds, getRoleSpec } from '@werewolf/game-engine/models/roles';

describe('RoleSpec.emoji coverage contract', () => {
  const allRoleIds = getAllRoleIds();

  it.each(allRoleIds)('%s has a non-empty emoji string', (roleId) => {
    const spec = getRoleSpec(roleId);
    expect(spec.emoji).toBeTruthy();
    expect(typeof spec.emoji).toBe('string');
    expect(spec.emoji.trim().length).toBeGreaterThan(0);
  });
});
