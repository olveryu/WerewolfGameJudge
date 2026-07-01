import { FIB_GAME_TYPE, type FibState } from '@werewolf/game-engine/fibking/types';

import { createFibSeatViewModels, isFibBotUserId } from '../fibRoomView';

function createState(): FibState {
  return {
    gameType: FIB_GAME_TYPE,
    roomCode: '1234',
    hostUserId: 'host-1',
    phase: 'Playing',
    numberOfPlayers: 4,
    seats: {
      0: { userId: 'host-1', seat: 0 },
      1: { userId: 'bot-1', seat: 1 },
    },
    roster: {
      'host-1': { displayName: '房主' },
      'bot-1': { displayName: '机器人2号' },
    },
    word: '踟蹰',
    definition: '徘徊不前',
    roleBySeat: {
      0: 'honest',
      1: 'fibber',
    },
    wordSource: 'fallback',
    usedWords: [],
  };
}

describe('fibRoomView', () => {
  it('marks bot seats and keeps hidden roles out of public status badges', () => {
    const seatViewModels = createFibSeatViewModels(createState(), 0);

    expect(seatViewModels).toHaveLength(4);

    const botSeat = seatViewModels[1];
    if (!botSeat) throw new Error('fibRoomView test: missing bot seat view model');

    expect(botSeat.player).toMatchObject({
      userId: 'bot-1',
      displayName: '机器人2号',
      isBot: true,
      botRoleLabel: '瞎掰王',
    });
    expect(botSeat.statusBadgeText).toBeUndefined();
  });

  it('recognizes fib bot user ids', () => {
    expect(isFibBotUserId('bot-3')).toBe(true);
    expect(isFibBotUserId('user-3')).toBe(false);
  });
});
