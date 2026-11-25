import type { StepDefinition, StepRecord, StepRuntime } from '../../../../platform/steps';
import {
  buildStepReviewLines,
  decideStepSubmission,
  describeStepConfirmation,
  evaluateStepProgress,
  evolveStepSlice,
  getStepOverrideViolations,
  presentStep,
  STEP_OVERRIDE_ALLOWLIST,
  STEP_RESULT_ACK_ACTION_KEY,
} from '../../../../platform/steps';
import {
  createWerewolfRoleContext,
  resolveNightPresenceFacts,
  WEREWOLF_PRESENCE_DECLARATIONS,
  WEREWOLF_ROLE_DEFINITIONS,
  WEREWOLF_SHARED_STEPS,
} from '..';
import type {
  WerewolfNightFacts,
  WerewolfRoleDefinition,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfRoleStepResult,
} from '../role';
import { wolfKillStep } from '../wolfKill';

const EMPTY_FACTS: WerewolfNightFacts = {
  selections: [],
  identityChanges: [],
  cardSelections: [],
  disabledAbilities: [],
  deathEffects: [],
};

const ROLE_DEFINITIONS: readonly WerewolfRoleDefinition[] = WEREWOLF_ROLE_DEFINITIONS;

const EXPECTED_ROLE_IDS = [
  'villager',
  'mirrorSeer',
  'drunkSeer',
  'seer',
  'witch',
  'poisoner',
  'hunter',
  'guard',
  'idiot',
  'knight',
  'magician',
  'witcher',
  'psychic',
  'dreamcatcher',
  'graveyardKeeper',
  'pureWhite',
  'dancer',
  'silenceElder',
  'votebanElder',
  'crow',
  'maskedMan',
  'sequencePrince',
  'wolf',
  'seedWolf',
  'wolfQueen',
  'wolfKing',
  'darkWolfKing',
  'nightmare',
  'gargoyle',
  'awakenedGargoyle',
  'bloodMoon',
  'wolfRobot',
  'wolfWitch',
  'spiritKnight',
  'masquerade',
  'warden',
  'eclipseWolfQueen',
  'hiddenWolf',
  'wolfGirl',
  'slacker',
  'wildChild',
  'piper',
  'shadow',
  'avenger',
  'thief',
  'cupid',
  'treasureMaster',
  'cursedFox',
] as const;

