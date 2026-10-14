/**
 * 阿瓦隆图鉴路由解析：roleId 深链的可选参数与严格校验。
 */
import { parseAvalonGuideRouteParams } from '../avalonGameNavigation';

describe('parseAvalonGuideRouteParams', () => {
  it('parses the bare guide route without optional params', () => {
    expect(parseAvalonGuideRouteParams({ gameType: 'avalon' })).toEqual({
      gameType: 'avalon',
      roomCode: undefined,
      roleId: undefined,
    });
  });

  it('parses roomCode and a valid roleId deep link', () => {
    expect(
      parseAvalonGuideRouteParams({ gameType: 'avalon', roomCode: '1234', roleId: 'merlin' }),
    ).toEqual({ gameType: 'avalon', roomCode: '1234', roleId: 'merlin' });
  });

  it('rejects an unknown roleId', () => {
    expect(() => parseAvalonGuideRouteParams({ gameType: 'avalon', roleId: 'seer' })).toThrow(
      'Unknown Avalon guide role',
    );
  });

  it('rejects unexpected params and a foreign game type', () => {
    expect(() =>
      parseAvalonGuideRouteParams({ gameType: 'avalon', initialTab: 'roles' }),
    ).toThrow();
    expect(() => parseAvalonGuideRouteParams({ gameType: 'werewolf' })).toThrow(
      'Avalon guide game mismatch',
    );
  });
});
