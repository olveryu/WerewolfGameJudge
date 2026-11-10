/**
 * RoleSpec.emoji is a required field, so TypeScript enforces coverage at compile time; this
 * runtime check guards against empty or whitespace-only values.
 */
import { getAllRoleIds, getRoleSpec } from '@game-judge/game-engine/games/werewolf/public';

describe('RoleSpec.emoji coverage contract', () => {
  it.each(getAllRoleIds())('%s has a non-empty emoji string', (roleId) => {
    expect(getRoleSpec(roleId).emoji.trim().length).toBeGreaterThan(0);
  });
});
