import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import {
  decideStepSubmission,
  evaluateStepProgress,
  evolveStepSlice,
  presentStep,
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepRecord,
  type StepRuntime,
  type StepSlice,
  type StepSubmission,
} from '../../../../platform/steps';
import type { NightAction, NightActions, NightDeal } from '../../__tests__/boards/nightScript';
import {
  type DeathEffect,
  type DeathResolution,
  replaceCurrentRole,
  resolveDeathEffects,
  resolveNightPresenceFacts,
  WEREWOLF_PRESENCE_DECLARATIONS,
  type WerewolfNightFacts,
  type WerewolfRoleState,
  type WerewolfRoleStepContext,
  type WerewolfRoleStepResult,
} from '..';
import {
  applyWerewolfRoleFacts,
  createWerewolfNightPlan as createPlan,
  createWerewolfRoleState as createInitialState,
  createWerewolfStepDefinitions as createDefinitions,
  EMPTY_WEREWOLF_NIGHT_FACTS as EMPTY_FACTS,
  mergeWerewolfNightFacts as mergeFacts,
  type PlannedWerewolfStep as PlannedStep,
  type WerewolfRoleStep as RoleStep,
} from '../nightPlan';
import { collectWerewolfDeathEffects, createWerewolfStepContext } from '../nightRuntime';
import { resolveSeedWolfInfection } from '../seedWolf';

type RoleStepRuntime = StepRuntime<
  string,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
>;

export interface NightTargetOptions {
  readonly minimum: number;
  readonly selectableSeats: readonly number[];
  readonly unavailableReason: string | null;
  readonly canSkip: boolean;
}

export class NewNightDriver {
  private readonly definitions = createDefinitions();
  private readonly plan: readonly PlannedStep[];
  private readonly presence;
  private readonly bottomCards: readonly RoleId[];
  private readonly runtime: RoleStepRuntime;
  private readonly initialState: WerewolfRoleState;
  private readonly emissions: {
    readonly actorSeat: number;
    readonly facts: Partial<WerewolfNightFacts>;
  }[] = [];
  private readonly targetOptions = new Map<string, ReadonlyMap<number, NightTargetOptions>>();
  private readonly views = new Map<string, ReadonlyMap<number, string>>();
  private readonly resultViews = new Map<
    string,
    { readonly title: string; readonly text: string }
  >();
  private readonly wolfRobotHunterViews = new Map<number, string>();
  private state: WerewolfRoleState;
  private facts = EMPTY_FACTS;
  private slice: StepSlice<string, WerewolfRoleStepResult>;
  private wolfKillTarget: number | null = null;
  private wolfKillEffect: DeathEffect | undefined;
  private infectionOutcome:
    | { readonly outcome: 'notUsed' }
    | { readonly outcome: 'converted' | 'failed'; readonly targetSeat: number }
    | undefined;
  private provisionalInfectionSight:
    { readonly seat: number; readonly previousRole: string | undefined } | undefined;

  constructor(
    deal: NightDeal,
    private readonly choices: NightActions,
    private readonly randomSeed: string,
  ) {
    this.state = createInitialState(deal);
    this.initialState = this.state;
    this.plan = createPlan(deal);
    this.bottomCards = deal.bottomCards;
    this.presence = resolveNightPresenceFacts(deal.templateRoles, WEREWOLF_PRESENCE_DECLARATIONS);
    this.slice = { order: this.getStepOrder(), current: null, records: {}, deadlineMs: null };
    this.runtime = {
      definitions: this.definitions,
      getSlice: () => this.slice,
      getFacts: () => this.facts,
      createContext: (state, facts, seat, record) => this.createContext(state, facts, seat, record),
      isAudioPlaying: () => false,
      seatedSeats: (state) => state.seatedSeats,
    };
  }

  run(): void {
    for (const [index, { roleId, stepId }] of this.plan.entries()) {
      if (stepId === 'seedWolfInfectReveal') this.finalizeInfection();
      else this.refreshInfectionSight();
      const definition = this.definitions[stepId];
      if (definition === undefined) throw new Error(`[FAIL-FAST] Missing new step ${stepId}`);
      this.slice = {
        ...this.slice,
        current: { stepId, serial: index + 1 },
        deadlineMs: null,
      };
      this.captureTargetOptions(stepId);
      this.runStep(definition, this.choices[roleId]);
      if (stepId === 'wolfKill') this.settleWolfVote();
      this.assertStepCanAdvance(definition, this.plan[index + 1]?.stepId ?? null);
    }
  }

