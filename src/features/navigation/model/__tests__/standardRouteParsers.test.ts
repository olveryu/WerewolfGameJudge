import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
} from '../standardRouteParsers';

const parseConfig = createStandardConfigRouteParser({
  gameType: 'demo',
  displayName: 'Demo',
});

const parseWerewolfLikeConfig = createStandardConfigRouteParser({
  gameType: 'werewolf',
  displayName: 'Werewolf',
  extraRoomCodeModes: ['nominate'],
});

describe('createStandardConfigRouteParser', () => {
  it('parses create and edit routes with stable key order', () => {
    expect(parseConfig({ gameType: 'demo', mode: 'create' })).toEqual({
      gameType: 'demo',
      mode: 'create',
    });
    const edit = parseConfig({ gameType: 'demo', mode: 'edit', roomCode: '4321' });
    expect(edit).toEqual({ gameType: 'demo', mode: 'edit', roomCode: '4321' });
    expect(Object.keys(edit)).toEqual(['gameType', 'mode', 'roomCode']);
  });

  it('parses extra room-code modes for games that declare them', () => {
    expect(
      parseWerewolfLikeConfig({ gameType: 'werewolf', mode: 'nominate', roomCode: '2468' }),
    ).toEqual({ gameType: 'werewolf', mode: 'nominate', roomCode: '2468' });
    expect(() => parseConfig({ gameType: 'demo', mode: 'nominate', roomCode: '2468' })).toThrow(
      '[FAIL-FAST] Unknown Demo config mode: nominate',
    );
  });

  it('rejects non-object params, unknown keys, and foreign game types', () => {
    expect(() => parseConfig(null)).toThrow(
      '[FAIL-FAST] Demo config route params must be an object',
    );
    expect(() => parseConfig({ gameType: 'demo', mode: 'create', unexpected: 1 })).toThrow(
      '[FAIL-FAST] Demo config route params contain unknown field: unexpected',
    );
    expect(() => parseConfig({ gameType: 'avalon', mode: 'create' })).toThrow(
      '[FAIL-FAST] Demo config received game type avalon',
    );
    expect(() => parseConfig({ gameType: 'not-a-game', mode: 'create' })).toThrow();
  });

  it('rejects non-string modes, room codes on create, and unknown modes', () => {
    expect(() => parseConfig({ gameType: 'demo' })).toThrow(
      '[FAIL-FAST] Demo config mode must be a string',
    );
    expect(() => parseConfig({ gameType: 'demo', mode: 7 })).toThrow(
      '[FAIL-FAST] Demo config mode must be a string',
    );
    expect(() => parseConfig({ gameType: 'demo', mode: 'create', roomCode: '4321' })).toThrow(
      '[FAIL-FAST] Demo create config must not include a room code',
    );
    expect(() => parseConfig({ gameType: 'demo', mode: 'pause' })).toThrow(
      '[FAIL-FAST] Unknown Demo config mode: pause',
    );
  });

  it('rejects edit routes without a valid room code', () => {
    expect(() => parseConfig({ gameType: 'demo', mode: 'edit' })).toThrow();
    expect(() => parseConfig({ gameType: 'demo', mode: 'edit', roomCode: '12' })).toThrow();
  });
});

const parseGuide = createStandardGuideRouteParser({ gameType: 'demo', displayName: 'Demo' });

const parseGuideWithRole = createStandardGuideRouteParser({
  gameType: 'avalon',
  displayName: 'Avalon',
  extraFields: {
    keys: ['roleId'],
    parse: (params: Readonly<Record<string, unknown>>) => {
      const roleId = params.roleId;
      if (roleId !== undefined && typeof roleId !== 'string') {
        throw new Error('[FAIL-FAST] Avalon guide role must be a string');
      }
      return { roleId };
    },
  },
});

describe('createStandardGuideRouteParser', () => {
  it('parses bare and room guide routes', () => {
    expect(parseGuide({ gameType: 'demo' })).toEqual({ gameType: 'demo', roomCode: undefined });
    expect(parseGuide({ gameType: 'demo', roomCode: '4321' })).toEqual({
      gameType: 'demo',
      roomCode: '4321',
    });
  });

  it('rejects unknown keys and foreign game types', () => {
    expect(() => parseGuide({ gameType: 'demo', roleId: 'x' })).toThrow(
      '[FAIL-FAST] Demo guide route params contain unknown field: roleId',
    );
    expect(() => parseGuide({ gameType: 'werewolf' })).toThrow(
      '[FAIL-FAST] Demo guide received game type werewolf',
    );
    expect(() => parseGuide({ gameType: 'demo', roomCode: '12' })).toThrow();
  });

  it('merges injected extra fields after gameType and roomCode', () => {
    const parsed = parseGuideWithRole({ gameType: 'avalon', roomCode: '1234', roleId: 'merlin' });
    expect(parsed).toEqual({ gameType: 'avalon', roomCode: '1234', roleId: 'merlin' });
    expect(Object.keys(parsed)).toEqual(['gameType', 'roomCode', 'roleId']);
    expect(parseGuideWithRole({ gameType: 'avalon' })).toEqual({
      gameType: 'avalon',
      roomCode: undefined,
      roleId: undefined,
    });
    expect(() => parseGuideWithRole({ gameType: 'avalon', roleId: 42 })).toThrow(
      '[FAIL-FAST] Avalon guide role must be a string',
    );
  });
});
