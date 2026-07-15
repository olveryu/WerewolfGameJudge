import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { SeatViewModel } from '@/games/werewolf/room/werewolfRoom.helpers';
import {
  createWerewolfBottomActionLayout,
  createWerewolfRoomCapabilities,
  createWerewolfSeatDataSource,
  createWerewolfStatusRibbon,
} from '@/games/werewolf/werewolfRoomAdapter';

function createCapabilityInput() {
  return {
    status: GameStatus.Unseated,
    isHost: true,
    mySeat: null,
    isDebugMode: true,
    isAudioPlaying: false,
    hasOccupiedSeats: true,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    requestLeaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    openProfile: jest.fn(),
    takeOverBot: jest.fn(),
    shareRoom: jest.fn(),
  };
}

describe('werewolfRoomAdapter', () => {
  it('removes execute from capabilities that are not allowed', () => {
    const capabilities = createWerewolfRoomCapabilities({
      ...createCapabilityInput(),
      isHost: false,
      status: GameStatus.Ongoing,
    });

    expect(capabilities.canKickSeat).toEqual({
      isAllowed: false,
      reason: '当前阶段不能移出座位',
    });
    expect('execute' in capabilities.canKickSeat).toBe(false);
    expect('execute' in capabilities.canConfigureGame).toBe(false);
  });

  it('binds shared setup capabilities to the shared room controllers', () => {
    const input = createCapabilityInput();
    const capabilities = createWerewolfRoomCapabilities(input);
    expect(capabilities.canTakeSeat.isAllowed).toBe(true);
    expect(capabilities.canFillBots.isAllowed).toBe(true);
    expect(capabilities.canShareRoom.isAllowed).toBe(true);

    if (!capabilities.canTakeSeat.isAllowed || !capabilities.canShareRoom.isAllowed) {
      throw new Error('Expected Werewolf setup capabilities to be executable');
    }
    capabilities.canTakeSeat.execute(2);
    capabilities.canShareRoom.execute();
    expect(input.requestTakeSeat).toHaveBeenCalledWith(2);
    expect(input.shareRoom).toHaveBeenCalledTimes(1);
  });

  it('maps Werewolf-only role data into a neutral lazy seat model', () => {
    const seats: SeatViewModel[] = [
      {
        seat: 0,
        role: 'seer',
        player: {
          userId: 'bot-0',
          displayName: '机器人',
          isBot: true,
          role: 'seer',
        },
        isMySpot: false,
        isWolf: false,
        isSelected: true,
      },
    ];
    const source = createWerewolfSeatDataSource({
      seats,
      controlledSeat: null,
      showBotRoles: true,
      showLevels: false,
      decorationsEnabled: false,
      revision: 1,
    });

    expect(source.getSeat(0)).toMatchObject({
      highlight: 'selected',
      secondaryLabel: '预言家',
      player: { kind: 'bot' },
    });
    expect(() => source.getSeat(1)).toThrow('Werewolf seat source is not contiguous');
  });

  it('preserves the Werewolf status priority before rendering shared UI', () => {
    expect(
      createWerewolfStatusRibbon({
        nightProgress: { current: 2, total: 8, roleName: '狼人' },
        speakingOrderText: '1号发言',
        guideMessage: '等待玩家',
      }),
    ).toEqual({ kind: 'progress', current: 2, total: 8, label: '狼人' });
  });

  it('does not expose a second submit callback while a host action is disabled', () => {
    const onStaticAction = jest.fn();
    const layout = createWerewolfBottomActionLayout({
      layout: {
        primary: [
          {
            key: 'startGame',
            label: '开始游戏',
            variant: 'primary',
            size: 'lg',
            action: 'startGame',
            disabled: true,
            fireWhenDisabled: true,
          },
        ],
        secondary: [],
        ghost: [],
      },
      onIntent: jest.fn(),
      onStaticAction,
    });

    expect(layout.primary[0]).toMatchObject({
      isEnabled: false,
      onDisabledPress: null,
    });
    expect(onStaticAction).not.toHaveBeenCalled();
  });
});
