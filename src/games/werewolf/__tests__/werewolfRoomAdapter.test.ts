import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import { buildNightPlan } from '@game-judge/game-engine/games/werewolf/public';

import { EMPTY_LAYOUT } from '@/games/werewolf/room/hooks/bottomLayoutConfig';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import type { SeatViewModel } from '@/games/werewolf/room/werewolfRoom.helpers';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import {
  createWerewolfBoardInfoSections,
  createWerewolfBottomActionLayout,
  createWerewolfRoomCapabilities,
  createWerewolfRoomShellModel,
  createWerewolfSeatDataSource,
  deriveWerewolfBottomProgress,
  type WerewolfRoomShellModelInput,
} from '@/games/werewolf/werewolfRoomAdapter';

function createLocalGameState(overrides: Partial<GameState> = {}): LocalGameState {
  return toWerewolfLocalState({
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'ROOM',
    hostUserId: 'HOST',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'witch', 'seer'] as RoleId[],
    players: {
      0: { seat: 0, hasViewedRole: true, role: 'wolf' as RoleId },
      1: { seat: 1, hasViewedRole: true, role: 'witch' as RoleId },
      2: { seat: 2, hasViewedRole: true, role: 'seer' as RoleId },
    },
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {
      0: { seat: 0, userId: 'p0' },
      1: { seat: 1, userId: 'p1' },
      2: { seat: 2, userId: 'p2' },
    },
    playerProfiles: {
      p0: { displayName: 'P1' },
      p1: { displayName: 'P2' },
      p2: { displayName: 'P3' },
    },
    ...overrides,
  });
}