  getStepOrder(): readonly string[] {
    return this.plan.map((step) => step.stepId);
  }

  getTargetOptions(stepId: string, actorSeat: number): NightTargetOptions {
    const options = this.targetOptions.get(stepId)?.get(actorSeat);
    if (options === undefined) {
      throw new Error(`[FAIL-FAST] Missing target options for ${stepId} at seat ${actorSeat}`);
    }
    return options;
  }

  getView(stepId: string, actorSeat: number): string | undefined {
    return this.views.get(stepId)?.get(actorSeat);
  }

  getResultView(
    stepId: string,
    actorSeat: number,
  ): { readonly title: string; readonly text: string } | undefined {
    return this.resultViews.get(`${stepId}:${actorSeat}`);
  }

  getWolfRobotHunterView(actorSeat: number): string | undefined {
    return this.wolfRobotHunterViews.get(actorSeat);
  }

  resolveDeaths(): DeathResolution {
    return resolveDeathEffects(this.collectDeathEffects());
  }

  private collectDeathEffects(): readonly DeathEffect[] {
    const roleContext = this.createContext(this.state, this.facts, null, { bySeat: {} });
    return collectWerewolfDeathEffects(roleContext);
  }

  getPrivateResults(): Readonly<Record<string, WerewolfRoleStepResult>> {
    const results: Record<string, WerewolfRoleStepResult> = {};
    for (const [stepId, record] of Object.entries(this.slice.records)) {
      if (record === undefined) continue;
      for (const seatRecord of Object.values(record.bySeat)) {
        if (seatRecord?.result !== null && seatRecord?.result !== undefined) {
          results[stepId] = seatRecord.result;
        }
      }
    }
    return results;
  }

  getFacts(): WerewolfNightFacts {
    return this.facts;
  }

  getInfectionOutcome():
    | { readonly outcome: 'notUsed' }
    | { readonly outcome: 'converted' | 'failed'; readonly targetSeat: number }
    | undefined {
    return this.infectionOutcome;
  }

  private createContext(
    state: WerewolfRoleState,
    facts: WerewolfNightFacts,
    seat: number | null,
    record: StepRecord<WerewolfRoleStepResult>,
  ): WerewolfRoleStepContext {
    return createWerewolfStepContext({
      state,
      facts,
      seat,
      record,
      stepId: this.slice.current?.stepId ?? null,
      randomSeed: this.randomSeed,
      bottomCards: this.bottomCards,
      nightPresence: this.presence,
      resolvedWolfKillTarget: this.wolfKillTarget,
    });
  }

  private runStep(definition: RoleStep, choice: NightAction | undefined): void {
    const context = this.createContext(this.state, this.facts, null, { bySeat: {} });
    const actors = definition.actors(context);
    for (const actorSeat of actors) {
      const presentation = presentStep(this.runtime, this.state, actorSeat);
      if (presentation === null) throw new Error('[FAIL-FAST] New step has no presentation');
      const action = presentation.actions.find(
        (candidate) =>
          candidate.key !== STEP_SKIP_ACTION_KEY && candidate.availability.kind === 'available',
      );
      if (action === undefined) {
        this.submit(actorSeat, STEP_SKIP_ACTION_KEY);
      } else if (definition.id === 'wolfKill') {
        if (typeof choice === 'number' && action.kind === 'pickSeats') {
          this.submit(actorSeat, action.key, [choice]);
        } else {
          this.submit(actorSeat, 'wolfKillAbstain');
        }
      } else if (definition.id === 'witchAction') {
        this.submitWitch(actorSeat, choice);
      } else if (action?.kind === 'view') {
        this.submit(actorSeat, action.key);
      } else if (action?.kind === 'pickCard') {
        if (choice === null || typeof choice !== 'object' || !('cardIndex' in choice)) {
          throw new Error(`[FAIL-FAST] ${definition.id} requires a card choice`);
        }
        this.submit(actorSeat, action.key, undefined, choice.cardIndex);
      } else if (action?.kind === 'pickSeats') {
        const seats = getChosenSeats(choice);
        this.submit(
          actorSeat,
          seats.length === 0 ? STEP_SKIP_ACTION_KEY : action.key,
          seats.length === 0 ? undefined : seats,
        );
      } else if (action?.kind === 'direct') {
        const shouldConfirm =
          choice === null ||
          typeof choice !== 'object' ||
          !('confirmed' in choice) ||
          choice.confirmed;
        this.submit(actorSeat, shouldConfirm ? action.key : STEP_SKIP_ACTION_KEY);
      } else {
        this.submit(actorSeat, STEP_SKIP_ACTION_KEY);
      }
      this.acknowledgeResult(actorSeat, definition.id);
      const followup = presentStep(this.runtime, this.state, actorSeat)?.actions.find(
        (candidate) => candidate.kind === 'view' && candidate.availability.kind === 'available',
      );
      if (followup !== undefined) this.submit(actorSeat, followup.key);
    }
  }

