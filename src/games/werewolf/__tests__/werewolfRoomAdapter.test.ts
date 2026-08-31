import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
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
    leaveSeat: jest.fn(),
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
    expect(capabilities.canShareRoom.isAllowed).toBe(false);
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

  it('executes profile leave and kick directly through the shared capabilities', () => {
    const input = { ...createCapabilityInput(), status: GameStatus.Seated, mySeat: 0 };
    const capabilities = createWerewolfRoomCapabilities(input);
    if (!capabilities.canLeaveSeat.isAllowed || !capabilities.canKickSeat.isAllowed) {
      throw new Error('Expected Werewolf profile seat operations to be executable');
    }

    capabilities.canLeaveSeat.execute();
    capabilities.canKickSeat.execute(2);

    expect(input.leaveSeat).toHaveBeenCalledTimes(1);
    expect(input.kickSeat).toHaveBeenCalledWith(2);
  });

  it('treats the sheriff election as an active game for profile visibility', () => {
    const capabilities = createWerewolfRoomCapabilities({
      ...createCapabilityInput(),
      status: GameStatus.Day,
      mySeat: 0,
    });

    expect(capabilities.canViewProfiles).toEqual({
      isAllowed: false,
      reason: '游戏进行中不能查看玩家资料',
    });
    expect(capabilities.canTakeOverBots.isAllowed).toBe(true);
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
      sheriffElectionView: null,
      revision: 1,
    });

    expect(source.getSeat(0)).toMatchObject({
      highlight: 'selected',
      secondaryLabel: '预言家',
      player: { kind: 'bot' },
    });
    expect(() => source.getSeat(1)).toThrow('Werewolf seat source is not contiguous');
  });

  it('derives public sheriff markers without exposing registration identities', () => {
    const seats: SeatViewModel[] = Array.from({ length: 4 }, (_, seat) => ({
      seat,
      role: 'villager',
      player: {
        userId: `user-${seat}`,
        displayName: `玩家${seat + 1}`,
        isBot: false,
        role: 'villager',
      },
      isMySpot: seat === 0,
      isWolf: false,
      isSelected: false,
    }));
    const registrationView: SheriffElectionViewModel = {
      phase: 'registration',
      phaseTitle: '报名上警',
      phaseDescription: '玩家可报名',
      candidateRecords: null,
      speakingOrder: [],
      voteProgress: null,
      myBallot: null,
      candidateOptions: [],
      completedRounds: [],
      finalResult: null,
      canRegister: false,
      canCancelRegistration: true,
      canWithdraw: false,
      canVote: false,
      canAdvance: false,
      advanceLabel: null,
    };
    const createSource = (sheriffElectionView: SheriffElectionViewModel) =>
      createWerewolfSeatDataSource({
        seats,
        controlledSeat: null,
        showBotRoles: false,
        showLevels: false,
        decorationsEnabled: false,
        sheriffElectionView,
        revision: 1,
      });

    expect(createSource(registrationView).getSeat(0).statusBadge).toBeNull();

    const speechSource = createSource({
      ...registrationView,
      phase: 'candidateSpeech',
      phaseTitle: '竞选发言',
      candidateRecords: {
        registeredSeats: [0, 1, 2],
        withdrawnSeats: [2],
        activeCandidateSeats: [0, 1],
      },
      speakingOrder: [0, 1],
      canCancelRegistration: false,
    });
    expect(speechSource.getSeat(0).statusBadge).toEqual({ label: '上警', tone: 'primary' });
    expect(speechSource.getSeat(1)).toMatchObject({
      statusBadge: { label: '上警', tone: 'primary' },
      isStatusEmphasized: false,
    });
    expect(speechSource.getSeat(2).statusBadge).toEqual({ label: '退水', tone: 'muted' });

    const runoffSource = createSource({
      ...registrationView,
      phase: 'runoffVote',
      phaseTitle: '平票投票',
      candidateRecords: {
        registeredSeats: [0, 1, 2],
        withdrawnSeats: [2],
        activeCandidateSeats: [0, 1],
      },
      voteProgress: { submittedCount: 0, eligibleCount: 2 },
    });
    expect(runoffSource.getSeat(0).statusBadge).toEqual({ label: 'PK', tone: 'warning' });
  });

  it('preserves the Werewolf status priority before rendering shared UI', () => {
    expect(
      createWerewolfStatusRibbon({
        nightProgress: { current: 2, total: 8, roleName: '狼人' },
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
            isEnabled: false,
            disabledReason: null,
            onDisabledBehavior: null,
          },
        ],
        secondary: [],
        ghost: [],
      },
      isActionSubmitting: false,
      onIntent: jest.fn(),
      onStaticAction,
    });

    expect(layout.primary[0]).toMatchObject({
      isEnabled: false,
      onDisabledPress: null,
    });
    expect(onStaticAction).not.toHaveBeenCalled();
  });

  it('maps explicit disabled feedback without inventing an enabled action', () => {
    const onStaticAction = jest.fn();
    const layout = createWerewolfBottomActionLayout({
      layout: {
        primary: [
          {
            key: 'waitForHost',
            label: '等待房主开始',
            variant: 'primary',
            size: 'lg',
            isEnabled: false,
            disabledReason: '等待房主开始分配角色',
            onDisabledBehavior: { kind: 'static', action: 'waitForHost' },
          },
        ],
        secondary: [],
        ghost: [],
      },
      isActionSubmitting: false,
      onIntent: jest.fn(),
      onStaticAction,
    });
    const button = layout.primary[0]!;

    if (button.isEnabled || button.onDisabledPress === null) {
      throw new Error('Expected explicit Werewolf disabled feedback');
    }
    button.onDisabledPress();

    expect(onStaticAction).toHaveBeenCalledWith('waitForHost');
  });

  it('locks an action intent while its authoritative result is pending', () => {
    const onIntent = jest.fn();
    const layout = createWerewolfBottomActionLayout({
      layout: {
        primary: [
          {
            key: 'skip',
            label: '跳过',
            variant: 'primary',
            size: 'lg',
            isEnabled: true,
            behavior: { kind: 'intent', intent: { type: 'skip', targetSeat: -1 } },
          },
        ],
        secondary: [],
        ghost: [],
      },
      isActionSubmitting: true,
      onIntent,
      onStaticAction: jest.fn(),
    });

    expect(layout.primary[0]).toMatchObject({
      isEnabled: false,
      disabledReason: '行动正在确认中',
      onDisabledPress: null,
    });
    expect(onIntent).not.toHaveBeenCalled();
  });
});
