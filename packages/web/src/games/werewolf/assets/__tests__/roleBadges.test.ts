/** Every role in the spec must resolve to a badge: the encyclopedia draws one for every role. */
import { isValidRoleId, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';

import { getRoleBadge } from '../roleBadges';

describe('getRoleBadge', () => {
  it('resolves a badge for every role in the spec', () => {
    for (const key of Object.keys(ROLE_SPECS)) {
      if (!isValidRoleId(key)) {
        throw new Error(`[FAIL-FAST] ROLE_SPECS key ${key} is not a valid role id`);
      }
      expect(getRoleBadge(key)).toMatch(/role_.+\.webp$/);
    }
  });
});
