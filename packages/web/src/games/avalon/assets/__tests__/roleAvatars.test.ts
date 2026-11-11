import { AVALON_BOARDS, AVALON_PLAYER_COUNTS } from '@game-judge/game-engine/games/avalon/public';

import { getBoardRolePortraits, getRoleAvatar } from '../roleAvatars';

describe('Avalon public-board portraits', () => {
  it.each(AVALON_PLAYER_COUNTS)('warms only the %i-player board, once per portrait', (count) => {
    expect(getBoardRolePortraits(count)).toEqual(
      [...new Set(AVALON_BOARDS[count])].map(getRoleAvatar),
    );
  });

  it('changes the candidates with the public configuration, before any deal', () => {
    expect(getBoardRolePortraits(5)).not.toContain(getRoleAvatar('oberon'));
    expect(getBoardRolePortraits(7)).toContain(getRoleAvatar('oberon'));
  });

  it('rejects an unsupported board size', () => {
    expect(() => getBoardRolePortraits(4)).toThrow('Invalid Avalon player count');
  });
});
