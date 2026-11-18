import { describe, expect, it } from 'vitest';

import { getRoleAvatar } from '../../assets/roleAvatars';
import {
  getSecrethitlerIdentityName,
  SECRETHITLER_ROLE_DETAILS,
  toRevealRoleData,
} from '../SecrethitlerRoleCardAdapter';

describe('Secret Hitler role presentation', () => {
  it('uses the same role names and first-night guidance for role cards and the rules screen', () => {
    expect(SECRETHITLER_ROLE_DETAILS.map((role) => role.id)).toEqual([
      'liberal',
      'fascist',
      'hitler',
    ]);

    for (const role of SECRETHITLER_ROLE_DETAILS) {
      expect(getSecrethitlerIdentityName(role.id)).toBe(role.name);
      expect(toRevealRoleData(role.id)).toMatchObject({
        id: role.id,
        name: role.name,
        alignment: role.alignment,
        imageUrl: getRoleAvatar(role.id),
        factionName: role.factionName,
        description: role.description,
      });
      expect(role.guideDescription).not.toBe('');
    }
  });

  it('fails fast for an identity without localized copy', () => {
    expect(() => toRevealRoleData('unknown')).toThrow(
      '[FAIL-FAST] Unknown Secret Hitler identity: unknown',
    );
  });
});