describe('werewolf role definitions', () => {
  it('declares every planned role exactly once', () => {
    expect(WEREWOLF_ROLE_DEFINITIONS.map((role) => role.id)).toEqual(EXPECTED_ROLE_IDS);
    expect(new Set(WEREWOLF_ROLE_DEFINITIONS.map((role) => role.id)).size).toBe(
      EXPECTED_ROLE_IDS.length,
    );
  });

  it('declares the shared wolf attack step exactly once', () => {
    expect(WEREWOLF_SHARED_STEPS.map((step) => step.id)).toEqual(['wolfKill']);
  });

  it('declares every wolf-vote participant and excludes solo wolf roles', () => {
    const votingRoles = ROLE_DEFINITIONS.filter(
      (role) => role.traits.recognition?.participatesInWolfVote === true,
    ).map((role) => role.id);

    expect(votingRoles).toEqual([
      'wolf',
      'seedWolf',
      'wolfQueen',
      'wolfKing',
      'darkWolfKing',
      'nightmare',
      'awakenedGargoyle',
      'bloodMoon',
      'wolfWitch',
      'spiritKnight',
      'warden',
      'eclipseWolfQueen',
      'wolfGirl',
    ]);
  });

  it('uses only the two approved step progression overrides', () => {
    const steps = [
      ...WEREWOLF_SHARED_STEPS,
      ...WEREWOLF_ROLE_DEFINITIONS.flatMap((role) => role.steps),
    ];

    expect(getStepOverrideViolations(steps, STEP_OVERRIDE_ALLOWLIST)).toEqual([]);
  });

  it.each(WEREWOLF_ROLE_DEFINITIONS.flatMap((role) => role.steps.map((step) => ({ role, step }))))(
    'snapshots generated output for $role.id $step.id',
    ({ role, step }) => {
      const state = createState(role.id);
      const initialRuntime = createRuntime(role, state, { bySeat: {} }, EMPTY_FACTS, step.id);
      const initial = presentStep(initialRuntime, state, 1);
      const action = step.actions[0];
      const result = getCheckResult(role.id);
      const completedRuntime = createRuntime(
        role,
        state,
        {
          bySeat: {
            1: {
              submissions: [
                {
                  actionKey: action?.key ?? step.id,
                  seats:
                    action?.kind === 'pickSeats'
                      ? Array.from({ length: action.count.min }, (_unused, index) => index + 2)
                      : [],
                  cardIndex: action?.kind === 'pickCard' ? 0 : null,
                },
              ],
              result,
              isResultAcknowledged: false,
            },
          },
        },
        EMPTY_FACTS,
        step.id,
      );

      expect({
        initial,
        submitted: presentStep(completedRuntime, state, 1),
        review: buildStepReviewLines(completedRuntime, state),
      }).toMatchSnapshot();
    },
  );

  it('snapshots generated output for the shared wolf attack step', () => {
    const state = createState('wolf');
    const initialRuntime = createRuntimeForStep(wolfKillStep, state);
    const completedRuntime = createRuntimeForStep(wolfKillStep, state, {
      bySeat: {
        1: {
          submissions: [{ actionKey: 'wolfKill', seats: [2], cardIndex: null }],
          result: null,
          isResultAcknowledged: false,
        },
      },
    });

    expect({
      initial: presentStep(initialRuntime, state, 1),
      submitted: presentStep(completedRuntime, state, 1),
      review: buildStepReviewLines(completedRuntime, state),
    }).toMatchSnapshot();
  });

  it('starts the countdown after all wolves vote, including a disagreement', () => {
    const step = wolfKillStep;
    const completion = step.completion;
    if (completion === undefined) throw new Error('[FAIL-FAST] Wolf vote completion is missing');
    const state = createState('wolf', {
      identities: {
        1: { dealtRole: 'wolf', currentRole: 'wolf', borrowedAbilityRole: null },
        2: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        3: { dealtRole: 'cupid', currentRole: 'cupid', borrowedAbilityRole: null },
        4: { dealtRole: 'villager', currentRole: 'villager', borrowedAbilityRole: null },
      },
    });
    const context = createRoleContext(state, null);
    const voteAction = step.actions[0];
    if (voteAction?.kind !== 'pickSeats') {
      throw new Error('[FAIL-FAST] Wolf vote action is missing');
    }
    const disagreeing = {
      ...context,
      record: {
        bySeat: {
          1: {
            submissions: [{ actionKey: 'wolfKill', seats: [3], cardIndex: null }],
            result: null,
            isResultAcknowledged: false,
          },
          2: {
            submissions: [{ actionKey: 'wolfKill', seats: [4], cardIndex: null }],
            result: null,
            isResultAcknowledged: false,
          },
        },
      },
    };
    const aligned = {
      ...disagreeing,
      record: {
        ...disagreeing.record,
        bySeat: {
          ...disagreeing.record.bySeat,
          2: {
            submissions: [{ actionKey: 'wolfKill', seats: [3], cardIndex: null }],
            result: null,
            isResultAcknowledged: false,
          },
        },
      },
    };

    expect(context.nightPresence.doesWolfVoteRequireUnanimity).toBe(true);
    expect(
      voteAction.seats(createRoleContext(state, 1)).find((option) => option.seat === 2),
    ).toEqual({
      seat: 2,
      unavailableReason: '该角色不能被狼人直接袭击',
    });
    expect(completion(disagreeing)).toEqual({ kind: 'armCountdown' });
    expect(completion(aligned)).toEqual({ kind: 'armCountdown' });
    expect(step.actions[0]?.commit).toBe('revisable');
  });

  it('lets wolves change and withdraw votes without restoring a previous vote', () => {
    const state = createState('wolf', {
      identities: {
        1: { dealtRole: 'wolf', currentRole: 'wolf', borrowedAbilityRole: null },
        2: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        3: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        4: { dealtRole: 'villager', currentRole: 'villager', borrowedAbilityRole: null },
      },
    });
    const initialRuntime = createRuntimeForStep(wolfKillStep, state);
    let slice = initialRuntime.getSlice(state);
    const runtime = { ...initialRuntime, getSlice: () => slice };
    const submit = (seat: number, actionKey: string, seats?: readonly number[]) => {
      const decision = decideStepSubmission(runtime, state, seat, {
        stepId: 'wolfKill',
        serial: 1,
        actionKey,
        ...(seats === undefined ? {} : { seats }),
      });
      if (decision.kind === 'reject') throw new Error(`[FAIL-FAST] ${actionKey} was rejected`);
      for (const event of decision.events) slice = evolveStepSlice(slice, event);
    };

    submit(1, 'wolfKill', [3]);
    submit(2, 'wolfKill', [3]);
    expect(presentStep(runtime, state, 1)?.progress).toEqual({ done: 2, total: 2 });
    const countdown = evaluateStepProgress(runtime, state, 100)[0];
    if (countdown?.type !== 'deadlineArmed') throw new Error('[FAIL-FAST] No wolf countdown');
    slice = evolveStepSlice(slice, countdown);

    submit(1, 'wolfKillAbstain');
    expect(slice.records.wolfKill?.bySeat[1]?.submissions).toEqual([
      { actionKey: 'wolfKillAbstain', seats: [], cardIndex: null },
    ]);
    expect(presentStep(runtime, state, 1)?.actions).toContainEqual(
      expect.objectContaining({ key: 'wolfKillWithdraw', label: '撤回袭击投票' }),
    );
    submit(1, 'wolfKillWithdraw');
    expect(slice.records.wolfKill?.bySeat[1]?.submissions).toEqual([]);
    expect(presentStep(runtime, state, 1)?.progress).toEqual({ done: 1, total: 2 });
    expect(evaluateStepProgress(runtime, state, 200)).toEqual([{ type: 'deadlineCleared' }]);
  });

  it.each([
    {
      cause: 'poisoner',
      role: 'poisoner',
      facts: EMPTY_FACTS,
      reason: '本局有毒师在场，首夜无法袭击',
    },
    {
      cause: 'nightmare',
      role: 'villager',
      facts: {
        ...EMPTY_FACTS,
        disabledAbilities: [
          { roleId: '*', seat: 2, sourceRoleId: 'nightmare' },
          { roleId: 'wolfKill', seat: 3, sourceRoleId: 'nightmare' },
        ],
      },
      reason: '被噩梦之影恐惧，本夜无法袭击',
    },
  ])(
    'lets every wolf see and acknowledge the $cause attack restriction',
    ({ role, facts, reason }) => {
      const state = createState(role, {
        identities: {
          1: { dealtRole: role, currentRole: role, borrowedAbilityRole: null },
          2: { dealtRole: 'wolf', currentRole: 'wolf', borrowedAbilityRole: null },
          3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
          4: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        },
      });
      const initialRuntime = createRuntimeForStep(wolfKillStep, state, { bySeat: {} }, facts);
      let slice = initialRuntime.getSlice(state);
      const runtime = { ...initialRuntime, getSlice: () => slice };

      expect(wolfKillStep.actors(createRoleContext(state, null, facts))).toEqual([2, 3]);
      expect(evaluateStepProgress(runtime, state, 100)).toEqual([]);
      for (const seat of [2, 3]) {
        const presentation = presentStep(runtime, state, seat);
        expect(presentation?.actions).toMatchObject([
          { key: 'wolfKill', availability: { kind: 'unavailable', reason } },
          { key: 'wolfKillAbstain', label: '放弃袭击', availability: { kind: 'available' } },
        ]);
        expect(
          describeStepConfirmation(runtime, state, seat, { actionKey: 'wolfKillAbstain' }),
        ).toEqual({
          title: '放弃袭击？',
          body: null,
          tone: 'default',
        });
        expect(
          decideStepSubmission(runtime, state, seat, {
            stepId: 'wolfKill',
            serial: 1,
            actionKey: 'wolfKill',
            seats: [4],
          }),
        ).toEqual({ kind: 'reject', reason: 'REASON_STEP_STALE' });
        const abstention = decideStepSubmission(runtime, state, seat, {
          stepId: 'wolfKill',
          serial: 1,
          actionKey: 'wolfKillAbstain',
        });
        if (abstention.kind === 'reject') throw new Error('[FAIL-FAST] Abstention was rejected');
        for (const event of abstention.events) slice = evolveStepSlice(slice, event);
        if (seat === 2) expect(evaluateStepProgress(runtime, state, 100)).toEqual([]);
      }
      const countdown = evaluateStepProgress(runtime, state, 100);
      expect(countdown).toEqual([{ type: 'deadlineArmed', deadlineMs: 5100 }]);
      for (const event of countdown) slice = evolveStepSlice(slice, event);
      expect(evaluateStepProgress(runtime, state, 5099)).toEqual([]);
      expect(evaluateStepProgress(runtime, state, 5100)).toMatchObject([
        { type: 'advanced', next: null },
      ]);
    },
  );

  it('does not make a mechanical wolf a voter through a borrowed wolf ability', () => {
    const step = wolfKillStep;
    const state = createState('wolfRobot', {
      identities: {
        1: { dealtRole: 'wolfRobot', currentRole: 'wolfRobot', borrowedAbilityRole: 'wolf' },
        2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'dreamcatcher', currentRole: 'dreamcatcher', borrowedAbilityRole: null },
      },
    });

    expect(step.actors(createRoleContext(state, null))).toEqual([3]);
  });

  it('lets unblocked wolves vote when another wolf is night-locked', () => {
    const state = createState('wolf', {
      identities: {
        1: { dealtRole: 'wolf', currentRole: 'wolf', borrowedAbilityRole: null },
        2: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        3: { dealtRole: 'cupid', currentRole: 'cupid', borrowedAbilityRole: null },
        4: { dealtRole: 'villager', currentRole: 'villager', borrowedAbilityRole: null },
      },
    });
    const facts: WerewolfNightFacts = {
      ...EMPTY_FACTS,
      disabledAbilities: [{ roleId: 'wolfQueen', seat: 2, sourceRoleId: 'nightmare' }],
    };
    const context = createRoleContext(state, null, facts);
    const voteContext = {
      ...context,
      record: {
        bySeat: {
          1: {
            submissions: [{ actionKey: 'wolfKill', seats: [3], cardIndex: null }],
            result: null,
            isResultAcknowledged: false,
          },
        },
      },
    };

    expect(wolfKillStep.actors(context)).toEqual([1, 2]);
    const attack = wolfKillStep.actions[0];
    expect(attack?.availability?.({ ...context, seat: 2 })).toEqual({
      kind: 'unavailable',
      reason: '被噩梦之影恐惧，本夜无法袭击',
    });
    expect(wolfKillStep.completion?.(voteContext)).toEqual({ kind: 'armCountdown' });
    const runtime = createRuntimeForStep(wolfKillStep, state, voteContext.record, facts);
    expect(presentStep(runtime, state, 1)?.progress).toEqual({ done: 1, total: 1 });
  });

  it('applies witch resources, self-save rules, and wolf-attack protection', () => {
    const role = requireRole('witch');
    const step = role.steps[0];
    if (step === undefined) throw new Error('[FAIL-FAST] Witch action is missing');
    const antidote = step.actions.find((action) => action.key === 'antidote');
    const poison = step.actions.find((action) => action.key === 'poison');
    if (antidote?.kind !== 'direct' || poison?.kind !== 'pickSeats') {
      throw new Error('[FAIL-FAST] Witch actions are missing');
    }
    const state = createState('witch');
    const context = {
      ...createRoleContext(state, 1),
      resolvedWolfKillTarget: 2,
    };
    const selfAttackContext = {
      ...context,
      resolvedWolfKillTarget: 1,
    };
    const selfHealContext = {
      ...selfAttackContext,
      state: { ...selfAttackContext.state, rules: { witchCanSelfHeal: true } },
    };

    expect(antidote.availability?.(selfAttackContext)).toEqual({
      kind: 'unavailable',
      reason: '本局规则不允许自救',
    });
    expect(antidote.availability?.(selfHealContext)).toEqual({ kind: 'available' });
    expect(antidote.resolve(context).facts).toMatchObject({
      resourceUses: [{ roleId: 'witch', seat: 1, resource: 'antidote' }],
      deathEffects: [
        {
          kind: 'protect',
          source: 1,
          target: 4,
          against: ['wolfKill'],
          conflictGroup: 'wolfSave',
        },
      ],
    });
    expect(poison.resolve(context, [2]).facts).toMatchObject({
      resourceUses: [{ roleId: 'witch', seat: 1, resource: 'poison' }],
      deathEffects: [{ kind: 'attack', cause: 'poison', source: 1, target: 4 }],
    });
  });

  it('records magician swaps without applying a prior location swap', () => {
    const role = requireRole('magician');
    const step = role.steps[0];
    const action = step?.actions[0];
    if (action?.kind !== 'pickSeats') {
      throw new Error('[FAIL-FAST] Magician swap action is missing');
    }
    const state = createState('magician');
    const context = createRoleContext(state, 1);

    expect(action.resolve(context, [2, 3]).facts).toMatchObject({
      locationSwaps: [{ first: 2, second: 3 }],
      selections: [
        { roleId: 'magician', actorSeat: 1, chosenSeat: 2, landingSeat: 2 },
        { roleId: 'magician', actorSeat: 1, chosenSeat: 3, landingSeat: 3 },
      ],
    });
  });

  it('requires a mechanical wolf that learned hunter to view its skill status', () => {
    const role = requireRole('wolfRobot');
    const step = role.steps[0];
    if (step === undefined || !('isSeatSettled' in step)) {
      throw new Error('[FAIL-FAST] Wolf robot settlement override is missing');
    }
    const isSeatSettled = step.isSeatSettled;
    if (isSeatSettled === undefined) {
      throw new Error('[FAIL-FAST] Wolf robot settlement override is missing');
    }
    const view = step.actions.find((action) => action.kind === 'view');
    if (view?.kind !== 'view') throw new Error('[FAIL-FAST] Hunter status view is missing');
    const state = createState('wolfRobot');
    const learningState = createState('wolfRobot', {
      identities: {
        1: { dealtRole: 'wolfRobot', currentRole: 'wolfRobot', borrowedAbilityRole: null },
        2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'hunter', currentRole: 'hunter', borrowedAbilityRole: null },
      },
      sight: { roleOverridesBySeat: { 4: 'seer' } },
    });
    const learningAction = step.actions.find((action) => action.key === 'wolfRobotLearn');
    if (learningAction?.kind !== 'pickSeats') {
      throw new Error('[FAIL-FAST] Wolf robot learning action is missing');
    }
    const learningResult = learningAction.resolve(createRoleContext(learningState, 1), [2]);
    const pendingInfectionLearningResult = learningAction.resolve(
      createRoleContext(learningState, 1, {
        ...EMPTY_FACTS,
        conversionAttempts: [{ actorSeat: 3, targetSeat: 4 }],
      }),
      [2],
    );
    const infectedLearningState = createState('wolfRobot', {
      ...learningState,
      identities: {
        ...learningState.identities,
        4: { dealtRole: 'hunter', currentRole: 'wolf', borrowedAbilityRole: null },
      },
    });
    const infectedLearningResult = learningAction.resolve(
      createRoleContext(infectedLearningState, 1),
      [2],
    );
    const learningResultValue = 'result' in learningResult ? learningResult.result : undefined;
    const pendingInfectionLearningResultValue =
      'result' in pendingInfectionLearningResult
        ? pendingInfectionLearningResult.result
        : undefined;
    const infectedLearningResultValue =
      'result' in infectedLearningResult ? infectedLearningResult.result : undefined;
    if (
      learningResultValue === undefined ||
      pendingInfectionLearningResultValue === undefined ||
      infectedLearningResultValue === undefined
    ) {
      throw new Error('[FAIL-FAST] Wolf robot identity result is missing');
    }
    const learnedHunter = {
      submissions: [{ actionKey: 'wolfRobotLearn', seats: [2], cardIndex: null }],
      result: { kind: 'identityCheck' as const, chosenSeat: 2, landingSeat: 2, roleId: 'hunter' },
      isResultAcknowledged: true,
    };
    const context = createRoleContext(state, 1, EMPTY_FACTS, {
      bySeat: { 1: learnedHunter },
    });

    expect(learningResultValue).toEqual({
      kind: 'identityCheck',
      chosenSeat: 2,
      landingSeat: 4,
      roleId: 'hunter',
    });
    expect(pendingInfectionLearningResultValue).toMatchObject({
      kind: 'identityCheck',
      landingSeat: 4,
      roleId: 'hunter',
    });
    expect(infectedLearningResultValue).toMatchObject({
      kind: 'identityCheck',
      landingSeat: 4,
      roleId: 'wolf',
    });
    expect(learningResult.facts?.identityChanges).toEqual([]);
    expect(learningResult.facts?.sightOverrides).toEqual([{ seat: 1, roleId: 'hunter' }]);
    expect(learningResult.facts?.disabledAbilities).toEqual([]);
    expect(view.availability?.(context)).toEqual({ kind: 'available' });
    expect(isSeatSettled(context, learnedHunter)).toBe(false);
    expect(
      isSeatSettled(context, {
        ...learnedHunter,
        submissions: [
          ...learnedHunter.submissions,
          { actionKey: 'wolfRobotHunterStatus', seats: [], cardIndex: null },
        ],
      }),
    ).toBe(true);

    const pendingRuntime = createRuntime(role, state, {
      bySeat: { 1: { ...learnedHunter, isResultAcknowledged: false } },
    });
    expect(
      decideStepSubmission(pendingRuntime, state, 1, {
        stepId: 'wolfRobotLearn',
        serial: 1,
        actionKey: 'wolfRobotHunterStatus',
      }),
    ).toEqual({ kind: 'reject', reason: 'REASON_STEP_STALE' });
    expect(
      decideStepSubmission(pendingRuntime, state, 1, {
        stepId: 'wolfRobotLearn',
        serial: 1,
        actionKey: STEP_RESULT_ACK_ACTION_KEY,
      }).kind,
    ).toBe('accept');
    const acknowledgedRuntime = createRuntime(role, state, { bySeat: { 1: learnedHunter } });
    expect(
      decideStepSubmission(acknowledgedRuntime, state, 1, {
        stepId: 'wolfRobotLearn',
        serial: 1,
        actionKey: 'wolfRobotHunterStatus',
      }).kind,
    ).toBe('accept');
  });

  it('creates Cupid links before the magician swap and reveals the partner privately', () => {
    const role = requireRole('cupid');
    const chooseStep = role.steps[0];
    const revealStep = role.steps[1];
    const action = chooseStep?.actions[0];
    const reveal = revealStep?.actions[0];
    if (action?.kind !== 'pickSeats' || reveal?.kind !== 'view') {
      throw new Error('[FAIL-FAST] Cupid actions are missing');
    }
    const state = createState('cupid');
    const context = createRoleContext(state, 1);
    const facts = action.resolve(context, [1, 2]).facts;
    if (facts === undefined) throw new Error('[FAIL-FAST] Cupid facts are missing');
    const revealContext = createRoleContext(state, 1, { ...EMPTY_FACTS, ...facts });

    expect(facts.selections).toEqual([
      { roleId: 'cupid', actorSeat: 1, chosenSeat: 1, landingSeat: 1 },
      { roleId: 'cupid', actorSeat: 1, chosenSeat: 2, landingSeat: 2 },
    ]);
    expect(facts.deathEffects).toEqual([
      {
        kind: 'link',
        source: 1,
        from: 1,
        to: 2,
        cause: 'coupleLink',
        isMutual: true,
      },
    ]);
    expect(reveal.content(revealContext)).toBe('你是情侣之一，你的另一半是：3号');
  });

  it('records Piper selections at the magician-swapped landing seats', () => {
    const role = requireRole('piper');
    const chooseStep = role.steps[0];
    const revealStep = role.steps[1];
    const action = chooseStep?.actions[0];
    const reveal = revealStep?.actions[0];
    if (action?.kind !== 'pickSeats' || reveal?.kind !== 'view') {
      throw new Error('[FAIL-FAST] Piper actions are missing');
    }
    const state = createState('piper');
    const context = createRoleContext(state, 1);
    const facts = action.resolve(context, [2, 3]).facts;
    if (facts === undefined) throw new Error('[FAIL-FAST] Piper facts are missing');
    const revealContext = createRoleContext(state, 4, { ...EMPTY_FACTS, ...facts });

    expect(facts.selections?.map((selection) => selection.landingSeat)).toEqual([4, 3]);
    expect(reveal.content(revealContext)).toBe('你已被吹笛者催眠，当前被催眠的座位：4号、5号');
  });

  it('converts only an adjacent non-wolf target chosen by the awakened gargoyle', () => {
    const role = requireRole('awakenedGargoyle');
    const step = role.steps[0];
    const action = step?.actions[0];
    if (action?.kind !== 'pickSeats') {
      throw new Error('[FAIL-FAST] Awakened gargoyle action is missing');
    }
    const state = createState('awakenedGargoyle');
    const context = {
      ...createRoleContext(state, 1),
      isAdjacentToWolfFaction: (seat: number) => seat === 2,
    };
    const result = action.resolve(context, [2]);

    expect(action.seats(context).find((option) => option.seat === 2)?.unavailableReason).toBeNull();
    expect(
      action.seats(context).find((option) => option.seat === 4)?.unavailableReason,
    ).not.toBeNull();
    expect(result.facts?.factionChanges).toEqual([{ seat: 4, faction: 'wolf' }]);
  });

  it('infects only the resolved non-wolf attack target and reports it to that seat', () => {
    const role = requireRole('seedWolf');
    const step = role.steps[0];
    const revealStep = role.steps[1];
    const action = step?.actions[0];
    const reveal = revealStep?.actions[0];
    if (action?.kind !== 'direct' || reveal?.kind !== 'view') {
      throw new Error('[FAIL-FAST] Seed wolf actions are missing');
    }
    const state = createState('seedWolf');
    const context = {
      ...createRoleContext(state, 1),
      resolvedWolfKillTarget: 2,
    };
    const facts = action.resolve(context).facts;
    if (facts === undefined) throw new Error('[FAIL-FAST] Seed wolf facts are missing');

    expect(action.availability?.(context)).toEqual({ kind: 'available' });
    expect(step?.situationHints?.(context)).toEqual(['3号被狼人袭击']);
    expect(
      step?.reviewSuffix?.(context, {
        actionKey: 'seedWolfInfect',
        seats: [2],
        cardIndex: null,
      }),
    ).toBe('（实际为5号）');
    expect(facts.conversionAttempts).toEqual([{ actorSeat: 1, targetSeat: 4 }]);
    expect(reveal.content(createRoleContext(state, 2, { ...EMPTY_FACTS, ...facts }))).toBe(
      '你未被感染',
    );
    const infectedState = createState('seedWolf', {
      identities: {
        1: { dealtRole: 'seedWolf', currentRole: 'seedWolf', borrowedAbilityRole: null },
        2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'dreamcatcher', currentRole: 'wolf', borrowedAbilityRole: null },
      },
    });
    expect(reveal.content(createRoleContext(infectedState, 4, { ...EMPTY_FACTS, ...facts }))).toBe(
      '你已被种狼感染并转化为普通狼人',
    );
    expect(action.availability?.({ ...context, resolvedWolfKillTarget: 3 })).toMatchObject({
      kind: 'unavailable',
    });
  });

  it('records Wolf Girl confessions at the landing seat and blocks wolf-faction targets', () => {
    const role = requireRole('wolfGirl');
    const step = role.steps[0];
    const revealStep = role.steps[1];
    const action = step?.actions[0];
    const reveal = revealStep?.actions[0];
    if (action?.kind !== 'pickSeats' || reveal?.kind !== 'view') {
      throw new Error('[FAIL-FAST] Wolf Girl actions are missing');
    }
    const state = createState('wolfGirl', {
      identities: {
        1: { dealtRole: 'wolfGirl', currentRole: 'wolfGirl', borrowedAbilityRole: null },
        2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'villager', currentRole: 'villager', borrowedAbilityRole: null },
      },
    });
    const context = createRoleContext(state, 1);
    const result = action.resolve(context, [2]);
    const facts = result.facts;
    if (facts === undefined) throw new Error('[FAIL-FAST] Wolf Girl facts are missing');

    expect(action.seats(context).find((option) => option.seat === 3)?.unavailableReason).toBe(
      '不能选择狼人阵营的玩家',
    );
    expect(facts.wolfGirlConfessions).toEqual([{ actorSeat: 1, targetSeat: 4 }]);
    expect(reveal.content(createRoleContext(state, 4, { ...EMPTY_FACTS, ...facts }))).toBe(
      '你被表白了，狼女孩是：2号',
    );
  });

  it('keeps wolf-witch faction restrictions on the selected seat', () => {
    const role = requireRole('wolfWitch');
    const state = createState('wolfWitch');
    const presentation = presentStep(createRuntime(role, state), state, 1);
    const action = presentation?.actions.find((entry) => entry.kind === 'pickSeats');
    if (action?.kind !== 'pickSeats') throw new Error('[FAIL-FAST] Wolf-witch action is missing');

    expect(action.seats.find((option) => option.seat === 3)?.unavailableReason).toBeTruthy();
    expect(action.seats.find((option) => option.seat === 2)?.unavailableReason).toBeNull();
  });

  it('locks a nightmare target and retains the skip action', () => {
    const role = requireRole('seer');
    const state = createState('seer');
    const facts: WerewolfNightFacts = {
      ...EMPTY_FACTS,
      disabledAbilities: [{ roleId: '*', seat: 1, sourceRoleId: 'nightmare' }],
    };
    const presentation = presentStep(createRuntime(role, state, { bySeat: {} }, facts), state, 1);

    expect(presentation?.actions.map((action) => action.key)).toEqual(['seerCheck', '$skip']);
    expect(presentation?.actions[0]?.availability).toEqual({
      kind: 'unavailable',
      reason: '被噩梦之影恐惧，本夜无法使用技能',
    });
  });

  it('resolves death effects at the swapped landing seat', () => {
    const guardResult = resolveRoleTarget('guard', createState('guard'), 2);
    const poisonerResult = resolveRoleTarget('poisoner', createState('poisoner'), 2);

    expect(guardResult.facts?.deathEffects).toEqual([
      {
        kind: 'protect',
        source: 1,
        target: 4,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
    ]);
    expect(poisonerResult.facts?.deathEffects).toEqual([
      { kind: 'attack', cause: 'poison', source: 1, target: 4 },
    ]);
  });

  it('does not kill a checked wolf on the first night', () => {
    const state = createState('pureWhite');
    const result = resolveRoleTarget('pureWhite', state, 3);

    expect(result.facts?.deathEffects).toEqual([]);
  });

  it('creates role-specific links at the landing seat', () => {
    const dream = resolveRoleTarget('dreamcatcher', createState('dreamcatcher'), 2);
    const charm = resolveRoleTarget('wolfQueen', createState('wolfQueen'), 2);

    expect(dream.facts?.deathEffects?.map((effect) => effect.kind)).toEqual(['link', 'shelter']);
    expect(charm.facts?.deathEffects).toEqual([
      {
        kind: 'link',
        source: 1,
        from: 1,
        to: 4,
        cause: 'wolfQueenLink',
        isMutual: false,
      },
    ]);
  });

  it('binds the shadow only when the swapped mimic target is the avenger', () => {
    const state = createState('shadow', {
      identities: {
        1: { dealtRole: 'shadow', currentRole: 'shadow', borrowedAbilityRole: null },
        2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'avenger', currentRole: 'avenger', borrowedAbilityRole: null },
      },
    });

    expect(resolveRoleTarget('shadow', state, 2).facts?.deathEffects).toEqual([
      {
        kind: 'link',
        source: 1,
        from: 1,
        to: 4,
        cause: 'bondedLink',
        isMutual: true,
      },
    ]);
  });

  it('defers eclipse wolf queen skill loss until the downstream effect succeeds', () => {
    const result = resolveRoleTarget('eclipseWolfQueen', createState('eclipseWolfQueen'), 2);

    expect(result.facts?.disabledAbilities).toEqual([]);
    expect(result.facts?.selections).toEqual([
      {
        roleId: 'eclipseWolfQueen',
        actorSeat: 1,
        chosenSeat: 2,
        landingSeat: 4,
      },
    ]);
  });

  it('requires the thief to choose a wolf card when one is present', () => {
    const role = requireRole('thief');
    const step = role.steps[0];
    if (step === undefined) throw new Error('[FAIL-FAST] Thief step is missing');
    const action = step.actions[0];
    if (action?.kind !== 'pickCard') throw new Error('[FAIL-FAST] Thief card action is missing');
    const state = createState('thief');
    const context = createRuntime(role, state).createContext(state, EMPTY_FACTS, 1, { bySeat: {} });

    const cards = action.cards(context);
    expect(cards[0]?.unavailableReason).not.toBeNull();
    expect(cards[1]?.unavailableReason).toBeNull();
    expect(action.resolve(context, 1)).toMatchObject({
      facts: {
        identityChanges: [{ kind: 'replaceCurrentRole', seat: 1, roleId: 'hiddenWolf' }],
      },
      result: { kind: 'cardSelection', roleId: 'hiddenWolf' },
    });
  });

  it('allows the thief to choose either card when neither card is a wolf', () => {
    const role = requireRole('thief');
    const step = role.steps[0];
    if (step === undefined) throw new Error('[FAIL-FAST] Thief step is missing');
    const action = step.actions[0];
    if (action?.kind !== 'pickCard') throw new Error('[FAIL-FAST] Thief card action is missing');
    const state = createState('thief');
    const context = createRuntime(role, state).createContext(state, EMPTY_FACTS, 1, { bySeat: {} });
    const noWolfContext = {
      ...context,
      bottomCardsOf: () => [
        {
          index: 0,
          label: 'Seer',
          unavailableReason: null,
          roleId: 'seer',
          faction: 'god' as const,
        },
        {
          index: 1,
          label: 'Villager',
          unavailableReason: null,
          roleId: 'villager',
          faction: 'villager' as const,
        },
      ],
    };

    expect(action.cards(noWolfContext)[0]?.unavailableReason).toBeNull();
    expect(action.resolve(noWolfContext, 0).facts?.identityChanges).toEqual([
      { kind: 'replaceCurrentRole', seat: 1, roleId: 'seer' },
    ]);
  });

  it('lets the thief acknowledge the chosen card after its identity changes', () => {
    const role = requireRole('thief');
    const state = createState('thief', {
      identities: {
        1: { dealtRole: 'thief', currentRole: 'seer', borrowedAbilityRole: null },
        2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'dreamcatcher', currentRole: 'dreamcatcher', borrowedAbilityRole: null },
      },
    });
    const seatRecord = {
      submissions: [{ actionKey: 'thiefChoose', seats: [], cardIndex: 0 }],
      result: { kind: 'cardSelection' as const, roleId: 'seer' },
      isResultAcknowledged: false,
    };
    const record = { bySeat: { 1: seatRecord } };
    const runtime = createRuntime(role, state, record);

    expect(presentStep(runtime, state, 1)?.pendingResult).toEqual({
      title: '选择的身份',
      text: '预言家',
    });
    expect(evaluateStepProgress(runtime, state, 100)).toEqual([]);
    expect(
      decideStepSubmission(runtime, state, 1, {
        stepId: 'thiefChoose',
        serial: 1,
        actionKey: STEP_RESULT_ACK_ACTION_KEY,
      }),
    ).toMatchObject({ kind: 'accept' });
    const acknowledged = { bySeat: { 1: { ...seatRecord, isResultAcknowledged: true } } };
    expect(
      evaluateStepProgress(createRuntime(role, state, acknowledged), state, 100),
    ).toMatchObject([{ type: 'advanced', next: null }]);
  });

  it('grants the treasure master the selected card as a borrowed ability', () => {
    const role = requireRole('treasureMaster');
    const step = role.steps[0];
    if (step === undefined) throw new Error('[FAIL-FAST] Treasure master step is missing');
    const action = step.actions[0];
    if (action?.kind !== 'pickCard') {
      throw new Error('[FAIL-FAST] Treasure master card action is missing');
    }
    const state = createState('treasureMaster');
    const context = createRuntime(role, state).createContext(state, EMPTY_FACTS, 1, { bySeat: {} });

    expect(action.resolve(context, 0)).toMatchObject({
      facts: {
        identityChanges: [{ kind: 'grantBorrowedAbility', seat: 1, roleId: 'seer' }],
        cardSelections: [{ roleId: 'treasureMaster', actorSeat: 1, cardIndex: 0 }],
      },
      result: { kind: 'cardSelection', roleId: 'seer' },
    });
  });
});

