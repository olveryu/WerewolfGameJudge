import {
  FIBKING_GAME_TYPE,
  GAME_TYPES,
  isGameType,
  parseGameType,
  WEREWOLF_GAME_TYPE,
} from '../gameTypes';

describe('game type protocol', () => {
  it('parses every registered game type', () => {
    for (const gameType of GAME_TYPES) {
      expect(isGameType(gameType)).toBe(true);
      expect(parseGameType(gameType)).toBe(gameType);
    }
  });

  it('uses canonical identifiers for every registered game', () => {
    expect(WEREWOLF_GAME_TYPE).toBe('werewolf');
    expect(FIBKING_GAME_TYPE).toBe('fibking');
    expect(GAME_TYPES).toContain(WEREWOLF_GAME_TYPE);
    expect(GAME_TYPES).toContain(FIBKING_GAME_TYPE);
  });

  it.each([undefined, null, '', 'pictionary', 1, {}])('rejects unknown input %p', (value) => {
    expect(isGameType(value)).toBe(false);
    expect(() => parseGameType(value)).toThrow('Unknown game type:');
  });
});
