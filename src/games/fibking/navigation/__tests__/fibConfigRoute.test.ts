import { parseFibConfigRouteParams } from '@/games/fibking/navigation/fibConfigRoute';

describe('parseFibConfigRouteParams', () => {
  it('parses exact create and edit routes', () => {
    expect(parseFibConfigRouteParams({ gameType: 'fibking', mode: 'create' })).toEqual({
      gameType: 'fibking',
      mode: 'create',
    });
    expect(
      parseFibConfigRouteParams({ gameType: 'fibking', mode: 'edit', roomCode: '4321' }),
    ).toEqual({ gameType: 'fibking', mode: 'edit', roomCode: '4321' });
  });

  it('rejects another game, missing room identity, and unknown fields', () => {
    expect(() => parseFibConfigRouteParams({ gameType: 'werewolf', mode: 'create' })).toThrow(
      '[FAIL-FAST] FibKing config received game type werewolf',
    );
    expect(() => parseFibConfigRouteParams({ gameType: 'fibking', mode: 'edit' })).toThrow();
    expect(() =>
      parseFibConfigRouteParams({ gameType: 'fibking', mode: 'create', unexpected: true }),
    ).toThrow();
  });
});
