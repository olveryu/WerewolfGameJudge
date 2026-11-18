import { describe, expect, it } from 'vitest';

import { getBoardRolePortraits, getRoleAvatar } from '../roleAvatars';

describe('Secret Hitler role portraits', () => {
  it('uses the same placeholder for each public role and preloads it once', () => {
    const placeholder = getRoleAvatar('liberal');

    expect(getRoleAvatar('fascist')).toBe(placeholder);
    expect(getRoleAvatar('hitler')).toBe(placeholder);
    expect(getBoardRolePortraits()).toEqual([placeholder]);
  });

  it('fails fast for an unknown role', () => {
    expect(() => getRoleAvatar('unknown')).toThrow('Missing Secret Hitler portrait');
  });
});
