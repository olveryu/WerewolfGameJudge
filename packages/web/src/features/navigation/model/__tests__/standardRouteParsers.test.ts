import {
  createStandardConfigRouteParser,
  createStandardGuideRouteParser,
} from '../standardRouteParsers';

const parseConfig = createStandardConfigRouteParser({
  gameType: 'avalon',
  displayName: 'Avalon',
});

const parseWerewolfLikeConfig = createStandardConfigRouteParser({
  gameType: 'werewolf',
  displayName: 'Werewolf',
  extraRoomCodeModes: ['nominate'],
});

describe('createStandardConfigRouteParser', () => {
  it('parses create and edit routes with stable key order', () => {
    expect(parseConfig({ gameType: 'avalon', mode: 'create' })).toEqual({
      gameType: 'avalon',
      mode: 'create',
    });
    const edit = parseConfig({ gameType: 'avalon', mode: 'edit', roomCode: '4321' });
    expect(edit).toEqual({ gameType: 'avalon', mode: 'edit', roomCode: '4321' });
    expect(Object.keys(edit)).toEqual(['gameType', 'mode', 'roomCode']);
  });

  it('parses extra room-code modes for games that declare them', () => {
    expect(
      parseWerewolfLikeConfig({ gameType: 'werewolf', mode: 'nominate', roomCode: '2468' }),
    ).toEqual({ gameType: 'werewolf', mode: 'nominate', roomCode: '2468' });
    expect(() => parseConfig({ gameType: 'avalon', mode: 'nominate', roomCode: '2468' })).toThrow(
      '[FAIL-FAST] Unknown Avalon config mode: nominate',
    );
  });

  it('rejects non-object params, unknown keys, and foreign game types', () => {
    expect(() => parseConfig(null)).toThrow(
      '[FAIL-FAST] Avalon config route params must be an object',
    );
    expect(() => parseConfig({ gameType: 'avalon', mode: 'create', unexpected: 1 })).toThrow(
      '[FAIL-FAST] Avalon config route params contain unknown field: unexpected',
    );
    expect(() => parseConfig({ gameType: 'werewolf', mode: 'create' })).toThrow(
      '[FAIL-FAST] Avalon config received game type werewolf',
    );
    expect(() => parseConfig({ gameType: 'not-a-game', mode: 'create' })).toThrow();
  });

  it('rejects non-string modes, room codes on create, and unknown modes', () => {
    expect(() => parseConfig({ gameType: 'avalon' })).toThrow(
      '[FAIL-FAST] Avalon config mode must be a string',
    );
    expect(() => parseConfig({ gameType: 'avalon', mode: 7 })).toThrow(
      '[FAIL-FAST] Avalon config mode must be a string',
    );
    expect(() => parseConfig({ gameType: 'avalon', mode: 'create', roomCode: '4321' })).toThrow(
      '[FAIL-FAST] Avalon create config must not include a room code',
    );
    expect(() => parseConfig({ gameType: 'avalon', mode: 'pause' })).toThrow(
      '[FAIL-FAST] Unknown Avalon config mode: pause',
    );
  });

  it('rejects edit routes without a valid room code', () => {
    expect(() => parseConfig({ gameType: 'avalon', mode: 'edit' })).toThrow();
    expect(() => parseConfig({ gameType: 'avalon', mode: 'edit', roomCode: '12' })).toThrow();
  });
});

const parseGuide = createStandardGuideRouteParser({ gameType: 'avalon', displayName: 'Avalon' });

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
    expect(parseGuide({ gameType: 'avalon' })).toEqual({ gameType: 'avalon', roomCode: undefined });
    expect(parseGuide({ gameType: 'avalon', roomCode: '4321' })).toEqual({
      gameType: 'avalon',
      roomCode: '4321',
    });
  });

  it('rejects unknown keys and foreign game types', () => {
    expect(() => parseGuide({ gameType: 'avalon', roleId: 'x' })).toThrow(
      '[FAIL-FAST] Avalon guide route params contain unknown field: roleId',
    );
    expect(() => parseGuide({ gameType: 'werewolf' })).toThrow(
      '[FAIL-FAST] Avalon guide received game type werewolf',
    );
    expect(() => parseGuide({ gameType: 'avalon', roomCode: '12' })).toThrow();
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
