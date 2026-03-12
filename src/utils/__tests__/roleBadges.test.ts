import { getAllRoleIds } from '@werewolf/game-engine/models/roles';

import { getRoleBadge } from '@/utils/roleBadges';

describe('roleBadges', () => {
  it('covers every role in ROLE_SPECS', () => {
    for (const roleId of getAllRoleIds()) {
      expect(getRoleBadge(roleId)).toBeDefined();
    }
  });
});