function createState(
  actorRole: string,
  changes: Partial<WerewolfRoleState> = {},
): WerewolfRoleState {
  return {
    identities: {
      1: { dealtRole: actorRole, currentRole: actorRole, borrowedAbilityRole: null },
      2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
      3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
      4: { dealtRole: 'dreamcatcher', currentRole: 'dreamcatcher', borrowedAbilityRole: null },
    },
    location: { swap: { first: 2, second: 4 } },
    sight: { roleOverridesBySeat: {} },
    seatedSeats: [1, 2, 3, 4],
    rules: { witchCanSelfHeal: false },
    usedResources: [],
    ...changes,
  };
}

function createRuntime(
  role: WerewolfRoleDefinition,
  state: WerewolfRoleState,
  record: StepRecord<WerewolfRoleStepResult> = { bySeat: {} },
  facts: WerewolfNightFacts = EMPTY_FACTS,
  stepId: string | undefined = role.steps[0]?.id,
): StepRuntime<
  string,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
> {
  const step = role.steps.find((entry) => entry.id === stepId);
  if (step === undefined) throw new Error(`[FAIL-FAST] ${role.id} has no step`);
  return createRuntimeForStep(step, state, record, facts);
}

function createRuntimeForStep(
  step: StepDefinition<string, WerewolfRoleStepContext, WerewolfNightFacts, WerewolfRoleStepResult>,
  state: WerewolfRoleState,
  record: StepRecord<WerewolfRoleStepResult> = { bySeat: {} },
  facts: WerewolfNightFacts = EMPTY_FACTS,
): StepRuntime<
  string,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
