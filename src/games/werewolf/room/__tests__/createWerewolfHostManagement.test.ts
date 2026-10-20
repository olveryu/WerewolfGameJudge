import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { resolveHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
import type { RoomCapability } from '@/features/room/model/RoomCapabilities';
import { createWerewolfHostManagement } from '@/games/werewolf/room/createWerewolfHostManagement';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';

const deniedCapability: RoomCapability = { isAllowed: false, reason: '不可用' };
const deniedRoomCapabilities = {
  canConfigureGame: deniedCapability,
  canClearSeats: deniedCapability,
  canFillBots: deniedCapability,
  canShareRoom: deniedCapability,
};

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    isHost: true,
    roomStatus: GameStatus.Unseated,
    isPlagueMode: false,
    seatedCount: 0,
    viewedCount: 0,
    totalSeats: 9,
    isAudioPlaying: false,
    isStartingGame: false,
    isHostActionSubmitting: false,
    mvpSeat: null,
    onSelectMvp: jest.fn(),
    canMarkAllBotsViewed: false,
    canMarkAllBotsGroupConfirmed: false,
    capabilities: {
      canConfigureGame: { isAllowed: true as const, execute: jest.fn() },
      canClearSeats: deniedCapability,
      canFillBots: deniedCapability,
      canShareRoom: { isAllowed: true as const, execute: jest.fn() },
    },
    sheriffElection: null,
    onHostControl: jest.fn(),
    onMusicSettings: jest.fn(),
    onMarkAllBotsViewed: jest.fn(),
    onMarkAllBotsGroupConfirmed: jest.fn(),
    onNightReview: jest.fn(),
    onLastNightInfo: jest.fn(),
    ...overrides,
  };
}

function actionLabels(model: NonNullable<ReturnType<typeof createWerewolfHostManagement>>) {
  return model.sections.flatMap((section) => section.actions.map((action) => action.label));
}

function createSheriffElection(
  viewOverrides: Partial<SheriffElectionPanelModel['view']> = {},
  callbacks: Partial<Pick<SheriffElectionPanelModel, 'advance' | 'requestEndBySelfDestruct'>> = {},
): SheriffElectionPanelModel {
  return {
    view: {
      phase: 'registration',
      canAdvance: true,
      advanceLabel: '结束报名',
      phaseTitle: '报名上警',
      phaseDescription: '玩家报名上警',
      candidateRecords: null,
      speakingInstruction: null,
      voteProgress: null,
      myBallot: null,
      candidateOptions: [],
      completedRounds: [],
      finalResult: null,
      canRegister: false,
      canCancelRegistration: false,
      canWithdraw: false,
      canVote: false,
      ...viewOverrides,
    },
    pendingAction: null,
    register: jest.fn().mockResolvedValue(undefined),
    cancelRegistration: jest.fn().mockResolvedValue(undefined),
    withdraw: jest.fn().mockResolvedValue(undefined),
    vote: jest.fn().mockResolvedValue(undefined),
    advance: jest.fn().mockResolvedValue(undefined),
    requestEndBySelfDestruct: jest.fn(),
    ...callbacks,
  };
}

