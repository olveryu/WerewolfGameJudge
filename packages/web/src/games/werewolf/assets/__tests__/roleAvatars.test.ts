/**
 * Role avatar resolution: every role in the spec must resolve to a defined avatar asset — the
 * role card and the pictorial night review draw a portrait for every role, so a missing entry
 * would render a broken image instead of failing loudly anywhere else.
 */
import { isValidRoleId, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';

import { getBoardRolePortraits, getRoleAvatar } from '../roleAvatars';

describe('getRoleAvatar', () => {
  it('resolves an avatar for every role in the spec', () => {
    for (const key of Object.keys(ROLE_SPECS)) {
      if (!isValidRoleId(key)) {
        throw new Error(`[FAIL-FAST] ROLE_SPECS key ${key} is not a valid role id`);
      }
      expect(getRoleAvatar(key)).toMatch(/\.webp$/);
    }
  });

  describe('getBoardRolePortraits', () => {
    it('only includes the public board and deduplicates repeated roles', () => {
      expect(getBoardRolePortraits(['wolf', 'seer', 'wolf', 'villager'])).toEqual(
        (['wolf', 'seer', 'villager'] as const).map(getRoleAvatar),
      );
    });

    it.each(['mirrorSeer', 'drunkSeer'] as const)(
      'also warms the displayed identity of %s',
      (roleId) => {
        expect(getBoardRolePortraits([roleId])).toEqual([
          getRoleAvatar(roleId),
          getRoleAvatar('seer'),
        ]);
      },
    );
  });
});
