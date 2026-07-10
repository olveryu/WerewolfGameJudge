import { GAME_TYPES, isGameType, parseGameType, WEREWOLF_GAME_TYPE } from '../gameTypes';

describe('game type protocol', () => {
  it('parses every registered game type', () => {
    for (const gameType of GAME_TYPES) {
      expect(isGameType(gameType)).toBe(true);
      expect(parseGameType(gameType)).toBe(gameType);
    }
  });

  it('uses the canonical Werewolf identifier', () => {
    expect(WEREWOLF_GAME_TYPE).toBe('werewolf');
    expect(GAME_TYPES).toContain(WEREWOLF_GAME_TYPE);
  });

  it.each([undefined, null, '', 'fibking', 1, {}])('rejects unknown input %p', (value) => {
    expect(isGameType(value)).toBe(false);
    expect(() => parseGameType(value)).toThrow('Unknown game type:');
  });
});
