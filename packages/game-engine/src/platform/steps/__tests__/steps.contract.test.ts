import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { ROLE_SPECS } from '../../../games/werewolf/domain/models/roles/spec';
import { NIGHT_END_AUDIO_KEY } from '../../audio';
import {
  buildStepReviewLines,
  decideStepSubmission,
  defineCopy,
  describeStepConfirmation,
  evaluateStepProgress,
  evolveStepSlice,
  getStepOverrideViolations,
  presentStep,
  renderCopy,
  STEP_COPY,
  STEP_OVERRIDE_ALLOWLIST,
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepContextBase,
  type StepDefinition,
  type StepRuntime,
  type StepSlice,
} from '..';

type TestStepId = 'pick';

interface TestFacts {
  readonly selectedSeat: number | null;
}

interface TestState {
  readonly facts: TestFacts;
  readonly isAudioPlaying: boolean;
  readonly seats: readonly number[];
  readonly step: StepSlice<TestStepId, string>;
}

type TestContext = StepContextBase<TestState, TestFacts, string>;

const copy = defineCopy({ resultTitle: 'Result' });

const definition: StepDefinition<TestStepId, TestContext, TestFacts, string> = {
  id: 'pick',
  title: 'Test',
  audio: () => ({ begin: 'seer', end: 'seer' }),
  actors: () => [0],
  actions: [
    {
      kind: 'pickSeats',
      key: 'inspect',
      name: 'inspect',
      count: { min: 1, max: 1 },
      seats: () => [
        { seat: 1, unavailableReason: null },
        { seat: 2, unavailableReason: 'unavailable' },
      ],
      phrase: (seats) => `inspect${seats[0] === undefined ? '' : `${seats[0] + 1}号`}`,
      consequence: () => 'effect',
      resolve: (_context, seats) => ({
        facts: { selectedSeat: seats[0] ?? null },
        result: 'good',
      }),
    },
  ],
  skippable: () => true,
  renderResult: (_context, result) => ({ title: copy.resultTitle, text: result }),
  reviewSubject: (_context, seat) => `Player${seat}`,
};

const runtime: StepRuntime<TestStepId, TestState, TestContext, TestFacts, string> = {
  definitions: { pick: definition },
  getSlice: (state) => state.step,
  getFacts: (state) => state.facts,
  createContext: (state, facts, seat, record) => ({ state, facts, seat, record }),
  isAudioPlaying: (state) => state.isAudioPlaying,
  seatedSeats: (state) => state.seats,
};

function createState(): TestState {
  return {
    facts: { selectedSeat: null },
    isAudioPlaying: false,
    seats: [0, 1, 2],
    step: {
      order: ['pick'],
      current: { stepId: 'pick', serial: 4 },
      records: {},
      deadlineMs: null,
    },
  };
}

function runtimeWithDefinition(
  nextDefinition: StepDefinition<TestStepId, TestContext, TestFacts, string>,
): StepRuntime<TestStepId, TestState, TestContext, TestFacts, string> {
  return { ...runtime, definitions: { pick: nextDefinition } };
}