> {
  const definitions: Record<
    string,
    StepDefinition<string, WerewolfRoleStepContext, WerewolfNightFacts, WerewolfRoleStepResult>
  > = { [step.id]: step };
  return {
    definitions,
    getSlice: () => ({
      order: [step.id],
      current: { stepId: step.id, serial: 1 },
      records: { [step.id]: record },
      deadlineMs: null,
    }),
    getFacts: () => facts,
    createContext: (currentState, currentFacts, seat, currentRecord) => ({
      ...createRoleContext(currentState, seat, currentFacts, currentRecord),
    }),
    isAudioPlaying: () => false,
    seatedSeats: (currentState) => currentState.seatedSeats,
  };
}

function createRoleContext(
  state: WerewolfRoleState,
  seat: number | null,
  facts: WerewolfNightFacts = EMPTY_FACTS,
  record: StepRecord<WerewolfRoleStepResult> = { bySeat: {} },
): WerewolfRoleStepContext {
  const roleById = new Map<string, WerewolfRoleDefinition>(
    ROLE_DEFINITIONS.map((entry) => [entry.id, entry] as const),
  );
  return {
    state,
    facts,
    seat,
    record,
    role: createWerewolfRoleContext(state.identities, state.location, state.sight),
    teamOfRole: (roleId) => {
      const found = roleById.get(roleId);
      if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
      return found.traits.team;
    },
    factionOfRole: (roleId) => {
      const found = roleById.get(roleId);
      if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
      return found.traits.faction;
    },
    checkReactionOfRole: (roleId) => {
      const found = roleById.get(roleId);
      if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
      return found.traits.checkReaction;
    },
    doesRoleVoteWithWolves: (roleId) => {
      const found = roleById.get(roleId);
      if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
      return found.traits.recognition?.participatesInWolfVote === true;
    },
    isWolfKillTargetForbidden: (seat) => {
      const roleId = createWerewolfRoleContext(
        state.identities,
        state.location,
        state.sight,
      ).roleOf(seat);
      const found = roleById.get(roleId);
      if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
      return found.traits.wolfKillTargetForbidden === true;
    },
    isAdjacentToWolfFaction: () => false,
    roleNameOf: (roleId) => {
      const found = roleById.get(roleId);
      if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
      return found.card.name;
    },
    randomBoolean: () => true,
    nightPresence: resolveNightPresenceFacts(
      Object.values(state.identities).map((identity) => identity.currentRole),
      WEREWOLF_PRESENCE_DECLARATIONS,
    ),
    resolvedWolfKillTarget: null,
    canShootAtNight: () => true,
    abilityLockReasonOf: (roleId) => requireRole(roleId).abilityLockReason ?? '',
    wolfAttackLockOf: (roleId) => {
      const lock = requireRole(roleId).wolfAttackLock;
      if (lock === undefined) throw new Error(`[TEST] ${roleId} declares no wolf attack wording`);
      return lock;
    },
    bottomCardsOf: (actingSeat, roleId) => {
      if (roleId === 'thief') {
        return [
          {
            index: 0,
            label: 'Seer',
            unavailableReason: null,
            roleId: 'seer',
            faction: 'god',
          },
          {
            index: 1,
            label: 'Hidden Wolf',
            unavailableReason: null,
            roleId: 'hiddenWolf',
            faction: 'wolf',
          },
        ];
      }
      if (roleId === 'treasureMaster') {
        return [
          {
            index: 0,
            label: 'Seer',
            unavailableReason: null,
            roleId: 'seer',
            faction: 'god',
          },
          {
            index: 1,
            label: 'Villager',
            unavailableReason: null,
            roleId: 'villager',
            faction: 'villager',
          },
        ];
      }
      throw new Error(`[FAIL-FAST] No bottom cards for ${roleId} at seat ${actingSeat}`);
    },
  };
}

