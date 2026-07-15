import { getAllRoleIds } from '@game-judge/game-engine/games/werewolf/public';

import { getRoleBadge } from '@/games/werewolf/assets/roleBadges';

describe('roleBadges', () => {
  it('covers every role in ROLE_SPECS', () => {
    for (const roleId of getAllRoleIds()) {
      expect(getRoleBadge(roleId)).toBeDefined();
    }
  });
});
