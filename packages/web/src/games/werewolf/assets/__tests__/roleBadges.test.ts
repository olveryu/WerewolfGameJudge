/** Every role in the spec must resolve to a badge: the encyclopedia draws one for every role. */
import { getAllRoleIds } from '@game-judge/game-engine/games/werewolf/public';

import { getRoleBadge } from '../roleBadges';

describe('getRoleBadge', () => {
  it('resolves a badge for every role in the spec', () => {
    for (const key of getAllRoleIds()) {
      expect(getRoleBadge(key)).toMatch(/role_.+\.webp$/);
    }
  });
});