function getCheckResult(roleId: string): WerewolfRoleStepResult | null {
  if (roleId === 'thief') return { kind: 'cardSelection', roleId: 'hiddenWolf' };
  if (roleId === 'treasureMaster') return { kind: 'cardSelection', roleId: 'seer' };
  if (['seer', 'mirrorSeer', 'drunkSeer'].includes(roleId)) {
    return { kind: 'factionCheck', chosenSeat: 2, landingSeat: 4, faction: 'good' };
  }
  if (['psychic', 'gargoyle', 'pureWhite', 'wolfWitch'].includes(roleId)) {
    return { kind: 'identityCheck', chosenSeat: 2, landingSeat: 4, roleId: 'dreamcatcher' };
  }
  if (roleId === 'wolfRobot') {
    return { kind: 'identityCheck', chosenSeat: 2, landingSeat: 4, roleId: 'hunter' };
  }
  return null;
}

function requireRole(roleId: string): WerewolfRoleDefinition {
  const role = ROLE_DEFINITIONS.find((entry) => entry.id === roleId);
  if (role === undefined) throw new Error(`[FAIL-FAST] Missing role ${roleId}`);
  return role;
}

function resolveRoleTarget(
  roleId: string,
  state: WerewolfRoleState,
  chosenSeat: number,
): { readonly facts?: Partial<WerewolfNightFacts>; readonly result?: WerewolfRoleStepResult } {
  const role = requireRole(roleId);
  const step = role.steps[0];
  if (step === undefined) throw new Error(`[FAIL-FAST] ${roleId} has no step`);
  const action = step.actions[0];
  if (action?.kind !== 'pickSeats') {
    throw new Error(`[FAIL-FAST] ${roleId} does not have a seat-selection action`);
  }
  const context = createRuntime(role, state).createContext(state, EMPTY_FACTS, 1, { bySeat: {} });
  return action.resolve(context, [chosenSeat]);
}
