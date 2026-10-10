import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { EMPTY_LAYOUT } from '@/games/werewolf/room/hooks/bottomLayoutConfig';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import type { SeatViewModel } from '@/games/werewolf/room/werewolfRoom.helpers';
import {
  createWerewolfBottomActionLayout,
  createWerewolfRoomCapabilities,
  createWerewolfRoomShellModel,
  createWerewolfSeatDataSource,
  createWerewolfStatusRibbon,
  type WerewolfRoomShellModelInput,
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
      speakingInstruction: null,
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
      speakingInstruction: '从 1号开始，顺时针发言',
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

describe('createWerewolfRoomShellModel', () => {
  function createShellModelInput(
    overrides: Partial<WerewolfRoomShellModelInput> = {},
  ): WerewolfRoomShellModelInput {
    return {
      roomCode: '1234',
      capabilities: createWerewolfRoomCapabilities(createCapabilityInput()),
      connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
      seatConfirmation: null,
      profile: null,
      share: {
        isVisible: false,
        roomCode: '1234',
        roomUrl: 'https://example.test/room/1234',
        open: jest.fn(),
        close: jest.fn(),
        copyLink: jest.fn(),
        shareImage: jest.fn(),
      },
      user: { id: 'user-1' },
      ticketCount: null,
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      onAvatarPress: jest.fn(),
      roomStatus: GameStatus.Ready,
      isHost: false,
      isDebugMode: false,
      isAudioPlaying: false,
      isActionSubmitting: false,
      isStartingGame: false,
      isHostActionSubmitting: false,
      imActioner: false,
      isPlagueMode: false,
      actionMessage: null,
      guideMessage: null,
      nightProgress: null,
      seatViewModels: [],
      controlledSeat: null,
      sheriffElectionPanel: null,
      stateRevision: 1,
      onSeatPress: jest.fn(),
      onSeatLongPressed: jest.fn(),
      hasBots: false,
      controlledBotName: null,
      onReleaseBot: jest.fn(),
      mvpSeat: null,
      onSelectMvp: jest.fn(),
      currentSchemaKind: null,
      onHostControl: jest.fn(),
      onMusicSettings: jest.fn(),
      onMarkAllBotsViewed: jest.fn(),
      onMarkAllBotsGroupConfirmed: jest.fn(),
      onNightReview: jest.fn(),
      onLastNightInfo: jest.fn(),
      bottomLayout: EMPTY_LAYOUT,
      onSchemaButtonPress: jest.fn(),
      onStaticButtonPress: jest.fn(),
      isSheriffInspectorVisible: false,
      openSheriffDetails: jest.fn(),
      ...overrides,
    };
  }

  it('shows the action message only for the current actioner while audio is silent', () => {
    const acting = createWerewolfRoomShellModel(
      createShellModelInput({ imActioner: true, actionMessage: '请选择要查验的玩家' }),
    );
    expect(acting.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '请选择要查验的玩家',
    });

    const watching = createWerewolfRoomShellModel(createShellModelInput());
    expect(watching.bottomActions).toMatchObject({ kind: 'stacked', message: null });

    const audioPlaying = createWerewolfRoomShellModel(
      createShellModelInput({
        imActioner: true,
        isAudioPlaying: true,
        actionMessage: '请选择要查验的玩家',
      }),
    );
    expect(audioPlaying.bottomActions).toMatchObject({ kind: 'stacked', message: null });
  });

  it('shows the plague-mode host message in Ready regardless of actioner state', () => {
    const model = createWerewolfRoomShellModel(
      createShellModelInput({ isHost: true, isPlagueMode: true }),
    );
    expect(model.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '黑死病模式 — 已发牌，请由房主担任真人法官主持后续流程',
    });
  });

  it('flattens the bottom layout into a single info action list when the game ended', () => {
    const button = (key: string, label: string) =>
      ({
        key,
        label,
        variant: 'secondary',
        size: 'md',
        isEnabled: true,
        behavior: { kind: 'static', action: 'viewRole' },
      }) as const;
    const model = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ended,
        actionMessage: '对局结束',
        bottomLayout: {
          primary: [button('p1', '主操作')],
          secondary: [button('s1', '次操作')],
          ghost: [button('g1', '幽灵操作')],
        },
      }),
    );
    expect(model.bottomActions.kind).toBe('info');
    if (model.bottomActions.kind === 'info') {
      expect(model.bottomActions.message).toBe('对局结束');
      expect(model.bottomActions.actions.map((a) => a.key)).toEqual(['p1', 's1', 'g1']);
    }
  });

  it('disables the seat board visually during host audio or action submission', () => {
    const audio = createWerewolfRoomShellModel(
      createShellModelInput({ roomStatus: GameStatus.Ongoing, isAudioPlaying: true }),
    );
    expect(audio.seats.visuallyDisabled).toBe(true);

    const submitting = createWerewolfRoomShellModel(
      createShellModelInput({ isActionSubmitting: true }),
    );
    expect(submitting.seats.visuallyDisabled).toBe(true);

    const idle = createWerewolfRoomShellModel(createShellModelInput());
    expect(idle.seats.visuallyDisabled).toBe(false);
  });

  it('gates the bot-seat long press on the takeover capability', () => {
    const onSeatLongPressed = jest.fn();
    const allowed = createWerewolfRoomShellModel(createShellModelInput({ onSeatLongPressed }));
    expect(allowed.seats.onBotSeatLongPress).toBe(onSeatLongPressed);

    // Under the unified takeover rule the only denial is not being host:
    // phase, debug mode, and audio no longer gate the long press.
    const deniedCapabilities = createWerewolfRoomCapabilities({
      ...createCapabilityInput(),
      isHost: false,
      status: GameStatus.Ongoing,
      isDebugMode: false,
    });
    const denied = createWerewolfRoomShellModel(
      createShellModelInput({ capabilities: deniedCapabilities, onSeatLongPressed }),
    );
    expect(denied.seats.onBotSeatLongPress).toBeNull();
  });

  it('builds host management only for the host', () => {
    const guest = createWerewolfRoomShellModel(createShellModelInput({ isHost: false }));
    expect(guest.hostManagement).toBeNull();

    const host = createWerewolfRoomShellModel(createShellModelInput({ isHost: true }));
    expect(host.hostManagement).not.toBeNull();
  });

  it('surfaces the controlled-seat banner only when every visibility condition holds', () => {
    const visible = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        isDebugMode: true,
        hasBots: true,
        roomStatus: GameStatus.Ongoing,
        controlledSeat: 2,
        controlledBotName: '机器人乙',
      }),
    );
    expect(visible.controlledSeat).toMatchObject({
      kind: 'controlled',
      seat: 2,
      displayName: '机器人乙',
    });
    if (visible.controlledSeat?.kind === 'controlled') {
      expect(typeof visible.controlledSeat.onRelease).toBe('function');
    }

    const noBots = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        isDebugMode: true,
        hasBots: false,
        roomStatus: GameStatus.Ongoing,
        controlledSeat: 2,
        controlledBotName: '机器人乙',
      }),
    );
    expect(noBots.controlledSeat).toBeNull();

    const visibleBase = {
      isHost: true,
      isDebugMode: true,
      hasBots: true,
      roomStatus: GameStatus.Ongoing,
      controlledSeat: 2,
      controlledBotName: '机器人乙',
    } as const;
    for (const flip of [
      { roomStatus: GameStatus.Unseated },
      { roomStatus: GameStatus.Seated },
      { isHost: false },
      { isDebugMode: false },
    ]) {
      const model = createWerewolfRoomShellModel(
        createShellModelInput({ ...visibleBase, ...flip }),
      );
      expect(model.controlledSeat).toBeNull();
    }
  });
});
