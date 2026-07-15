import { getWerewolfConfigFlowStart } from '@/games/werewolf/navigation/werewolfConfigFlow';

describe('getWerewolfConfigFlowStart', () => {
  it('starts room creation at the board picker', () => {
    expect(getWerewolfConfigFlowStart({ gameType: 'werewolf', mode: 'create' })).toEqual({
      initialRouteName: 'BoardPicker',
      boardPickerParams: undefined,
      configParams: undefined,
    });
  });

  it('starts room editing at config with the canonical room code', () => {
    expect(
      getWerewolfConfigFlowStart({
        gameType: 'werewolf',
        mode: 'edit',
        roomCode: '1234',
      }),
    ).toEqual({
      initialRouteName: 'Config',
      boardPickerParams: { existingRoomCode: '1234' },
      configParams: { existingRoomCode: '1234' },
    });
  });

  it('starts nomination at the board picker with room ownership intact', () => {
    expect(
      getWerewolfConfigFlowStart({
        gameType: 'werewolf',
        mode: 'nominate',
        roomCode: '5678',
      }),
    ).toEqual({
      initialRouteName: 'BoardPicker',
      boardPickerParams: { nominateMode: { roomCode: '5678' } },
      configParams: { nominateMode: { roomCode: '5678' } },
    });
  });

  it('fails before rendering when a route carries an invalid room code', () => {
    const params = { gameType: 'werewolf', mode: 'edit', roomCode: 'bad' };

    expect(() => getWerewolfConfigFlowStart(params)).toThrow('Invalid room code');
  });

  it('fails before rendering when a route carries an unknown config mode', () => {
    const params = { gameType: 'werewolf', mode: 'unknown' };

    expect(() => getWerewolfConfigFlowStart(params)).toThrow(
      '[FAIL-FAST] Unknown Werewolf config mode: unknown',
    );
  });

  it('rejects a room code that does not belong to create mode', () => {
    expect(() =>
      getWerewolfConfigFlowStart({
        gameType: 'werewolf',
        mode: 'create',
        roomCode: '1234',
      }),
    ).toThrow('[FAIL-FAST] Werewolf create config must not include a room code');
  });

  it('rejects non-object route params at the game boundary', () => {
    expect(() => getWerewolfConfigFlowStart([])).toThrow(
      '[FAIL-FAST] Werewolf config route params must be an object',
    );
  });
});