function createCapabilityInput() {
  return {
    status: GameStatus.Unseated,
    isHost: true,
    mySeat: null,
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

  it('derives the night step progress for the bottom progress row', () => {
    const gameState = createLocalGameState();
    const plan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
    const step = plan.steps[1];
    expect(step).toBeDefined();
    expect(deriveWerewolfBottomProgress(step?.stepId ?? null, gameState)).toEqual({
      current: 2,
      total: plan.length,
      label: step?.displayName,
    });
  });

  it('returns no progress without a current night step', () => {
    const gameState = createLocalGameState();
    expect(deriveWerewolfBottomProgress(null, gameState)).toBeNull();
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
          },
        ],
        secondary: [],
        ghost: [],
      },
      isActionSubmitting: false,
      onIntent: jest.fn(),
      onStaticAction,
    });

    expect(layout.primary[0]).toMatchObject({ isEnabled: false });
    expect(layout.primary[0]).not.toHaveProperty('onPress');
    expect(onStaticAction).not.toHaveBeenCalled();
  });

  it('maps a disabled button to its reason only, with no press channel', () => {
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

    expect(button).toMatchObject({
      isEnabled: false,
      disabledReason: '等待房主开始分配角色',
    });
    expect(button).not.toHaveProperty('onPress');
    expect(onStaticAction).not.toHaveBeenCalled();
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
      isAudioPlaying: false,
      isActionSubmitting: false,
      isStartingGame: false,
      isHostActionSubmitting: false,
      imActioner: false,
      isPlagueMode: false,
      seatedCount: 0,
      viewedCount: 0,
      totalSeats: 9,
      actionMessage: null,
      guideMessage: null,
      currentStepId: null,
      gameState: createLocalGameState(),
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

  it('shows the mark-bots action only while a bot seat is unviewed', () => {
    const actionKeys = (model: ReturnType<typeof createWerewolfRoomShellModel>) =>
      model.hostManagement?.sections.flatMap((section) => section.actions).map((a) => a.key) ?? [];
    const botState = (botViewed: boolean) =>
      createLocalGameState({
        status: GameStatus.Assigned,
        players: {
          0: { seat: 0, hasViewedRole: true, role: 'wolf' as RoleId },
          1: { seat: 1, hasViewedRole: true, role: 'witch' as RoleId },
          2: { seat: 2, hasViewedRole: botViewed, role: 'seer' as RoleId },
        },
        roster: {
          0: { seat: 0, userId: 'HOST' },
          1: { seat: 1, userId: 'P2' },
          2: { seat: 2, kind: 'bot' },
        },
      });
    const unviewed = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        hasBots: true,
        roomStatus: GameStatus.Assigned,
        gameState: botState(false),
      }),
    );
    expect(actionKeys(unviewed)).toContain('mark-bots-viewed');
    const allViewed = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        hasBots: true,
        roomStatus: GameStatus.Assigned,
        gameState: botState(true),
      }),
    );
    expect(actionKeys(allViewed)).not.toContain('mark-bots-viewed');
    // An unviewed human does not bring the action back: it exists only
    // for unviewed bot seats.
    const humanUnviewedBotViewed = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        hasBots: true,
        roomStatus: GameStatus.Assigned,
        gameState: createLocalGameState({
          status: GameStatus.Assigned,
          players: {
            0: { seat: 0, hasViewedRole: true, role: 'wolf' as RoleId },
            1: { seat: 1, hasViewedRole: false, role: 'witch' as RoleId },
            2: { seat: 2, hasViewedRole: true, role: 'seer' as RoleId },
          },
          roster: {
            0: { seat: 0, userId: 'HOST' },
            1: { seat: 1, userId: 'P2' },
            2: { seat: 2, kind: 'bot' },
          },
        }),
      }),
    );
    expect(actionKeys(humanUnviewedBotViewed)).not.toContain('mark-bots-viewed');
  });

  it('surfaces the controlled-seat banner only while a takeover is active', () => {
    // While a takeover is active the banner always shows: the release entry
    // must never vanish, whatever the other inputs say.
    const visible = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        hasBots: true,
        roomStatus: GameStatus.Ongoing,
        controlledSeat: 2,
        controlledBotName: '机器人乙',
      }),
    );
    expect(visible.controlledSeat).toMatchObject({ seat: 2, displayName: '机器人乙' });
    expect(typeof visible.controlledSeat?.onRelease).toBe('function');
    const controlledNoBots = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        hasBots: false,
        roomStatus: GameStatus.Ongoing,
        controlledSeat: 2,
        controlledBotName: '机器人乙',
      }),
    );
    expect(controlledNoBots.controlledSeat).toMatchObject({ seat: 2 });

    // No active takeover: no banner, whatever the host or bot inputs say.
    const hostWithBots = createWerewolfRoomShellModel(
      createShellModelInput({
        isHost: true,
        hasBots: true,
        roomStatus: GameStatus.Unseated,
        controlledSeat: null,
      }),
    );
    expect(hostWithBots.controlledSeat).toBeNull();

    const hostNoBots = createWerewolfRoomShellModel(
      createShellModelInput({ isHost: true, hasBots: false, controlledSeat: null }),
    );
    expect(hostNoBots.controlledSeat).toBeNull();

    const guestWithBots = createWerewolfRoomShellModel(
      createShellModelInput({ isHost: false, hasBots: true, controlledSeat: null }),
    );
    expect(guestWithBots.controlledSeat).toBeNull();
  });

  it('shows the non-host guide as the bottom message when no action message applies', () => {
    const seated = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Seated,
        guideMessage: '等待所有玩家入座',
      }),
    );
    expect(seated.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '等待所有玩家入座',
    });

    const ended = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ended,
        guideMessage: '天亮了 → 昨夜信息/本局复盘由房主操作',
      }),
    );
    expect(ended.bottomActions).toMatchObject({
      kind: 'info',
      message: '天亮了 → 昨夜信息/本局复盘由房主操作',
    });
  });

  it('shows the day host wait as the bottom message on a no-election day (G-3)', () => {
    const day = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Day,
        sheriffElectionPanel: null,
        guideMessage: '白天阶段，等待房主主持推进',
      }),
    );
    expect(day.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '白天阶段，等待房主主持推进',
    });

    // An actioner on the day (a death-triggered skill window) still
    // reads their own action message, not the host wait.
    const actioner = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Day,
        sheriffElectionPanel: null,
        imActioner: true,
        actionMessage: '请选择要开枪的目标',
        guideMessage: '白天阶段，等待房主主持推进',
      }),
    );
    expect(actioner.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '请选择要开枪的目标',
    });
  });

  it('falls back to the guide at Ended when the action message is an empty string', () => {
    // Live, useRoomDerived yields '' (not null) once no action role remains;
    // the Ended settlement line must still surface.
    const ended = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ended,
        actionMessage: '',
        guideMessage: '天亮了 → 昨夜信息/本局复盘由房主操作',
      }),
    );
    expect(ended.bottomActions).toMatchObject({
      kind: 'info',
      message: '天亮了 → 昨夜信息/本局复盘由房主操作',
    });
  });

  it('carries the night progress in the stacked bottom model', () => {
    const gameState = createLocalGameState();
    const plan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
    const step = plan.steps[0];
    const model = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ongoing,
        gameState,
        currentStepId: step?.stepId ?? null,
      }),
    );
    expect(model.bottomActions).toMatchObject({
      kind: 'stacked',
      progress: { current: 1, total: plan.length, label: step?.displayName },
    });
  });

  it('tells a non-actioner at night whose step the room is waiting for, from the same progress', () => {
    const gameState = createLocalGameState();
    const plan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
    const step = plan.steps[0];
    const model = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ongoing,
        gameState,
        currentStepId: step?.stepId ?? null,
      }),
    );
    expect(model.bottomActions).toMatchObject({
      kind: 'stacked',
      message: `正在等待 ${step?.displayName} 行动`,
      progress: { label: step?.displayName },
    });
  });

  it('keeps the action message for the current night actioner', () => {
    const gameState = createLocalGameState();
    const plan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
    const step = plan.steps[0];
    const model = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ongoing,
        gameState,
        currentStepId: step?.stepId ?? null,
        imActioner: true,
        actionMessage: '请选择要袭击的玩家',
      }),
    );
    expect(model.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '请选择要袭击的玩家',
    });
  });

  it('scopes the night waiting sentence to non-actioners, including during audio', () => {
    const gameState = createLocalGameState();
    const plan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
    const step = plan.steps[0];
    // The actioner does not read a wait sentence about their own step,
    // not even while the step narration audio is playing.
    const actionerAudio = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ongoing,
        gameState,
        currentStepId: step?.stepId ?? null,
        imActioner: true,
        isAudioPlaying: true,
        actionMessage: '请选择要袭击的玩家',
      }),
    );
    expect(actionerAudio.bottomActions).toMatchObject({ kind: 'stacked', message: null });
    // Non-actioners keep the waiting sentence during audio.
    const watcherAudio = createWerewolfRoomShellModel(
      createShellModelInput({
        roomStatus: GameStatus.Ongoing,
        gameState,
        currentStepId: step?.stepId ?? null,
        isAudioPlaying: true,
      }),
    );
    expect(watcherAudio.bottomActions).toMatchObject({
      kind: 'stacked',
      message: `正在等待 ${step?.displayName} 行动`,
    });
  });
});

