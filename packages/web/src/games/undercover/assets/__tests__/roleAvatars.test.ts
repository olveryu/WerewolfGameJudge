import { getBoardRolePortraits, getRoleAvatar } from '../roleAvatars';

describe('Undercover public-board portraits', () => {
  it('does not request the blank portrait when blank cards are disabled', () => {
    expect(getBoardRolePortraits(false)).toEqual([
      getRoleAvatar('civilian'),
      getRoleAvatar('undercover'),
    ]);
  });

  it('adds the blank portrait when the public setting enables it', () => {
    expect(getBoardRolePortraits(true)).toEqual([
      getRoleAvatar('civilian'),
      getRoleAvatar('undercover'),
      getRoleAvatar('blank'),
    ]);
  });
});
