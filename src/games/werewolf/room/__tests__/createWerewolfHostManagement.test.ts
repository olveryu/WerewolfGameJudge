import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { RoomCapability } from '@/features/room/model/RoomCapabilities';
import { createWerewolfHostManagement } from '@/games/werewolf/room/createWerewolfHostManagement';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';

const deniedCapability: RoomCapability = { isAllowed: false, reason: '不可用' };
const deniedRoomCapabilities = {
  canConfigureGame: deniedCapability,
  canClearSeats: deniedCapability,
  canFillBots: deniedCapability,
};

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    isHost: true,
    roomStatus: GameStatus.Unseated,
    isPlagueMode: false,
    isAudioPlaying: false,
    isStartingGame: false,
    isHostActionSubmitting: false,
    isDebugMode: false,
    canMarkAllBotsViewed: false,
    canMarkAllBotsGroupConfirmed: false,
    capabilities: {
      canConfigureGame: { isAllowed: true as const, execute: jest.fn() },
      canClearSeats: deniedCapability,
      canFillBots: deniedCapability,
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
  it('returns null for a non-Host player', () => {
    expect(createWerewolfHostManagement(createInput({ isHost: false }))).toBeNull();
  });

  it('places role assignment and room setup actions in named sections', () => {
    const onHostControl = jest.fn();
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Seated,
        onHostControl,
        capabilities: {
          canConfigureGame: { isAllowed: true as const, execute: jest.fn() },
          canClearSeats: { isAllowed: true as const, execute: jest.fn() },
          canFillBots: { isAllowed: true as const, execute: jest.fn() },
        },
      }),
    );

    expect(model).not.toBeNull();
    expect(model?.preview).toBe('下一步：分配角色');
    expect(actionLabels(model!)).toEqual([
      '分配角色',
      '房间配置',
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

    expect(model?.preview).toBe('待处理：结束报名');
    expect(model?.status).toBe('警长竞选 · 报名上警');
    expect(actionLabels(model!)).toEqual(['结束报名', '本局复盘', '昨夜信息', '重新开始']);
    const advanceAction = model?.sections[0]?.actions[0];
    if (advanceAction?.isEnabled !== true) throw new Error('Expected enabled sheriff advancement');
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

    expect(model?.preview).toBe('真人法官主持中');
    expect(actionLabels(model!)).not.toContain('开始游戏');
    expect(actionLabels(model!)).toContain('重新开始');
  });

  it.each([GameStatus.Ongoing, GameStatus.Day])(
    'keeps restart available during audio playback in %s',
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
      const restartAction = model?.sections
        .flatMap((section) => section.actions)
        .find((action) => action.label === '重新开始');
      if (restartAction?.isEnabled !== true) {
        throw new Error(`Expected restart during ${roomStatus} audio playback`);
      }

      restartAction.onPress();
      expect(onHostControl).toHaveBeenCalledWith('restart');
    },
  );

  it('promotes restart in the ended state and includes result tools', () => {
    const onNightReview = jest.fn();
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        capabilities: deniedRoomCapabilities,
        onNightReview,
      }),
    );

    expect(model?.preview).toBe('可重新开始');
    expect(model?.sections.map((section) => section.title)).toEqual([
      '当前流程',
      '赛后管理',
      '辅助工具',
    ]);
    expect(actionLabels(model!)).toEqual(['重新开始', '本局复盘', '昨夜信息', '音乐设置']);
    const reviewAction = model?.sections
      .flatMap((section) => section.actions)
      .find((action) => action.key === 'night-review');
    if (reviewAction?.isEnabled !== true) throw new Error('Expected enabled post-game review');
    reviewAction.onPress();
    expect(onNightReview).toHaveBeenCalledTimes(1);
  });
});