  private assertStepCanAdvance(definition: RoleStep, expectedNextStep: string | null): void {
    const record = this.slice.records[definition.id] ?? { bySeat: {} };
    const context = this.createContext(this.state, this.facts, null, record);
    // Vacant bottom-card delays belong to the game integration in phase 9.
    if (definition.actors(context).length === 0 && definition.completion === undefined) return;

    let events = evaluateStepProgress(this.runtime, this.state, 0);
    const initialEvent = events[0];
    if (initialEvent?.type === 'deadlineArmed') {
      this.slice = evolveStepSlice(this.slice, initialEvent);
      events = evaluateStepProgress(this.runtime, this.state, initialEvent.deadlineMs);
    }
    const advance = events[0];
    if (advance?.type !== 'advanced' || (advance.next?.stepId ?? null) !== expectedNextStep) {
      throw new Error(
        `[FAIL-FAST] New step ${definition.id} did not advance to ${expectedNextStep}`,
      );
    }
    this.slice = evolveStepSlice(this.slice, advance);
  }

  private submitWitch(actorSeat: number, choice: NightAction | undefined): void {
    if (typeof choice === 'number') {
      this.submit(actorSeat, 'antidote');
      return;
    }
    if (choice !== null && typeof choice === 'object' && 'save' in choice) {
      if (choice.save !== null) {
        this.submit(actorSeat, 'antidote');
      } else if (choice.poison !== null) {
        this.submit(actorSeat, 'poison', [choice.poison]);
      } else {
        this.submit(actorSeat, STEP_SKIP_ACTION_KEY);
      }
      return;
    }
    this.submit(actorSeat, STEP_SKIP_ACTION_KEY);
  }

  private submit(
    actorSeat: number,
    actionKey: string,
    seats?: readonly number[],
    cardIndex?: number,
  ): void {
    const current = this.slice.current;
    if (current === null) throw new Error('[FAIL-FAST] New driver has no current step');
    const submission: StepSubmission = {
      stepId: current.stepId,
      serial: current.serial,
      actionKey,
      ...(seats === undefined ? {} : { seats }),
      ...(cardIndex === undefined ? {} : { cardIndex }),
    };
    const decision = decideStepSubmission(this.runtime, this.state, actorSeat, submission);
    if (decision.kind === 'reject') {
      throw new Error(`[FAIL-FAST] New ${current.stepId} rejected ${actionKey} at ${actorSeat}`);
    }
    for (const event of decision.events) {
      this.slice = evolveStepSlice(this.slice, event);
      if (event.type === 'submitted') {
        this.emissions.push({ actorSeat, facts: event.facts });
        this.applyFacts(event.facts);
      }
    }
  }

  private acknowledgeResult(actorSeat: number, stepId: string): void {
    const record = this.slice.records[stepId]?.bySeat[actorSeat];
    if (record?.result !== null && record?.result !== undefined && !record.isResultAcknowledged) {
      const resultView = presentStep(this.runtime, this.state, actorSeat)?.pendingResult;
      if (resultView == null)
        throw new Error(`[FAIL-FAST] New ${stepId} has no result presentation`);
      this.resultViews.set(`${stepId}:${actorSeat}`, resultView);
      this.submit(actorSeat, STEP_RESULT_ACK_ACTION_KEY);
    }
    const presentation = presentStep(this.runtime, this.state, actorSeat);
    const status = presentation?.actions.find(
      (action) =>
        action.key === 'wolfRobotHunterStatus' && action.availability.kind === 'available',
    );
    if (status?.kind === 'view') {
      this.wolfRobotHunterViews.set(actorSeat, status.content.text);
      this.submit(actorSeat, status.key);
    }
  }

  private applyFacts(emitted: Partial<WerewolfNightFacts>): void {
    this.facts = mergeFacts(this.facts, emitted);
    this.state = applyWerewolfRoleFacts(this.state, emitted);
  }

