/**
 * Role avatar resolution: every role in the spec must resolve to a
 * defined avatar asset — the pictorial night review draws a portrait
 * for every role figure, so a missing entry would render a broken
 * image instead of failing loudly anywhere else.
 */
import { isValidRoleId, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';

import { getRoleAvatar } from '../roleAvatars';

describe('getRoleAvatar', () => {
  it('resolves an avatar for every role in the spec', () => {
    for (const key of Object.keys(ROLE_SPECS)) {
      if (!isValidRoleId(key)) {
        throw new Error(`[FAIL-FAST] ROLE_SPECS key ${key} is not a valid role id`);
      }
      expect(getRoleAvatar(key)).toBeDefined();
    }
  });
});
