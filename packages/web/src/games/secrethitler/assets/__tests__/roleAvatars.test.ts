import { describe, expect, it } from 'vitest';

import { getBoardRolePortraits, getRoleAvatar } from '../roleAvatars';

describe('Secret Hitler role portraits', () => {
  it('uses a distinct portrait for each public role and preloads all three', () => {
    const portraits = new Set([
      getRoleAvatar('liberal'),
      getRoleAvatar('fascist'),
      getRoleAvatar('hitler'),
    ]);
    expect(portraits.size).toBe(3);
    expect(getBoardRolePortraits()).toEqual([
      getRoleAvatar('liberal'),
      getRoleAvatar('fascist'),
      getRoleAvatar('hitler'),
    ]);
  });

  it('fails fast for an unknown role', () => {
    expect(() => getRoleAvatar('unknown')).toThrow('Missing Secret Hitler portrait');
  });
});
