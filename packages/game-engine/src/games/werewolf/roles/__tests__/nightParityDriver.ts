import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { createSeededRng } from '../../../../platform/random';
import {
  decideStepSubmission,
  evaluateStepProgress,
  evolveStepSlice,
  presentStep,
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
  type StepDefinition,
  type StepRecord,
  type StepRuntime,
  type StepSlice,
  type StepSubmission,
} from '../../../../platform/steps';
import type { NightAction, NightActions, NightDeal } from '../../__tests__/boards/nightScript';
import { NIGHT_STEP_ORDER } from '../../domain/models/roles/spec/nightStepIds';
import {
  createWerewolfRoleContext,
  type DeathEffect,
  type DeathResolution,
  grantBorrowedAbility,
  replaceCurrentRole,
  resolveDeathEffects,
  resolveNightPresenceFacts,
  WEREWOLF_PRESENCE_DECLARATIONS,
  WEREWOLF_ROLE_DEFINITIONS,
  WEREWOLF_SHARED_STEPS,
  type WerewolfBottomCard,
  type WerewolfNightFacts,
  type WerewolfRoleDefinition,
  type WerewolfRoleState,
  type WerewolfRoleStepContext,
  type WerewolfRoleStepResult,
} from '..';
import { resolveSeedWolfInfection } from '../seedWolf';

type RoleStep = StepDefinition<
  string,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
>;
type RoleStepRuntime = StepRuntime<
  string,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
>;

interface PlannedStep {
  readonly roleId: RoleId;
  readonly stepId: string;
}

export interface NightTargetOptions {
  readonly minimum: number;
  readonly selectableSeats: readonly number[];
  readonly unavailableReason: string | null;
  readonly canSkip: boolean;
}

const EMPTY_FACTS: WerewolfNightFacts = {
  selections: [],
  identityChanges: [],
  cardSelections: [],
  disabledAbilities: [],
  deathEffects: [],
};

const ROLE_BY_ID = new Map<string, WerewolfRoleDefinition>(
  WEREWOLF_ROLE_DEFINITIONS.map((role) => [role.id, role]),
);

function getRole(roleId: string): WerewolfRoleDefinition {
  const role = ROLE_BY_ID.get(roleId);
  if (role === undefined) throw new Error(`[FAIL-FAST] Missing new role ${roleId}`);
  return role;
}

function createDefinitions(): Readonly<Record<string, RoleStep>> {
  const definitions: Record<string, RoleStep> = {};
  for (const role of WEREWOLF_ROLE_DEFINITIONS) {
    for (const step of role.steps) {
      if (definitions[step.id] !== undefined) {
        throw new Error(`[FAIL-FAST] Duplicate new step ${step.id}`);
      }
      definitions[step.id] = step;
    }
  }
  for (const step of WEREWOLF_SHARED_STEPS) definitions[step.id] = step;
  return definitions;
}

function createInitialState(deal: NightDeal): WerewolfRoleState {
  const identities = Object.fromEntries(
    deal.seats.map(({ seat, role }) => [
      seat,
      { dealtRole: role, currentRole: role, borrowedAbilityRole: null },
    ]),
  );
  return {
    identities,
    location: { swap: null },
    sight: { roleOverridesBySeat: {} },
    seatedSeats: deal.seats.map((player) => player.seat).sort((a, b) => a - b),
    nightNumber: 1,
    rules: { witchCanSelfHeal: deal.witchCanSelfHeal },
    usedAbilities: [],
    disabledAbilities: [],
    previousTargets: [],
    previousCards: [],
    woundedSeats: [],
    usedResources: [],
  };
}

function createPlan(deal: NightDeal): readonly PlannedStep[] {
  const stepsById = new Map<string, PlannedStep>();
  for (const roleId of new Set(deal.templateRoles)) {
    for (const step of getRole(roleId).steps) {
      if (stepsById.has(step.id)) throw new Error(`[FAIL-FAST] Duplicate new step ${step.id}`);
      stepsById.set(step.id, { roleId, stepId: step.id });
    }
  }
  if (
    deal.templateRoles.some(
      (roleId) => getRole(roleId).traits.recognition?.participatesInWolfVote === true,
    )
  ) {
    stepsById.set('wolfKill', { roleId: 'wolf', stepId: 'wolfKill' });
  }
  const ordered = NIGHT_STEP_ORDER.flatMap((stepId) => {
    const step = stepsById.get(stepId);
    return step === undefined ? [] : [step];
  });
  if (ordered.length !== stepsById.size) {
    throw new Error('[FAIL-FAST] A new role step is missing from the canonical night order');
  }
  const labeled = ordered
    .map((step, index) => ({ step, index, label: deal.seerLabelMap[step.roleId] }))
    .filter((entry) => entry.label !== undefined);
  const indices = labeled.map((entry) => entry.index);
  labeled.sort((first, second) => (first.label ?? 0) - (second.label ?? 0));
  for (const [index, target] of indices.entries()) {
    const entry = labeled[index];
    if (entry === undefined) throw new Error('[FAIL-FAST] Missing ordered seer step');
    ordered[target] = entry.step;
  }
  return ordered;
}

