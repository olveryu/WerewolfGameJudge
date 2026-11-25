import {
  type GameState,
  GameStatus,
  getRoleDisplayName,
  getWerewolfDaytimeAnnouncements,
  getWerewolfNightReview,
  getWerewolfViewModel,
  parseWerewolfState,
  type RoleId,
  werewolfEngine,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepSubmission,
} from '@game-judge/game-engine/platform/steps';

import { createGame } from './gameFactory';
import { currentStep, driveNight, executeStepsUntil, presentation, submit } from './nightDriver';

describe('spec-driven night through production commands', () => {
  it('projects declared daytime information from settled actions, including skipped skills', () => {
    const context = createGame(['wolf', 'villager', 'silenceElder', 'votebanElder', 'crow']);
    const target = context.findSeatByRole('villager');
    expect(target).toBeGreaterThanOrEqual(0);
    driveNight(context, {
      silenceElderSilence: { actionKey: 'silenceElderSilence', seats: [target] },
      crowCurse: { actionKey: 'crowCurse', seats: [target] },
    });

    expect(getWerewolfDaytimeAnnouncements(context.getGameState())).toEqual([
      expect.objectContaining({
        key: 'silenceElder',
        timing: 'daySpeech',
        message: `${target + 1}号被禁言`,
      }),
      expect.objectContaining({
        key: 'votebanElder',
        timing: 'daySpeech',
        message: '昨夜没有禁票',
      }),
      expect.objectContaining({
        key: 'crow',
        timing: 'exileVote',
        message: `${target + 1}号被诅咒（放逐+1票）`,
      }),
    ]);
  });

  it('announces the actual landing seat after a magician swap', () => {
    const context = createGame(['magician', 'crow', 'wolf', 'villager', 'villager']);
    driveNight(context, {
      magicianSwap: { actionKey: 'magicianSwap', seats: [3, 4] },
      crowCurse: { actionKey: 'crowCurse', seats: [3] },
    });
    expect(getWerewolfDaytimeAnnouncements(context.getGameState())).toEqual([
      expect.objectContaining({ key: 'crow', message: '5号被诅咒（放逐+1票）' }),
    ]);
  });

  it('finishes an empty night plan with a valid persisted state', () => {
    const context = createGame(['villager', 'villager', 'villager']);
    const state = context.getGameState();

    expect(state.status).toBe(GameStatus.Ended);
    expect(state.nightState?.slice.order).toEqual([]);
    expect(state.lastNightDeaths).toEqual([]);
    expect(getWerewolfDaytimeAnnouncements(state)).toEqual([]);
    expect(parseWerewolfState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('keeps wolf votes revisable, clears a withdrawn countdown, and rejects stale submissions', () => {
    const context = createGame('预女猎白');
    const state = context.getGameState();
    const wolves = Object.values(state.players).flatMap((player) =>
      player?.role === 'wolf' ? [player.seat] : [],
    );
    const [first, ...others] = wolves;
    const target = context.findSeatByRole('villager');
    if (first === undefined || others.length === 0 || target < 0) {
      throw new Error('[FAIL-FAST] Wolf-vote fixture is incomplete');
    }
    const step = currentStep(state);
    expect(step.stepId).toBe('wolfKill');
    submit(context, first, { actionKey: 'wolfKill', seats: [target] });
    for (const seat of others) submit(context, seat, { actionKey: 'wolfKill', seats: [target] });
    expect(context.getGameState().nightState?.slice.deadlineMs).not.toBeNull();

    submit(context, first, { actionKey: 'wolfKillWithdraw' });
    expect(context.getGameState().nightState?.slice.deadlineMs).toBeNull();
    expect(presentation(context.getGameState(), first)?.progress).toEqual({
      done: wolves.length - 1,
      total: wolves.length,
    });
    const stale: StepSubmission = {
      ...step,
      serial: step.serial + 1,
      actionKey: 'wolfKillAbstain',
    };
    expect(
      context.dispatchAsSeat(first, {
        type: 'werewolf.step.submit',
        gameSequence: state.gameSequence,
        submission: stale,
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'REASON_STEP_STALE' });
    submit(context, first, { actionKey: 'wolfKill', seats: [target] });
    const deadline = context.getGameState().nightState?.slice.deadlineMs;
    if (deadline == null) throw new Error('[FAIL-FAST] Wolf countdown was not rearmed');
    context.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'settle wolf vote', {
      nowMs: deadline,
    });
    expect(context.getGameState().resolvedWolfKillTarget).toBe(target);
  });

  it('settles disagreeing cupid-board votes as no attack after the countdown', () => {
    const roles: RoleId[] = [
      'cupid',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    expect(
      executeStepsUntil(context, 'wolfKill', {
        cupidChooseLovers: { actionKey: 'cupidChooseLovers', seats: [6, 7] },
      }),
    ).toBe(true);
    submit(context, 1, { actionKey: 'wolfKill', seats: [6] });
    submit(context, 2, { actionKey: 'wolfKill', seats: [7] });
    const deadline = context.getGameState().nightState?.slice.deadlineMs;
    if (deadline == null) throw new Error('[FAIL-FAST] Disagreeing votes did not arm a countdown');
    context.dispatchSystemOrThrow(
      { type: 'werewolf.phase.settleExpired' },
      'settle disagreeing wolf votes',
      { nowMs: deadline },
    );
    expect(context.getGameState().resolvedWolfKillTarget).toBeNull();
    expect(context.getGameState().resolvedWolfKillVerdict).toEqual({ type: 'splitTied' });
  });

  it('keeps the countdown and withdrawal available when the pack cannot attack', () => {
    const roles: RoleId[] = [
      'wolf',
      'wolf',
      'poisoner',
      'seer',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    submit(context, 0, { actionKey: 'wolfKillAbstain' });
    submit(context, 1, { actionKey: 'wolfKillAbstain' });
    expect(context.getGameState().nightState?.slice.deadlineMs).not.toBeNull();

    submit(context, 0, { actionKey: 'wolfKillWithdraw' });
    expect(context.getGameState().nightState?.slice.deadlineMs).toBeNull();
    submit(context, 0, { actionKey: 'wolfKillAbstain' });
    expect(context.getGameState().nightState?.slice.deadlineMs).not.toBeNull();
  });

  it('retains the chosen seat during play and reports the landing after a swap', () => {
    const roles: RoleId[] = [
      'magician',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    driveNight(context, {
      magicianSwap: { actionKey: 'magicianSwap', seats: [6, 7] },
      wolfKill: { actionKey: 'wolfKill', seats: [6] },
      witchAction: { actionKey: 'antidote' },
      seerCheck: { actionKey: 'seerCheck', seats: [6] },
    });
    const state = context.getGameState();
    expect(state.lastNightDeaths).toEqual([]);
    expect(state.nightState?.slice.records.seerCheck?.bySeat[3]?.result).toMatchObject({
      chosenSeat: 6,
      landingSeat: 7,
    });
    const review = getWerewolfNightReview(state);
    expect(review.lines).toEqual(
      expect.arrayContaining([
        {
          kind: 'explanation',
          text: '狼队（2、3号）袭击7号（实际为8号）',
        },
        expect.objectContaining({
          kind: 'action',
          roleId: 'witch',
          phrase: '对7号用解药（实际为8号）',
        }),
        expect.objectContaining({ kind: 'action', roleId: 'witch', phrase: '未毒杀' }),
      ]),
    );
    expect(
      review.lines?.filter((line) => line.kind === 'action' && line.roleId === 'wolf'),
    ).toEqual([]);
    expect(parseWerewolfState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('reports both unused witch potions separately', () => {
    const context = createGame('预女猎白');
    driveNight(context, {});
    expect(getWerewolfNightReview(context.getGameState()).lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'action', roleId: 'witch', phrase: '未用解药' }),
        expect.objectContaining({ kind: 'action', roleId: 'witch', phrase: '未毒杀' }),
      ]),
    );
  });

  it('keeps a solo hunter view personal and includes its status in the review', () => {
    const context = createGame(['hunter']);
    const state = context.getGameState();
    const botState: GameState = { ...state, roster: { 0: { seat: 0, kind: 'bot' } } };
    expect(
      getWerewolfViewModel(botState, { seat: null, isHost: true }).canAcknowledgeStepBots,
    ).toBe(false);

    driveNight(context, {});
    expect(getWerewolfNightReview(context.getGameState()).lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'action', roleId: 'hunter', phrase: '可以发动' }),
      ]),
    );
  });

  it('offers bot acknowledgement and seat progress for a declared all-player view', () => {
    const context = createGame(['cupid', 'villager']);
    submit(context, 0, { actionKey: 'cupidChooseLovers', seats: [0, 1] });
    context.acknowledgePendingAudioOrThrow('begin lovers reveal');
    submit(context, 0, { actionKey: 'cupidLoversReveal' });
    const state = context.getGameState();
    const botState: GameState = {
      ...state,
      roster: { ...state.roster, 1: { seat: 1, kind: 'bot' } },
    };
    const view = getWerewolfViewModel(botState, { seat: 0, isHost: true });
    expect(view.canAcknowledgeStepBots).toBe(true);
    expect(view.stepSeatStatuses[0]).toEqual({ kind: 'ready' });

    const current = currentStep(botState);
    const command = {
      type: 'werewolf.step.ackBots',
      gameSequence: botState.gameSequence,
      ...current,
    } as const;
    const host = {
      actor: { kind: 'user', userId: botState.hostUserId },
      controlledSeat: null,
      nowMs: 1_000_100,
      commandId: 'acknowledge-bots',
      randomSeed: 'bot-acknowledgement',
    } as const;
    expect(
      werewolfEngine.decide(botState, { ...command, serial: current.serial + 1 }, host),
    ).toMatchObject({ kind: 'reject', reason: 'REASON_STEP_STALE' });
    const decision = werewolfEngine.decide(botState, command, host);
    if (decision.kind === 'reject')
      throw new Error(`[TEST] bot acknowledgement: ${decision.reason}`);
    const acknowledged = decision.events.reduce(werewolfEngine.evolve, botState);
    expect(
      acknowledged.nightState?.slice.records.cupidLoversReveal?.bySeat[1]?.submissions,
    ).toEqual([expect.objectContaining({ actionKey: 'cupidLoversReveal' })]);
  });

  it('reports the swapped landing together with nightmare and shadow details', () => {
    const roles: RoleId[] = [
      'magician',
      'shadow',
      'avenger',
      'nightmare',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    driveNight(context, {
      magicianSwap: { actionKey: 'magicianSwap', seats: [2, 8] },
      shadowChooseMimic: { actionKey: 'shadowChooseMimic', seats: [8] },
      nightmareBlock: { actionKey: 'nightmareBlock', seats: [8] },
    });
    expect(getWerewolfNightReview(context.getGameState()).lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'action',
          roleId: 'shadow',
          phrase: '模仿9号（实际为3号）（绑定）',
        }),
        expect.objectContaining({
          kind: 'action',
          roleId: 'nightmare',
          phrase: '恐惧9号（实际为3号）（复仇者，技能无效）',
        }),
      ]),
    );
  });

  it('attributes each poison death and reports the poisoned hunter status', () => {
    const roles: RoleId[] = [
      'wolf',
      'poisoner',
      'witch',
      'seer',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles);
    driveNight(context, {
      poisonerPoison: { actionKey: 'poisonerPoison', seats: [4] },
      witchAction: { actionKey: 'poison', seats: [6] },
    });
    const review = getWerewolfNightReview(context.getGameState());
    expect(review.deaths).toEqual(
      expect.arrayContaining([
        { seat: 4, reason: 'poison', note: { kind: 'poisonedBy', actorRoleId: 'poisoner' } },
        { seat: 6, reason: 'poison', note: { kind: 'poisonedBy', actorRoleId: 'witch' } },
      ]),
    );
    expect(review.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'action', roleId: 'hunter', phrase: '不能发动' }),
      ]),
    );
  });

  it('reports bottom cards and the card selected through the real night', () => {
    const roles: RoleId[] = [
      'seedWolf',
      'wolf',
      'treasureMaster',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles, undefined, { randomSeed: 'bottom-fixture-1' });
    const actorSeat = context.findSeatByRole('treasureMaster');
    if (actorSeat < 0) throw new Error('[FAIL-FAST] Treasure master was dealt to the bottom');
    driveNight(context, {});
    const state = context.getGameState();
    const record = state.nightState?.slice.records.treasureMasterChoose?.bySeat[actorSeat];
    const cardIndex = record?.submissions.find(
      (submission) => submission.actionKey === 'treasureMasterChoose',
    )?.cardIndex;
    const chosenRole = cardIndex == null ? undefined : state.bottomCards?.[cardIndex];
    if (chosenRole === undefined) throw new Error('[FAIL-FAST] Missing selected bottom card');
    const review = getWerewolfNightReview(state);
    expect(review.bottomCards).toEqual(state.bottomCards);
    expect(review.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'action',
          seat: actorSeat,
          roleId: 'treasureMaster',
          phrase: '选择底牌',
          result: `（获得的技能：${getRoleDisplayName(chosenRole)}）`,
        }),
      ]),
    );
  });

  it('round-trips an infected treasure master without losing the dealt-card identity', () => {
    const roles: RoleId[] = [
      'seedWolf',
      'wolf',
      'treasureMaster',
      'seer',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const context = createGame(roles, undefined, { randomSeed: 'bottom-fixture-1' });
    const target = context.findSeatByRole('treasureMaster');
    expect(target).toBeGreaterThanOrEqual(0);
    driveNight(context, {
      wolfKill: { actionKey: 'wolfKill', seats: [target] },
      seedWolfInfect: { actionKey: 'seedWolfInfect' },
    });
    const state = context.getGameState();
    expect(state.seedWolfInfectionResult).toEqual({ outcome: 'converted', targetSeat: target });
    expect(state.nightState?.roles.identities[target]).toMatchObject({
      dealtRole: 'treasureMaster',
      currentRole: 'wolf',
    });
    expect(parseWerewolfState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('shows the wound status only to the masked man, and only after the deaths are published', () => {
    const roles: RoleId[] = [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'maskedMan',
      'guard',
    ];
    const context = createGame(roles, new Map(roles.map((roleId, seat) => [seat, roleId])));
    driveNight(context, { wolfKill: { actionKey: 'wolfKill', seats: [10] } });
    const viewsOf = (seat: number) =>
      getWerewolfViewModel(context.getGameState(), { seat, isHost: seat === 0 })
        .personalDaytimeViews;

    expect(context.getGameState().lastNightDeaths).toEqual([]);
    expect(viewsOf(10)).toEqual([]);

    context.dispatchAsSeatOrThrow(
      0,
      { type: 'werewolf.lastNightInfo.confirm', gameSequence: context.getGameState().gameSequence },
      'publish the night deaths',
    );

    expect(viewsOf(10)).toEqual([
      {
        key: 'maskedMan',
        label: '查看负伤状态',
        prompt: '请在自己发言结束后再查看',
        title: '负伤状态',
        text: '你已负伤，请宣布出局',
      },
    ]);
    expect(viewsOf(9)).toEqual([]);
    expect(viewsOf(0)).toEqual([]);
  });

  it('gives an unharmed masked man the same card with a different answer', () => {
    const roles: RoleId[] = [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'maskedMan',
      'guard',
    ];
    const context = createGame(roles, new Map(roles.map((roleId, seat) => [seat, roleId])));
    driveNight(context, { wolfKill: { actionKey: 'wolfKill', seats: [0] } });
    context.dispatchAsSeatOrThrow(
      0,
      { type: 'werewolf.lastNightInfo.confirm', gameSequence: context.getGameState().gameSequence },
      'publish the night deaths',
    );

    expect(
      getWerewolfViewModel(context.getGameState(), { seat: 10, isHost: false })
        .personalDaytimeViews,
    ).toMatchObject([{ label: '查看负伤状态', text: '你没有负伤' }]);
  });

  it('offers no skip once the wolf robot has learned, while the hunter status is still unread', () => {
    const roles: RoleId[] = [
      'villager',
      'villager',
      'villager',
      'hunter',
      'wolf',
      'wolf',
      'wolf',
      'wolfRobot',
      'seer',
      'witch',
      'guard',
      'psychic',
    ];
    const context = createGame(roles, new Map(roles.map((roleId, seat) => [seat, roleId])));
    expect(
      executeStepsUntil(context, 'wolfRobotLearn', {
        wolfKill: { actionKey: 'wolfKill', seats: [0] },
      }),
    ).toBe(true);
    submit(context, 7, { actionKey: 'wolfRobotLearn', seats: [3] });
    submit(context, 7, { actionKey: STEP_RESULT_ACK_ACTION_KEY });

    const state = context.getGameState();
    expect(
      presentation(state, 7)
        ?.actions.filter((action) => action.availability.kind === 'available')
        .map((action) => action.key),
    ).toEqual(['wolfRobotHunterStatus']);
    expect(
      context.dispatchAsSeat(7, {
        type: 'werewolf.step.submit',
        gameSequence: state.gameSequence,
        submission: { ...currentStep(state), actionKey: STEP_SKIP_ACTION_KEY },
      }).kind,
    ).toBe('rejected');
  });
});
