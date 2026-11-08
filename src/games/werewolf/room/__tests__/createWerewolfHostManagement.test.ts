import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { resolveHostTaskView } from '@/features/room/model/resolveHostTaskView';
import type { RoomCapability } from '@/features/room/model/RoomCapabilities';
import { createWerewolfHostManagement } from '@/games/werewolf/room/createWerewolfHostManagement';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { hostTaskBody } from '@/test-utils/hostTask';

const deniedCapability: RoomCapability = { isAllowed: false, reason: '不可用' };
const deniedRoomCapabilities = {
  canConfigureGame: deniedCapability,
  canClearSeats: deniedCapability,
  canFillBots: deniedCapability,
  canShareRoom: deniedCapability,
};

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    roomStatus: GameStatus.Unseated,
    panelFlow: { lastNightInfoConfirmed: false },
    isReviewShared: false,
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
    review: { isEnabled: true as const, onPress: jest.fn() },
    onGrantReviewAccess: jest.fn(),
    onLastNightInfo: jest.fn(),
    ...overrides,
  };
}

function actionLabels(model: NonNullable<ReturnType<typeof createWerewolfHostManagement>>) {
  return model.sections.flatMap((section) => section.actions.map((action) => action.label));
}

function createSheriffElection(
  viewOverrides: Partial<SheriffElectionPanelModel['view']> = {},
  callbacks: Partial<
    Pick<SheriffElectionPanelModel, 'advance' | 'requestAdvance' | 'requestEndBySelfDestruct'>
  > = {},
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
    remainingSeconds: null,
    pendingAction: null,
    register: jest.fn().mockResolvedValue(undefined),
    cancelRegistration: jest.fn().mockResolvedValue(undefined),
    withdraw: jest.fn().mockResolvedValue(undefined),
    vote: jest.fn().mockResolvedValue(undefined),
    advance: jest.fn().mockResolvedValue(undefined),
    requestAdvance: jest.fn(),
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
    const actions = model.sections.flatMap((section) => section.actions);
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
    const actions = model.sections.flatMap((section) => section.actions);
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
    expect(actionLabels(model)).toEqual([
      '分配角色',
      '房间设置',
      '填充机器人',
      '清空座位',
      '分享房间',
      '音乐设置',
    ]);
    const assignRoles = model?.sections[0]?.actions[0];
    if (assignRoles?.isEnabled !== true) throw new Error('Expected enabled role assignment');
    assignRoles.onPress();
    expect(onHostControl).toHaveBeenCalledWith('prepareToFlip');
  });

  it('offers election advance and last-night info as an equal Day choice while both apply', () => {
    const requestAdvance = jest.fn();
    const sheriffElection = createSheriffElection({}, { requestAdvance });
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );

    expect(actionLabels(model)).toEqual([
      '结束报名',
      '本局复盘',
      '授权玩家查看',
      '昨夜信息',
      '中止本局',
    ]);
    expect(model.task).toMatchObject({
      kind: 'choice',
      actionKeys: ['sheriff-advance', 'last-night-info'],
      steps: [
        { key: 'lastNightInfo', state: 'current' },
        { key: 'grantReview', state: 'upcoming' },
        { key: 'closing', state: 'upcoming' },
      ],
    });
    const body = hostTaskBody(model);
    if (body?.kind !== 'choice') throw new Error('Expected a choice task');
    const advance = body.actions[0];
    if (advance?.isEnabled !== true) throw new Error('Expected enabled sheriff advancement');
    advance.onPress();
    expect(requestAdvance).toHaveBeenCalledTimes(1);
  });

  it('keeps sheriff advancement alone as the Day task once the info is confirmed', () => {
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        panelFlow: { lastNightInfoConfirmed: true },
        sheriffElection: createSheriffElection(),
        capabilities: deniedRoomCapabilities,
      }),
    );
    expect(model.task).toEqual({ kind: 'action', actionKey: 'sheriff-advance' });
  });

  it('puts self-destruct on the card during speeches: end speech, self-destruct, last-night info', () => {
    const requestEndBySelfDestruct = jest.fn();
    const sheriffElection = createSheriffElection(
      { phase: 'candidateSpeech', advanceLabel: '结束发言' },
      { requestEndBySelfDestruct },
    );
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );
    expect(model.task).toMatchObject({
      kind: 'choice',
      actionKeys: ['sheriff-advance', 'sheriff-self-destruct', 'last-night-info'],
    });
    const body = hostTaskBody(model);
    if (body?.kind !== 'choice') throw new Error('Expected a choice task');
    const selfDestruct = body.actions[1];
    if (selfDestruct?.isEnabled !== true) throw new Error('Expected enabled self-destruct');
    expect(selfDestruct.variant).toBe('danger');
    selfDestruct.onPress();
    expect(requestEndBySelfDestruct).toHaveBeenCalledTimes(1);

    const confirmed = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        panelFlow: { lastNightInfoConfirmed: true },
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );
    expect(confirmed.task).toEqual({
      kind: 'choice',
      actionKeys: ['sheriff-advance', 'sheriff-self-destruct'],
    });
  });

  it('offers last-night info as the Day task once the election completed, until confirmed', () => {
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        sheriffElection: createSheriffElection({
          phase: 'completed',
          canAdvance: false,
          advanceLabel: null,
        }),
        capabilities: deniedRoomCapabilities,
      }),
    );
    expect(model.task).toMatchObject({
      kind: 'action',
      actionKey: 'last-night-info',
      steps: [
        { key: 'lastNightInfo', state: 'current', actionKey: 'last-night-info' },
        { key: 'grantReview', state: 'upcoming', actionKey: 'grant-review' },
        { key: 'closing', state: 'upcoming' },
      ],
    });
  });

  it('routes advancement through the request entry during speech phases too', () => {
    const requestAdvance = jest.fn();
    const sheriffElection = createSheriffElection(
      { phase: 'candidateSpeech', advanceLabel: '结束发言' },
      { requestAdvance },
    );
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );
    const advanceAction = model?.sections
      .flatMap((section) => section.actions)
      .find((action) => action.key === 'sheriff-advance');

    if (advanceAction?.isEnabled !== true) throw new Error('Expected enabled sheriff advancement');
    advanceAction.onPress();
    expect(requestAdvance).toHaveBeenCalledTimes(1);
  });

  it.each(['firstVote', 'runoffVote'] as const)(
    'keeps the vote count out of the host task during %s',
    (phase) => {
      const sheriffElection = createSheriffElection({
        phase,
        canAdvance: false,
        advanceLabel: null,
        voteProgress: { submittedCount: 1, eligibleCount: 3, pendingSeats: [1, 2] },
      });
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Day,
          sheriffElection,
          capabilities: deniedRoomCapabilities,
        }),
      );
      const actions = model.sections.flatMap((section) => section.actions);
      expect(actions.map((action) => action.label)).not.toContain('推进竞选');
      expect(actions.find((action) => action.key === 'sheriff-advance')).toBeUndefined();
      // Voting has no host advance: the info stays the task, and the vote
      // count stays out of it — it lives only in the HUD.
      expect(model.task).toMatchObject({
        kind: 'action',
        actionKey: 'last-night-info',
      });
      expect(model.task).not.toHaveProperty('note');
      const confirmed = createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Day,
          panelFlow: { lastNightInfoConfirmed: true },
          sheriffElection,
          capabilities: deniedRoomCapabilities,
        }),
      );
      // With no moves left there is no host task at all during voting:
      // the dock still says 「等待投票完成」 and the HUD shows the count.
      expect(hostTaskBody(confirmed)).toBeNull();
    },
  );

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

    expect(actionLabels(model)).not.toContain('开始游戏');
    expect(actionLabels(model)).toContain('中止本局');
  });

  // Audio playback lock (supersedes the former "keeps abort available"
  // pin, which contradicted the interaction policy's audio gate): while
  // narration plays, flow actions are disabled with the shared lock
  // reason and carry no press handler. The review tools are not
  // exempt: confirming or opening them advances the panel flow, so
  // they lock like every other flow action — on the task card as
  // well as in the sheet.
  it.each([GameStatus.Ongoing, GameStatus.Day])(
    'disables abort during audio playback in %s',
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
      expect(abortAction).toMatchObject({
        isEnabled: false,
        disabledReason: '语音播报中，请稍候',
      });
      expect(abortAction).not.toHaveProperty('onPress');
      expect(onHostControl).not.toHaveBeenCalled();
    },
  );

  it('disables the terminal actions during audio playback in Ended', () => {
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        isAudioPlaying: true,
        capabilities: deniedRoomCapabilities,
      }),
    );
    const actions = model.sections.flatMap((section) => section.actions);
    for (const key of ['select-mvp', 'next-round', 'return-lobby']) {
      const action = actions.find((entry) => entry.key === key);
      expect(action).toMatchObject({ isEnabled: false, disabledReason: '语音播报中，请稍候' });
      expect(action).not.toHaveProperty('onPress');
    }
  });

  it.each([GameStatus.Day, GameStatus.Ended])(
    'locks the review tools during audio playback in %s, on the task card and in the sheet',
    (roomStatus) => {
      const openReview = jest.fn();
      const onGrantReviewAccess = jest.fn();
      const onLastNightInfo = jest.fn();
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus,
          isAudioPlaying: true,
          capabilities: deniedRoomCapabilities,
          review: { isEnabled: true, onPress: openReview },
          onGrantReviewAccess,
          onLastNightInfo,
        }),
      );
      const actions = model.sections.flatMap((section) => section.actions);
      for (const key of ['review', 'grant-review', 'last-night-info']) {
        const action = actions.find((entry) => entry.key === key);
        expect(action).toMatchObject({
          isEnabled: false,
          disabledReason: '语音播报中，请稍候',
        });
        expect(action).not.toHaveProperty('onPress');
      }
      const view = resolveHostTaskView(model);
      if (view === null) {
        throw new Error(`Expected a host task during ${roomStatus} audio`);
      }
      expect(hostTaskBody(model)).toMatchObject({
        kind: 'blocked',
        reason: '语音播报中，请稍候',
      });
      for (const step of view.steps ?? []) {
        expect(step.onPress).toBeUndefined();
      }
      expect(openReview).not.toHaveBeenCalled();
      expect(onGrantReviewAccess).not.toHaveBeenCalled();
      expect(onLastNightInfo).not.toHaveBeenCalled();
    },
  );

  it('locks every choice move, including last-night info, during Day audio with an election running', () => {
    const sheriffElection = createSheriffElection({ phase: 'candidateSpeech' });
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        isAudioPlaying: true,
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );
    const body = hostTaskBody(model);
    if (body?.kind !== 'choice') {
      throw new Error('Expected a choice task during Day audio');
    }
    for (const action of body.actions) {
      expect(action).toMatchObject({
        isEnabled: false,
        disabledReason: '语音播报中，请稍候',
      });
      expect(action).not.toHaveProperty('onPress');
    }
    const view = resolveHostTaskView(model);
    if (view === null) {
      throw new Error('Expected a host task view during Day audio');
    }
    for (const step of view.steps ?? []) {
      expect(step.onPress).toBeUndefined();
    }
  });

  it('disables the sheriff flow actions during audio playback in Day', () => {
    const sheriffElection = createSheriffElection({ phase: 'candidateSpeech' });
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Day,
        isAudioPlaying: true,
        sheriffElection,
        capabilities: deniedRoomCapabilities,
      }),
    );
    const actions = model.sections.flatMap((section) => section.actions);
    for (const key of ['sheriff-advance', 'sheriff-self-destruct']) {
      const action = actions.find((entry) => entry.key === key);
      expect(action).toMatchObject({ isEnabled: false, disabledReason: '语音播报中，请稍候' });
      expect(action).not.toHaveProperty('onPress');
    }
  });

  it('presents the terminal double-key in the ended state and includes result tools', () => {
    const openReview = jest.fn();
    const onGrantReviewAccess = jest.fn();
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        capabilities: deniedRoomCapabilities,
        review: { isEnabled: true, onPress: openReview },
        onGrantReviewAccess,
      }),
    );

    expect(model?.sections.map((section) => section.title)).toEqual([
      '当前流程',
      '赛后管理',
      '辅助工具',
    ]);
    expect(actionLabels(model)).toEqual([
      '评选 MVP',
      '再来一局',
      '返回大厅',
      '本局复盘',
      '授权玩家查看',
      '昨夜信息',
      '音乐设置',
    ]);
    const actions = model.sections.flatMap((section) => section.actions);
    const reviewAction = actions.find((action) => action.key === 'review');
    if (reviewAction?.isEnabled !== true) throw new Error('Expected enabled post-game review');
    reviewAction.onPress();
    expect(openReview).toHaveBeenCalledTimes(1);
    const grantAction = actions.find((action) => action.key === 'grant-review');
    if (grantAction?.isEnabled !== true) throw new Error('Expected enabled review grant');
    grantAction.onPress();
    expect(onGrantReviewAccess).toHaveBeenCalledTimes(1);
  });

  it('makes granting the review the single move of the Ended grant step', () => {
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        panelFlow: { lastNightInfoConfirmed: true },
        capabilities: deniedRoomCapabilities,
      }),
    );
    expect(model.task).toMatchObject({
      kind: 'action',
      actionKey: 'grant-review',
      note: '记得把复盘分享给第一天出局的玩家',
      steps: [
        { key: 'lastNightInfo', state: 'complete' },
        { key: 'grantReview', state: 'current' },
        { key: 'closing', state: 'upcoming' },
      ],
    });
  });

  it('keeps both review tools beside the exits once the grant step is done', () => {
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        panelFlow: { lastNightInfoConfirmed: true },
        isReviewShared: true,
        capabilities: deniedRoomCapabilities,
      }),
    );
    expect(model.task).toMatchObject({
      kind: 'choice',
      actionKeys: ['grant-review', 'review', 'next-round', 'return-lobby'],
      steps: [
        { key: 'lastNightInfo', state: 'complete' },
        { key: 'grantReview', state: 'complete' },
        { key: 'closing', state: 'current' },
      ],
    });
    // The task only references sheet actions: a misspelled key must fail
    // here, not at render time when the card resolves the view.
    const view = resolveHostTaskView(model);
    if (view?.body.kind !== 'choice') throw new Error('Expected a choice closing task');
    expect(view.body.actions.map((action) => action.key)).toEqual([
      'grant-review',
      'review',
      'next-round',
      'return-lobby',
    ]);
    for (const action of view.body.actions) {
      expect(action.isEnabled).toBe(true);
      expect(action).toHaveProperty('onPress');
    }
  });

  it('locks all four closing moves during audio playback', () => {
    const model = createWerewolfHostManagement(
      createInput({
        roomStatus: GameStatus.Ended,
        panelFlow: { lastNightInfoConfirmed: true },
        isReviewShared: true,
        isAudioPlaying: true,
        capabilities: deniedRoomCapabilities,
      }),
    );
    const view = resolveHostTaskView(model);
    if (view?.body.kind !== 'choice') throw new Error('Expected a choice closing task');
    for (const action of view.body.actions) {
      expect(action).toMatchObject({
        isEnabled: false,
        disabledReason: '语音播报中，请稍候',
      });
      expect(action).not.toHaveProperty('onPress');
    }
    for (const step of view.steps ?? []) {
      expect(step.onPress).toBeUndefined();
    }
  });

  it('fails fast when a Day or Ended host has no review entry', () => {
    expect(() =>
      createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Ended,
          review: null,
          capabilities: deniedRoomCapabilities,
        }),
      ),
    ).toThrow('[FAIL-FAST] Werewolf Ended host has no review entry');
  });

  describe('console primary', () => {
    it('carries role assignment in the panel from the unseated state on', () => {
      const model = createWerewolfHostManagement(
        createInput({ roomStatus: GameStatus.Unseated, seatedCount: 0, totalSeats: 9 }),
      );
      expect(actionLabels(model)).toContain('分配角色');
      const primary = hostTaskBody(model);
      if (primary?.kind !== 'blocked') throw new Error('Expected a blocked console primary');
      expect(primary.reason).toBe('座位尚未坐满（还差 9 人）');
    });

    it('blocks role assignment while seats are open and offers room sharing as the remedy', () => {
      const input = createInput({ roomStatus: GameStatus.Seated, seatedCount: 6, totalSeats: 9 });
      const model = createWerewolfHostManagement(input);
      const primary = hostTaskBody(model);
      expect(primary).toMatchObject({ action: { key: 'assign-roles', label: '分配角色' } });
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
      const primary = hostTaskBody(model);
      if (primary?.kind !== 'blocked') throw new Error('Expected a blocked console primary');
      expect(primary.remedy).toBeNull();
    });

    it('runs role assignment through the host-control channel once every seat is taken', () => {
      const input = createInput({ roomStatus: GameStatus.Seated, seatedCount: 9, totalSeats: 9 });
      const model = createWerewolfHostManagement(input);
      const primary = hostTaskBody(model);
      if (primary?.kind !== 'ready') throw new Error('Expected a ready console primary');
      primary.action.onPress();
      expect(input.onHostControl).toHaveBeenCalledWith('prepareToFlip');
    });

    it('offers game start once roles are assigned, except in plague mode', () => {
      const input = createInput({ roomStatus: GameStatus.Ready });
      const model = createWerewolfHostManagement(input);
      const primary = hostTaskBody(model);
      expect(primary).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
      if (primary?.kind !== 'ready') throw new Error('Expected a ready console primary');
      primary.action.onPress();
      expect(input.onHostControl).toHaveBeenCalledWith('startGame');

      const plague = createWerewolfHostManagement(
        createInput({ roomStatus: GameStatus.Ready, isPlagueMode: true }),
      );
      expect(hostTaskBody(plague)).toEqual({
        kind: 'message',
        text: '黑死病模式 — 已发牌，请由房主担任真人法官主持后续流程',
        escape: null,
      });
    });

    it('shows the viewing progress as the Assigned task, with the bot scaffold as escape', () => {
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Assigned,
          seatedCount: 9,
          viewedCount: 4,
          totalSeats: 9,
          canMarkAllBotsViewed: true,
        }),
      );
      expect(hostTaskBody(model)).toMatchObject({
        kind: 'blocked',
        action: { key: 'start-game' },
        reason: '4/9 位玩家已查看角色，等待剩余玩家',
        remedy: { label: '标记机器人已查看' },
      });
      // The sheet start action carries the same sentence as its disabled reason.
      const startAction = model?.sections
        .flatMap((section) => section.actions)
        .find((action) => action.key === 'start-game');
      expect(startAction).toMatchObject({
        isEnabled: false,
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
      const primary = hostTaskBody(model);
      if (primary?.kind !== 'ready') throw new Error('Expected a ready console primary');
      primary.action.onPress();
      expect(input.onHostControl).toHaveBeenCalledWith('startGame');
    });

    it('renders the task blocked without a reason while a host action is submitting', () => {
      const model = createWerewolfHostManagement(
        createInput({
          roomStatus: GameStatus.Seated,
          seatedCount: 9,
          isHostActionSubmitting: true,
        }),
      );
      expect(hostTaskBody(model)).toMatchObject({ kind: 'blocked', reason: null });
    });
  });
});
