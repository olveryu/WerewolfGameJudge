import { FIBKING_ROLE_PORTRAITS, getRoleAvatar } from '../roleAvatars';

describe('FibKing public-board portraits', () => {
  it('warms all three role kinds without needing a round or a secret assignment', () => {
    expect(FIBKING_ROLE_PORTRAITS).toEqual(
      (['fibber', 'honest', 'guesser'] as const).map(getRoleAvatar),
    );
  });
});
