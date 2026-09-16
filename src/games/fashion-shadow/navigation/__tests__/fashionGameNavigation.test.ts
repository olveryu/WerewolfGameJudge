import { parseFashionConfigRouteParams } from '../fashionGameNavigation';

describe('Fashion Shadow config route parser', () => {
  it('accepts the undefined optional roomCode emitted by React Navigation deep links', () => {
    expect(
      parseFashionConfigRouteParams({
        gameType: 'fashion-shadow',
        mode: 'create',
        roomCode: undefined,
      }),
    ).toEqual({ gameType: 'fashion-shadow', mode: 'create' });
  });

  it('rejects a real room code because v1 does not support config edit mode', () => {
    expect(() =>
      parseFashionConfigRouteParams({
        gameType: 'fashion-shadow',
        mode: 'create',
        roomCode: '2468',
      }),
    ).toThrow('does not accept a room code');
  });

  it('still rejects unknown route fields', () => {
    expect(() =>
      parseFashionConfigRouteParams({
        gameType: 'fashion-shadow',
        mode: 'create',
        unexpected: true,
      }),
    ).toThrow('unknown field');
  });
});