describe('createWerewolfBoardInfoSections', () => {
  const godItems = [{ roleId: 'seer', displayName: '预言家', count: 1 }];
  const villagerRoleItems = [{ roleId: 'hunter', displayName: '猎人', count: 0 }];

  it('orders the four sections and passes item lists through', () => {
    const sections = createWerewolfBoardInfoSections({
      wolfRoleItems: [{ roleId: 'werewolf', displayName: '狼人', count: 4 }],
      godRoleItems: godItems,
      specialRoleItems: [],
      villagerRoleItems: [],
      villagerCount: 0,
    });
    expect(sections.map((section) => section.title)).toEqual(['狼人', '神职', '特殊', '村民']);
    expect(sections[1]?.items).toBe(godItems);
  });

  it('prepends the plain villager item only when villagerCount is positive', () => {
    const withVillagers = createWerewolfBoardInfoSections({
      wolfRoleItems: [],
      godRoleItems: [],
      specialRoleItems: [],
      villagerRoleItems,
      villagerCount: 3,
    });
    expect(withVillagers[3]?.items).toEqual([
      { roleId: 'villager', displayName: '村民', count: 3 },
      ...villagerRoleItems,
    ]);
    const without = createWerewolfBoardInfoSections({
      wolfRoleItems: [],
      godRoleItems: [],
      specialRoleItems: [],
      villagerRoleItems,
      villagerCount: 0,
    });
    expect(without[3]?.items).toBe(villagerRoleItems);
  });
});