  private settleWolfVote(): void {
    const votes = this.facts.wolfVotes ?? [];
    const chosen = votes.filter((vote) => vote.chosenSeat !== null);
    if (chosen.length === 0) return;
    const first = chosen[0];
    if (first === undefined || first.chosenSeat === null || first.landingSeat === null) return;
    if (chosen.some((vote) => vote.chosenSeat !== first.chosenSeat)) {
      throw new Error('[FAIL-FAST] Parity fixture requires aligned wolf votes');
    }
    this.wolfKillTarget = first.chosenSeat;
    this.wolfKillEffect = {
      kind: 'attack',
      cause: 'wolfKill',
      source: null,
      target: first.landingSeat,
    };
    this.facts = mergeFacts(this.facts, { deathEffects: [this.wolfKillEffect] });
  }

  private refreshInfectionSight(): void {
    const outcome = resolveSeedWolfInfection(this.facts, this.collectDeathEffects());
    const overrides = { ...this.state.sight.roleOverridesBySeat };
    if (this.provisionalInfectionSight !== undefined) {
      const { seat, previousRole } = this.provisionalInfectionSight;
      if (previousRole === undefined) delete overrides[seat];
      else overrides[seat] = previousRole;
      this.provisionalInfectionSight = undefined;
    }
    if (outcome?.outcome === 'converted') {
      this.provisionalInfectionSight = {
        seat: outcome.targetSeat,
        previousRole: overrides[outcome.targetSeat],
      };
      overrides[outcome.targetSeat] = 'wolf';
    }
    this.state = { ...this.state, sight: { roleOverridesBySeat: overrides } };
  }

  private finalizeInfection(): void {
    this.refreshInfectionSight();
    const outcome = resolveSeedWolfInfection(this.facts, this.collectDeathEffects());
    this.infectionOutcome = outcome ?? { outcome: 'notUsed' };
    if (outcome?.outcome !== 'converted') return;
    const target = outcome.targetSeat;
    this.state = this.initialState;
    this.facts = EMPTY_FACTS;
    this.provisionalInfectionSight = undefined;
    for (const emission of this.emissions) {
      if (emission.actorSeat !== target) this.applyFacts(emission.facts);
    }
    this.facts = mergeFacts(this.facts, {
      deathEffects: [
        ...(this.wolfKillEffect === undefined ? [] : [this.wolfKillEffect]),
        { kind: 'void', scope: { cause: 'wolfKill', target } },
      ],
    });
    const records = { ...this.slice.records };
    for (const [stepId, record] of Object.entries(records)) {
      if (record?.bySeat[target] === undefined) continue;
      const bySeat = { ...record.bySeat };
      delete bySeat[target];
      records[stepId] = { bySeat };
    }
    this.slice = { ...this.slice, records };
    this.state = {
      ...this.state,
      identities: replaceCurrentRole(this.state.identities, target, 'wolf'),
    };
  }

  private captureTargetOptions(stepId: string): void {
    const options = new Map<number, NightTargetOptions>();
    const views = new Map<number, string>();
    for (const actorSeat of this.state.seatedSeats) {
      const presentation = presentStep(this.runtime, this.state, actorSeat);
      const action = presentation?.actions.find((candidate) => candidate.kind === 'pickSeats');
      const isAvailable = action?.availability.kind === 'available';
      if (presentation === null) throw new Error('[FAIL-FAST] New step has no presentation');
      const skip = decideStepSubmission(this.runtime, this.state, actorSeat, {
        stepId,
        serial: presentation.serial,
        actionKey: STEP_SKIP_ACTION_KEY,
      });
      options.set(actorSeat, {
        minimum: action?.kind === 'pickSeats' && isAvailable ? action.min : 1,
        selectableSeats:
          action?.kind === 'pickSeats' && isAvailable
            ? action.seats
                .filter((target) => target.unavailableReason === null)
                .map((target) => target.seat)
            : [],
        unavailableReason:
          action?.availability.kind === 'unavailable' ? action.availability.reason : null,
        canSkip: skip.kind === 'accept',
      });
      const view = presentation?.actions.find(
        (candidate) => candidate.kind === 'view' && candidate.availability.kind === 'available',
      );
      if (view?.kind === 'view') views.set(actorSeat, view.content.text);
    }
    this.targetOptions.set(stepId, options);
    this.views.set(stepId, views);
  }
}

function getChosenSeats(choice: NightAction | undefined): readonly number[] {
  if (typeof choice === 'number') return [choice];
  if (choice !== null && typeof choice === 'object' && 'targets' in choice) return choice.targets;
  return [];
}
