import { isWerewolfLocalBotSeat } from '../isWerewolfLocalBotSeat';
import type { LocalGameState } from '../LocalGameState';

function stateWithPlayers(
  players: ReadonlyMap<number, { readonly isBot: boolean } | null>,
): LocalGameState {
  return { players } as unknown as LocalGameState;
}

describe('isWerewolfLocalBotSeat', () => {
  it('is true only for seats occupied by a bot', () => {
    const state = stateWithPlayers(
      new Map([
        [0, { isBot: true }],
        [1, { isBot: false }],
        [2, null],
      ]),
    );
    expect(isWerewolfLocalBotSeat(state, 0)).toBe(true);
    expect(isWerewolfLocalBotSeat(state, 1)).toBe(false);
    expect(isWerewolfLocalBotSeat(state, 2)).toBe(false);
    expect(isWerewolfLocalBotSeat(state, 9)).toBe(false);
  });

  it('is false without state', () => {
    expect(isWerewolfLocalBotSeat(null, 0)).toBe(false);
  });
});