describe('createWerewolfHostManagement', () => {
  it('locks the selected MVP while leaving the terminal flows independent', () => {
    const onSelectMvp = jest.fn();
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        mvpSeat: 2,
        onSelectMvp,
      }),
    );
    const actions = model!.sections.flatMap((section) => section.actions);
    expect(actions.find((action) => action.key === 'select-mvp')).toMatchObject({
      label: '本局 MVP：3号',
      isEnabled: false,
    });
    expect(actions.find((action) => action.key === 'next-round')).toMatchObject({
      isEnabled: true,
    });
    expect(actions.find((action) => action.key === 'return-lobby')).toMatchObject({
      isEnabled: true,
    });
    expect(onSelectMvp).not.toHaveBeenCalled();
  });

  it('routes the ended double-key through the host-control channel by flow', () => {
    const onHostControl = jest.fn();
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        capabilities: deniedRoomCapabilities,
        onHostControl,
      }),
    );
    const actions = model!.sections.flatMap((section) => section.actions);
    const nextRound = actions.find((action) => action.key === 'next-round');
    const returnLobby = actions.find((action) => action.key === 'return-lobby');
    if (nextRound?.isEnabled !== true || returnLobby?.isEnabled !== true) {
      throw new Error('Expected both terminal actions enabled');
    }
    nextRound.onPress();
    expect(onHostControl).toHaveBeenCalledWith('redeal');
    returnLobby.onPress();
    expect(onHostControl).toHaveBeenCalledWith('returnToLobby');
  });

  it('returns null for a non-Host player', () => {
    expect(createWerewolfHostManagement(createInput({ isHost: false }))).toBeNull();
  });

  it('places role assignment and room setup actions in named sections', () => {
    const onHostControl = jest.fn();
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Seated,
        seatedCount: 9,
        onHostControl,
        capabilities: {
          canConfigureGame: { isAllowed: true as const, execute: jest.fn() },
          canClearSeats: { isAllowed: true as const, execute: jest.fn() },
          canFillBots: { isAllowed: true as const, execute: jest.fn() },
          canShareRoom: { isAllowed: true as const, execute: jest.fn() },
        },
      }),
    );

    expect(model).not.toBeNull();
    expect(actionLabels(model!)).toEqual([
      '分配角色',
      '房间设置',
      '填充机器人',
      '清空座位',
      '音乐设置',
    ]);
    const assignRoles = model?.sections[0]?.actions[0];
    if (assignRoles?.isEnabled !== true) throw new Error('Expected enabled role assignment');
    assignRoles.onPress();
    expect(onHostControl).toHaveBeenCalledWith('prepareToFlip');
  });

  it('surfaces sheriff advancement as the current task and keeps restart separate', () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    const sheriffElection = createSheriffElection({}, { advance });
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );

    expect(model?.hasPendingAction).toBe(true);
    expect(actionLabels(model!)).toEqual(['结束报名', '本局复盘', '昨夜信息', '中止本局']);
    const advanceAction = model?.sections[0]?.actions[0];
    if (advanceAction?.isEnabled !== true) throw new Error('Expected enabled sheriff advancement');
    expect(advanceAction.isPrimary).toBe(true);
    advanceAction.onPress();
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['candidateSpeech', true],
    ['runoffSpeech', true],
    ['firstVote', false],
    ['runoffVote', false],
  ] as const)('shows self-destruct only during sheriff speech phase %s', (phase, isVisible) => {
    const requestEndBySelfDestruct = jest.fn();
    const sheriffElection = createSheriffElection(
      { phase, advanceLabel: '推进竞选' },
      { requestEndBySelfDestruct },
    );
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );
    const selfDestructAction = model?.sections
      .flatMap((section) => section.actions)
      .find((action) => action.testID === 'sheriff-self-destruct-button');

    if (!isVisible) {
      expect(selfDestructAction).toBeUndefined();
      return;
    }
    if (selfDestructAction?.isEnabled !== true) {
      throw new Error(`Expected enabled self-destruct action during ${phase}`);
    }
    selfDestructAction.onPress();
    expect(requestEndBySelfDestruct).toHaveBeenCalledTimes(1);
  });

  it('does not invent a start command for plague mode', () => {
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ready,
        isPlagueMode: true,
        capabilities: deniedRoomCapabilities,
      }),
    );

    expect(actionLabels(model!)).not.toContain('开始游戏');
    expect(actionLabels(model!)).toContain('中止本局');
  });

  it.each([GameStatus.Ongoing, GameStatus.Day])(
    'keeps abort available during audio playback in %s',
    (roomStatus) => {
      const onHostControl = jest.fn();
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus,
          isAudioPlaying: true,
          capabilities: deniedRoomCapabilities,
          onHostControl,
        }),
      );
      const abortAction = model?.sections
        .flatMap((section) => section.actions)
        .find((action) => action.label === '中止本局');
      if (abortAction?.isEnabled !== true) {
        throw new Error(`Expected abort during ${roomStatus} audio playback`);
      }

      abortAction.onPress();
      expect(onHostControl).toHaveBeenCalledWith('abort');
    },
  );

  it('presents the terminal double-key in the ended state and includes result tools', () => {
    const onNightReview = jest.fn();
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        capabilities: deniedRoomCapabilities,
        onNightReview,
      }),
    );

    expect(model?.sections.map((section) => section.title)).toEqual([
      '当前流程',
      '赛后管理',
      '辅助工具',
    ]);
    expect(actionLabels(model!)).toEqual([
      '评选 MVP',
      '再来一局',
      '返回大厅',
      '本局复盘',
      '昨夜信息',
      '音乐设置',
    ]);
    const reviewAction = model?.sections
      .flatMap((section) => section.actions)
      .find((action) => action.key === 'night-review');
    if (reviewAction?.isEnabled !== true) throw new Error('Expected enabled post-game review');
    reviewAction.onPress();
    expect(onNightReview).toHaveBeenCalledTimes(1);
  });

  describe('console primary', () => {
    it('carries role assignment in the panel from the unseated state on', () => {
      const model = createWerewolfHostManagement(
        createInput({ roomStatus: GameStatus.Unseated, seatedCount: 0, totalSeats: 9 }),
      );
      expect(actionLabels(model!)).toContain('分配角色');
      const primary = resolveHostConsolePrimary(model!);
      if (primary?.kind !== 'blocked') throw new Error('Expected a blocked console primary');
      expect(primary.reason).toBe('座位尚未坐满（还差 9 人）');
    });

    it('blocks role assignment while seats are open and offers room sharing as the remedy', () => {
      const input = createInput({ roomStatus: GameStatus.Seated, seatedCount: 6, totalSeats: 9 });
      const model = createWerewolfHostManagement(input);
      const primary = resolveHostConsolePrimary(model!);
      expect(primary).toMatchObject({ actionKey: 'assign-roles', label: '分配角色' });
      if (primary?.kind !== 'blocked') throw new Error('Expected a blocked console primary');
      expect(primary.reason).toBe('座位尚未坐满（还差 3 人）');
      expect(primary.remedy?.label).toBe('分享房间');
      primary.remedy?.onPress();
      expect(input.capabilities.canShareRoom.execute).toHaveBeenCalledTimes(1);
      // The panel action itself is disabled with the seat-count reason:
      // availability lives on the descriptor, not in a dialog gate.
      const assignAction = model?.sections
        .flatMap((section) => section.actions)
        .find((action) => action.key === 'assign-roles');
      if (assignAction?.isEnabled !== false) throw new Error('Expected a disabled panel action');
      expect(assignAction.disabledReason).toBe('座位尚未坐满（还差 3 人）');
    });

    it('drops the share remedy when sharing is not allowed', () => {
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Seated,
          seatedCount: 6,
          totalSeats: 9,
          capabilities: deniedRoomCapabilities,
        }),
      );
      const primary = resolveHostConsolePrimary(model!);
      if (primary?.kind !== 'blocked') throw new Error('Expected a blocked console primary');
      expect(primary.remedy).toBeNull();
    });

    it('runs role assignment through the host-control channel once every seat is taken', () => {
      const input = createInput({ roomStatus: GameStatus.Seated, seatedCount: 9, totalSeats: 9 });
      const model = createWerewolfHostManagement(input);
      const primary = resolveHostConsolePrimary(model!);
      if (primary?.kind !== 'ready') throw new Error('Expected a ready console primary');
      primary.onPress();
      expect(input.onHostControl).toHaveBeenCalledWith('prepareToFlip');
    });

    it('offers game start once roles are assigned, except in plague mode', () => {
      const input = createInput({ roomStatus: GameStatus.Ready });
      const model = createWerewolfHostManagement(input);
      const primary = resolveHostConsolePrimary(model!);
      expect(primary).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
      if (primary?.kind !== 'ready') throw new Error('Expected a ready console primary');
      primary.onPress();
      expect(input.onHostControl).toHaveBeenCalledWith('startGame');

      const plague = createWerewolfHostManagement(
        createInput({ roomStatus: GameStatus.Ready, isPlagueMode: true }),
      );
      expect(resolveHostConsolePrimary(plague!)).toBeNull();
    });

    it('carries the viewing count as the Assigned start reason, exactly once on the console', () => {
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Assigned,
          seatedCount: 9,
          viewedCount: 4,
          totalSeats: 9,
        }),
      );
      const primary = resolveHostConsolePrimary(model!);
      expect(primary).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
      if (primary?.kind !== 'blocked') throw new Error('Expected a blocked console primary');
      expect(primary.reason).toBe('4/9 位玩家已查看角色，等待剩余玩家');
      // The same sentence is the panel action's disabledReason, and the
      // panel renders no caption for a primary — the console is its only
      // rendered surface.
      const startAction = model?.sections
        .flatMap((section) => section.actions)
        .find((action) => action.key === 'start-game');
      expect(startAction).toMatchObject({
        isEnabled: false,
        isPrimary: true,
        disabledReason: '4/9 位玩家已查看角色，等待剩余玩家',
      });
    });

    it('clears the Assigned start reason once every player has viewed', () => {
      const input = createInput({
        roomStatus: GameStatus.Assigned,
        seatedCount: 9,
        viewedCount: 9,
        totalSeats: 9,
      });
      const model = createWerewolfHostManagement(input);
      const startAction = model?.sections
        .flatMap((section) => section.actions)
        .find((action) => action.key === 'start-game');
      if (startAction?.isEnabled !== true) {
        throw new Error('Expected an enabled start action once all players viewed');
      }
      const primary = resolveHostConsolePrimary(model!);
      if (primary?.kind !== 'ready') throw new Error('Expected a ready console primary');
      primary.onPress();
      expect(input.onHostControl).toHaveBeenCalledWith('startGame');
    });

    it('suppresses the console primary while a host action is submitting', () => {
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Seated,
          seatedCount: 9,
          isHostActionSubmitting: true,
        }),
      );
      expect(resolveHostConsolePrimary(model!)).toBeNull();
    });
  });
});