function mergeFacts(
  previous: WerewolfNightFacts,
  emitted: Partial<WerewolfNightFacts>,
): WerewolfNightFacts {
  return {
    selections: [...previous.selections, ...(emitted.selections ?? [])],
    identityChanges: [...previous.identityChanges, ...(emitted.identityChanges ?? [])],
    cardSelections: [...previous.cardSelections, ...(emitted.cardSelections ?? [])],
    disabledAbilities: [...previous.disabledAbilities, ...(emitted.disabledAbilities ?? [])],
    deathEffects: [...previous.deathEffects, ...(emitted.deathEffects ?? [])],
    wolfVotes: [...(previous.wolfVotes ?? []), ...(emitted.wolfVotes ?? [])],
    locationSwaps: [...(previous.locationSwaps ?? []), ...(emitted.locationSwaps ?? [])],
    resourceUses: [...(previous.resourceUses ?? []), ...(emitted.resourceUses ?? [])],
    factionChanges: [...(previous.factionChanges ?? []), ...(emitted.factionChanges ?? [])],
    wolfInfections: [...(previous.wolfInfections ?? []), ...(emitted.wolfInfections ?? [])],
    wolfGirlConfessions: [
      ...(previous.wolfGirlConfessions ?? []),
      ...(emitted.wolfGirlConfessions ?? []),
    ],
    sightOverrides: [...(previous.sightOverrides ?? []), ...(emitted.sightOverrides ?? [])],
  };
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
    const effects: DeathEffect[] = [...this.facts.deathEffects];
    const roleContext = this.createContext(this.state, this.facts, null, { bySeat: {} });
    for (const seat of this.state.seatedSeats) {
      const role = getRole(roleContext.role.roleOf(seat));
      if (role.traits.immunities !== undefined) {
        effects.push({ kind: 'immune', seat, against: role.traits.immunities });
      }
      effects.push(...(role.passiveDeathEffects?.(roleContext, seat) ?? []));
    }
    return effects;
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
    const role = createWerewolfRoleContext(state.identities, state.location, state.sight);
    return {
      state,
      facts,
      seat,
      record,
      role,
      teamOfRole: (roleId) => getRole(roleId).traits.team,
      factionOfRole: (roleId) => getRole(roleId).traits.faction,
      checkReactionOfRole: (roleId) => getRole(roleId).traits.checkReaction,
      doesRoleVoteWithWolves: (roleId) =>
        getRole(roleId).traits.recognition?.participatesInWolfVote === true,
      isWolfKillTargetForbidden: (targetSeat) =>
        getRole(role.roleOf(targetSeat)).traits.wolfKillTargetForbidden === true,
      isAdjacentToWolfFaction: (targetSeat) =>
        state.seatedSeats.some((wolfSeat) => {
          if (getRole(role.roleOf(wolfSeat)).traits.faction !== 'wolf') return false;
          const distance = Math.abs(targetSeat - wolfSeat);
          return distance === 1 || distance === state.seatedSeats.length - 1;
        }),
      roleNameOf: (roleId) => getRole(roleId).card.name,
      randomBoolean: () => {
        if (seat === null || this.slice.current?.stepId !== 'drunkSeerCheck') {
          throw new Error('[FAIL-FAST] Random check requested outside the drunk seer step');
        }
        return createSeededRng(`${this.randomSeed}:resolver:drunkSeerCheck:${seat}`)() >= 0.5;
      },
      nightPresence: this.presence,
      resolvedWolfKillTarget: this.wolfKillTarget,
      canShootAtNight: (targetSeat) => {
        const causes = resolveDeathEffects(this.collectDeathEffects()).causes[targetSeat];
        return causes === undefined || causes.every((cause) => cause === 'wolfKill');
      },
      avengerFactionOf: (targetSeat) => this.avengerFactionOf(targetSeat),
      bottomCardsOf: (_targetSeat, roleId) => this.getBottomCards(roleId),
    };
  }

  private getBottomCards(actorRoleId: string): readonly WerewolfBottomCard[] {
    return this.bottomCards.map((roleId, index) => {
      const role = getRole(roleId);
      return {
        index,
        label: role.card.name,
        roleId,
        faction: role.traits.faction,
        unavailableReason:
          actorRoleId === 'treasureMaster' && role.traits.faction === 'wolf'
            ? '狼人底牌不能选择'
            : null,
      };
    });
  }

  private avengerFactionOf(avengerSeat: number): 'good' | 'wolf' | 'bonded' {
    const shadow = this.facts.selections.find((selection) => selection.roleId === 'shadow');
    if (shadow === undefined) return 'good';
    if (shadow.landingSeat === avengerSeat) return 'bonded';
    const target = this.state.identities[shadow.landingSeat];
    if (target === undefined) throw new Error('[FAIL-FAST] Shadow target has no identity');
    return getRole(target.currentRole).traits.team === 'wolf' ? 'good' : 'wolf';
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
    let identities = this.state.identities;
    for (const change of emitted.identityChanges ?? []) {
      identities =
        change.kind === 'replaceCurrentRole'
          ? replaceCurrentRole(identities, change.seat, change.roleId)
          : grantBorrowedAbility(identities, change.seat, change.roleId);
    }
    const swaps = emitted.locationSwaps ?? [];
    if (swaps.length > 1) throw new Error('[FAIL-FAST] One step emitted multiple seat swaps');
    const roleOverridesBySeat = { ...this.state.sight.roleOverridesBySeat };
    for (const override of emitted.sightOverrides ?? []) {
      roleOverridesBySeat[override.seat] = override.roleId;
    }
    this.state = {
      ...this.state,
      identities,
      location: swaps[0] === undefined ? this.state.location : { swap: swaps[0] },
      sight: { roleOverridesBySeat },
      usedResources: [...this.state.usedResources, ...(emitted.resourceUses ?? [])],
    };
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