describe('platform step runtime', () => {
  it('derives presentation, confirmation, facts, result acknowledgement, and review text', () => {
    const state = createState();
    const presentation = presentStep(runtime, state, 0);

    expect(presentation?.message).toContain(STEP_COPY.skip);
    expect(presentation?.progress).toEqual({ done: 0, total: 1 });
    expect(
      describeStepConfirmation(runtime, state, 0, {
        actionKey: 'inspect',
        seats: [1],
      }),
    ).toEqual({ title: 'inspect2号？', body: 'effect', tone: 'default' });

    const rejected = decideStepSubmission(runtime, state, 0, {
      stepId: 'pick',
      serial: 4,
      actionKey: 'inspect',
      seats: [2],
    });
    expect(rejected).toEqual({ kind: 'reject', reason: 'REASON_STEP_STALE' });

    const accepted = decideStepSubmission(runtime, state, 0, {
      stepId: 'pick',
      serial: 4,
      actionKey: 'inspect',
      seats: [1],
    });
    expect(accepted.kind).toBe('accept');
    if (accepted.kind === 'reject') throw new Error('Expected accepted step submission');
    const submittedEvent = accepted.events[0];
    if (submittedEvent === undefined) throw new Error('Expected a submitted event');
    expect(submittedEvent).toMatchObject({
      type: 'submitted',
      facts: { selectedSeat: 1 },
      result: 'good',
    });

    const submittedState = {
      ...state,
      step: evolveStepSlice(state.step, submittedEvent),
    };
    expect(presentStep(runtime, submittedState, 0)?.pendingResult).toEqual({
      title: 'Result',
      text: 'good',
    });
    expect(buildStepReviewLines(runtime, submittedState)).toEqual([
      { stepId: 'pick', seat: 0, text: 'Player0inspect2号' },
    ]);

    const acknowledgement = decideStepSubmission(runtime, submittedState, 0, {
      stepId: 'pick',
      serial: 4,
      actionKey: STEP_RESULT_ACK_ACTION_KEY,
    });
    expect(acknowledgement.kind).toBe('accept');
    if (acknowledgement.kind === 'reject') throw new Error('Expected result acknowledgement');
    const acknowledgementEvent = acknowledgement.events[0];
    if (acknowledgementEvent === undefined) throw new Error('Expected an acknowledgement event');
    const acknowledgedState = {
      ...submittedState,
      step: evolveStepSlice(submittedState.step, acknowledgementEvent),
    };
    expect(evaluateStepProgress(runtime, acknowledgedState, 100)).toEqual([
      {
        type: 'advanced',
        next: null,
        audio: [{ audioKey: 'seer', isEndAudio: true }, { audioKey: NIGHT_END_AUDIO_KEY }],
      },
    ]);
  });

  it('rejects stale step serials and invalid seat counts', () => {
    const state = createState();
    expect(
      decideStepSubmission(runtime, state, 0, {
        stepId: 'pick',
        serial: 3,
        actionKey: 'inspect',
        seats: [1],
      }),
    ).toEqual({ kind: 'reject', reason: 'REASON_STEP_STALE' });
    expect(
      decideStepSubmission(runtime, state, 0, {
        stepId: 'pick',
        serial: 4,
        actionKey: 'inspect',
        seats: [],
      }),
    ).toEqual({ kind: 'reject', reason: 'REASON_STEP_STALE' });
  });

  it('describes an available skip and rejects skip payloads with targets', () => {
    const state = createState();
    expect(
      describeStepConfirmation(runtime, state, 0, { actionKey: STEP_SKIP_ACTION_KEY }),
    ).toEqual({ title: '不用技能？', body: null, tone: 'default' });
    expect(
      decideStepSubmission(runtime, state, 0, {
        stepId: 'pick',
        serial: 4,
        actionKey: STEP_SKIP_ACTION_KEY,
      }).kind,
    ).toBe('accept');
    expect(
      decideStepSubmission(runtime, state, 0, {
        stepId: 'pick',
        serial: 4,
        actionKey: STEP_SKIP_ACTION_KEY,
        seats: [1],
      }),
    ).toEqual({ kind: 'reject', reason: 'REASON_STEP_STALE' });
  });

  it('describes skipping a locked step but rejects an unavailable skip', () => {
    const state = createState();
    const required = runtimeWithDefinition({ ...definition, skippable: () => false });
    const locked = runtimeWithDefinition({
      ...definition,
      skippable: () => false,
      lock: () => 'locked',
    });
    expect(() =>
      describeStepConfirmation(required, state, 0, { actionKey: STEP_SKIP_ACTION_KEY }),
    ).toThrow('REASON_STEP_STALE');
    expect(describeStepConfirmation(locked, state, 0, { actionKey: STEP_SKIP_ACTION_KEY })).toEqual(
      { title: '不用技能？', body: null, tone: 'default' },
    );
  });

  it('replaces grouped revisable choices and keeps withdrawn choices withdrawn', () => {
    const pick = definition.actions[0];
    if (pick?.kind !== 'pickSeats') throw new Error('[FAIL-FAST] Test pick action is missing');
    const voteDefinition: StepDefinition<TestStepId, TestContext, TestFacts, string> = {
      ...definition,
      actions: [
        {
          ...pick,
          commit: 'revisable',
          revisionGroup: 'vote',
          resolve: (_context: TestContext, seats: readonly number[]) => ({
            facts: { selectedSeat: seats[0] ?? null },
          }),
        },
        {
          kind: 'direct',
          key: 'abstain',
          name: 'abstain',
          commit: 'revisable',
          revisionGroup: 'vote',
          resolve: () => ({ facts: { selectedSeat: null } }),
        },
        {
          kind: 'direct',
          key: 'withdraw',
          name: 'withdraw',
          availability: (context) =>
            context.record.bySeat[0]?.submissions.length
              ? { kind: 'available' }
              : { kind: 'hidden' },
          resolve: (context) => {
            const actionKey = context.record.bySeat[0]?.submissions[0]?.actionKey;
            if (actionKey === undefined) throw new Error('[FAIL-FAST] No vote to withdraw');
            return { withdrawActionKey: actionKey };
          },
        },
      ],
    };
    const voteRuntime = runtimeWithDefinition(voteDefinition);
    let state = createState();
    const vote = decideStepSubmission(voteRuntime, state, 0, {
      stepId: 'pick',
      serial: 4,
      actionKey: 'inspect',
      seats: [1],
    });
    if (vote.kind === 'reject') throw new Error('[FAIL-FAST] Vote was rejected');
    for (const event of vote.events) state = { ...state, step: evolveStepSlice(state.step, event) };
    expect(presentStep(voteRuntime, state, 0)?.progress).toEqual({ done: 1, total: 1 });
    expect(presentStep(voteRuntime, state, 0)?.actions).toHaveLength(4);

    const abstention = decideStepSubmission(voteRuntime, state, 0, {
      stepId: 'pick',
      serial: 4,
      actionKey: 'abstain',
    });
    if (abstention.kind === 'reject') throw new Error('[FAIL-FAST] Abstention was rejected');
    for (const event of abstention.events) {
      state = { ...state, step: evolveStepSlice(state.step, event) };
    }
    expect(state.step.records.pick?.bySeat[0]?.submissions).toEqual([
      { actionKey: 'abstain', seats: [], cardIndex: null },
    ]);
    const withdrawal = decideStepSubmission(voteRuntime, state, 0, {
      stepId: 'pick',
      serial: 4,
      actionKey: 'withdraw',
    });
    if (withdrawal.kind === 'reject') throw new Error('[FAIL-FAST] Withdrawal was rejected');
    for (const event of withdrawal.events) {
      state = { ...state, step: evolveStepSlice(state.step, event) };
    }
    expect(state.step.records.pick?.bySeat[0]?.submissions).toEqual([]);
    expect(presentStep(voteRuntime, state, 0)?.progress).toEqual({ done: 0, total: 1 });
  });

  it('keeps countdown progression gated while narration is playing', () => {
    const state = {
      ...createState(),
      isAudioPlaying: true,
      step: {
        ...createState().step,
        records: {
          pick: {
            bySeat: {
              0: {
                submissions: [{ actionKey: 'inspect', seats: [1], cardIndex: null }],
                result: null,
                isResultAcknowledged: true,
              },
            },
          },
        },
      },
    };
    expect(evaluateStepProgress(runtime, state, 100)).toEqual([]);
  });

  it('requires every declared progression override to be allowlisted exactly once', () => {
    const definitions = [
      { id: 'wolfKill', completion: () => ({ kind: 'pending' }) },
      { id: 'wolfRobotLearn', isSeatSettled: () => true },
    ];
    expect(getStepOverrideViolations(definitions, STEP_OVERRIDE_ALLOWLIST)).toEqual([]);
    expect(
      getStepOverrideViolations(
        [{ id: 'unexpected', completion: () => ({ kind: 'pending' }) }],
        {},
      ),
    ).toHaveLength(1);
  });

  it('renders copy placeholders and rejects missing values', () => {
    expect(renderCopy('Seat {seat}', { seat: 2 })).toBe('Seat 2');
    expect(() => renderCopy('Seat {seat}')).toThrow('[FAIL-FAST]');
  });

  it('builds the operation hint only from a seat-picking action', () => {
    const multiActionDefinition: StepDefinition<TestStepId, TestContext, TestFacts, string> = {
      ...definition,
      actions: [
        {
          kind: 'direct',
          key: 'activate',
          name: 'activate',
          resolve: () => ({}),
        },
        ...definition.actions,
      ],
    };
    const multiActionRuntime = {
      ...runtime,
      definitions: { pick: multiActionDefinition },
    };

    expect(presentStep(multiActionRuntime, createState(), 0)?.message).toContain(
      '请选择要inspect的玩家',
    );
    expect(presentStep(multiActionRuntime, createState(), 0)?.message).not.toContain('activate');
  });

  it('derives a direct-action phrase, target, and resolution from the declaration', () => {
    const directDefinition: StepDefinition<TestStepId, TestContext, TestFacts, string> = {
      ...definition,
      actions: [
        {
          kind: 'direct',
          key: 'protect',
          name: 'protect',
          target: () => 1,
          resolve: () => ({ facts: { selectedSeat: 1 }, result: 'protected' }),
        },
      ],
    };
    const directRuntime = runtimeWithDefinition(directDefinition);
    const state = createState();

    expect(presentStep(directRuntime, state, 0)?.actions).toContainEqual(
      expect.objectContaining({ kind: 'direct', label: 'protect2号' }),
    );
    expect(
      describeStepConfirmation(directRuntime, state, 0, {
        actionKey: 'protect',
      }),
    ).toEqual({ title: 'protect2号？', body: null, tone: 'default' });
    expect(
      decideStepSubmission(directRuntime, state, 0, {
        stepId: 'pick',
        serial: 4,
        actionKey: 'protect',
      }),
    ).toMatchObject({
      kind: 'accept',
      events: [
        {
          type: 'submitted',
          submission: { seats: [1], cardIndex: null },
          facts: { selectedSeat: 1 },
          result: 'protected',
        },
      ],
    });
  });

  it('presents view content and submits an acknowledgement without a result payload', () => {
    const viewDefinition: StepDefinition<TestStepId, TestContext, TestFacts, string> = {
      ...definition,
      actions: [
        {
          kind: 'view',
          key: 'view',
          name: 'view',
          title: 'Night information',
          contentTitle: 'Fascist recognition',
          content: () => 'private',
        },
      ],
      skippable: () => false,
    };
    const viewRuntime = runtimeWithDefinition(viewDefinition);
    const state = createState();

    expect(presentStep(viewRuntime, state, 0)?.actions).toContainEqual(
      expect.objectContaining({
        kind: 'view',
        label: '查看Night information',
        content: { title: 'Fascist recognition', text: 'private' },
        isAcknowledged: false,
      }),
    );
    const defaultTitleDefinition: StepDefinition<TestStepId, TestContext, TestFacts, string> = {
      ...viewDefinition,
      actions: [
        {
          kind: 'view',
          key: 'view',
          name: 'view',
          title: 'Partner',
          content: () => 'private',
        },
      ],
    };
    expect(
      presentStep(runtimeWithDefinition(defaultTitleDefinition), state, 0)?.actions,
    ).toContainEqual(expect.objectContaining({ content: { title: 'Partner', text: 'private' } }));
    expect(
      decideStepSubmission(viewRuntime, state, 0, {
        stepId: 'pick',
        serial: 4,
        actionKey: 'view',
      }),
    ).toMatchObject({
      kind: 'accept',
      events: [{ type: 'resultAcknowledged', actionKey: 'view' }],
    });
  });

  it('resolves a selected card from its declared option', () => {
    const cardDefinition: StepDefinition<TestStepId, TestContext, TestFacts, string> = {
      ...definition,
      actions: [
        {
          kind: 'pickCard',
          key: 'card',
          name: 'choose',
          cards: () => [
            { index: 3, label: 'first', unavailableReason: null },
            { index: 5, label: 'second', unavailableReason: 'unavailable' },
          ],
          phrase: (card) => `choose ${card.label}`,
          resolve: (_context, cardIndex) => ({
            facts: { selectedSeat: cardIndex },
            result: 'chosen',
          }),
        },
      ],
      skippable: () => false,
    };
    const cardRuntime = runtimeWithDefinition(cardDefinition);
    const state = createState();

    expect(
      decideStepSubmission(cardRuntime, state, 0, {
        stepId: 'pick',
        serial: 4,
        actionKey: 'card',
        cardIndex: 5,
      }),
    ).toEqual({ kind: 'reject', reason: 'REASON_STEP_STALE' });
    expect(
      decideStepSubmission(cardRuntime, state, 0, {
        stepId: 'pick',
        serial: 4,
        actionKey: 'card',
        cardIndex: 3,
      }),
    ).toMatchObject({
      kind: 'accept',
      events: [{ type: 'submitted', submission: { cardIndex: 3 } }],
    });
  });
});

describe('step copy contract', () => {
  it('keeps every Chinese string literal inside a defineCopy table', () => {
    const violations: string[] = [];
    const sourceDirectories = [
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, '../../../games/werewolf/roles'),
    ];
    const files = [...sourceDirectories.flatMap(collectProductionFiles), ...clientNightFiles()];
    for (const filePath of files) {
      const sourceFile = readTypeScriptSource(filePath);
      const visit = (node: ts.Node): void => {
        if (hasChineseText(node) && !isInsideDefineCopy(node)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          violations.push(`${filePath}:${line}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }
    expect(violations).toEqual([]);
  });

  it('keeps Werewolf role identifiers out of the night rendering code', () => {
    const roleIds = new Set(Object.keys(ROLE_SPECS));
    const violations: string[] = [];
    for (const filePath of clientNightFiles()) {
      const sourceFile = readTypeScriptSource(filePath);
      const visit = (node: ts.Node): void => {
        if (ts.isStringLiteralLike(node) && roleIds.has(node.text)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          violations.push(`${filePath}:${line}: ${node.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }
    expect(violations).toEqual([]);
  });
});

function clientNightFiles(): string[] {
  const stepDirectory = path.resolve(__dirname, '../../../../../web/src/features/room/steps');
  const werewolfNightDirectory = path.resolve(
    __dirname,
    '../../../../../web/src/games/werewolf/room/night',
  );
  return [
    ...collectProductionFiles(stepDirectory),
    ...(fs.existsSync(werewolfNightDirectory)
      ? collectProductionFiles(werewolfNightDirectory)
      : []),
    path.resolve(
      __dirname,
      '../../../../../web/src/games/werewolf/room/hooks/useWerewolfNightInteraction.ts',
    ),
  ];
}

function readTypeScriptSource(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function collectProductionFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectProductionFiles(filePath);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [filePath] : [];
  });
}

function hasChineseText(node: ts.Node): boolean {
  if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) return /\p{Script=Han}/u.test(node.text);
  if (ts.isTemplateExpression(node)) {
    return (
      /\p{Script=Han}/u.test(node.head.text) ||
      node.templateSpans.some((span) => /\p{Script=Han}/u.test(span.literal.text))
    );
  }
  return false;
}

function isInsideDefineCopy(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  while (current !== undefined) {
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === 'defineCopy'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}
