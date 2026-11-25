import { type AudioEffect, NIGHT_END_AUDIO_KEY } from '../../../platform/audio';
import { createSeededRng, randomIntInclusive } from '../../../platform/random';
import { createAdvanceEvent, evaluateStepProgress, type StepEvent } from '../../../platform/steps';
import { werewolfSettleDueEffect } from '../effects/settleDue';
import type { WerewolfEffect } from '../effects/types';
import { WEREWOLF_PRESENCE_DECLARATIONS } from '../roles';
import type { DeathReason } from '../roles/deathEffects';
import { resolveDeathEffects } from '../roles/deathEffects';
import { resolveSelectedSeat } from '../roles/location';
import {
  decideWerewolfInfection,
  isInfectionSettlementStep,
  type WerewolfNightEvent,
} from '../roles/nightEvolution';
import { getWerewolfRoleDefinition } from '../roles/nightPlan';
import {
  collectWerewolfDeathEffects,
  createWerewolfStepRuntime,
  requireWerewolfNightState,
} from '../roles/nightRuntime';
import { resolveNightPresenceFacts } from '../roles/presence';
import type { WerewolfNightFacts, WerewolfRoleStepResult } from '../roles/role';
import { createAudioQueueAction } from './audioQueue';
import type { HandlerExecutionContext } from './handlers/types';
import type { InlineProgressionResult } from './inlineProgression';
import { isValidSchemaId } from './models/roles/spec/schemas';
import type { GameState, ResolvedWolfKillVerdict } from './protocol/types';
import { gameReducer } from './reducer/gameReducer';
import type { StateAction } from './reducer/types';
import { resolveWolfVotes } from './resolveWolfVotes';

type NightStepEvent = StepEvent<string, WerewolfNightFacts, WerewolfRoleStepResult>;

/** Advance the spec-driven night, arming the same durable deadlines as the room worker. */
export function runWerewolfNightProgression(
  state: GameState,
  execution: HandlerExecutionContext,
): InlineProgressionResult {
  const actions: StateAction[] = [];
  const effects: WerewolfEffect[] = [];
  let currentState = state;
  let stepsAdvanced = 0;
  const applyAction = (action: StateAction) => {
    currentState = gameReducer(currentState, action);
    actions.push(action);
  };
  const applyNightEvent = (event: WerewolfNightEvent) => {
    applyAction({ type: 'WEREWOLF_NIGHT_EVENT', event });
  };
  for (let iteration = 0; iteration < 200; iteration++) {
    const night = requireWerewolfNightState(currentState);
    if (currentState.isAudioPlaying) break;
    if (night.slice.current === null) {
      for (const action of finishNight(currentState)) applyAction(action);
      stepsAdvanced++;
      break;
    }
    const stepEvent = evaluateCurrentStep(currentState, execution);
    if (stepEvent === null) break;
    if (stepEvent.type === 'deadlineArmed') {
      if (!isValidSchemaId(night.slice.current.stepId)) {
        throw new Error(`[FAIL-FAST] Invalid night deadline step ${night.slice.current.stepId}`);
      }
      effects.push(
        werewolfSettleDueEffect(currentState, night.slice.current.stepId, stepEvent.deadlineMs),
      );
    }
    if (stepEvent.type !== 'advanced') {
      applyNightEvent({ type: 'step', event: stepEvent });
      continue;
    }
    const currentStepId = night.slice.current.stepId;
    if (currentStepId === 'wolfKill') {
      const settlement = settleWolfKill(currentState, execution.randomSeed);
      applyNightEvent({ type: 'wolfKillSettled', settlement });
      const resolved: StateAction = {
        type: 'SET_RESOLVED_WOLF_KILL_TARGET',
        payload: { target: settlement.target, verdict: settlement.verdict },
      };
      applyAction(resolved);
    }
    if (isInfectionSettlementStep(currentState, currentStepId)) {
      applyNightEvent({ type: 'infectionSettled', outcome: decideWerewolfInfection(currentState) });
    }
    applyNightEvent({ type: 'step', event: stepEvent });
    stepsAdvanced++;
    const audio = resolveStepAudio(currentState, currentStepId, stepEvent);
    if (stepEvent.next === null) {
      for (const action of finishNight(currentState)) applyAction(action);
    }
    if (audio.length > 0) {
      const audioAction = createAudioQueueAction(audio);
      applyAction(audioAction);
      break;
    }
    if (stepEvent.next === null) break;
    if (iteration === 199) throw new Error('[FAIL-FAST] Night progression exceeded its limit');
  }
  return { actions, effects, finalState: currentState, stepsAdvanced };
}

function evaluateCurrentStep(
  state: GameState,
  execution: HandlerExecutionContext,
): NightStepEvent | null {
  const night = requireWerewolfNightState(state);
  const current = night.slice.current;
  if (current === null) return null;
  const runtime = createWerewolfStepRuntime(execution.randomSeed);
  const definition = runtime.definitions[current.stepId];
  if (definition === undefined) throw new Error(`[FAIL-FAST] Unknown night step ${current.stepId}`);
  const record = night.slice.records[current.stepId] ?? { bySeat: {} };
  const context = runtime.createContext(state, night.facts, null, record);
  if (definition.actors(context).length === 0) {
    const deadline = night.slice.deadlineMs;
    if (deadline === null) {
      return {
        type: 'deadlineArmed',
        deadlineMs:
          execution.nowMs +
          randomIntInclusive(
            5000,
            10000,
            createSeededRng(`${execution.randomSeed}:auto-skip:${current.stepId}`),
          ),
      };
    }
    return execution.nowMs >= deadline ? createAdvanceEvent(runtime, state) : null;
  }
  return evaluateStepProgress(runtime, state, execution.nowMs)[0] ?? null;
}

function settleWolfKill(
  state: GameState,
  randomSeed: string,
): NonNullable<ReturnType<typeof requireWerewolfNightState>['wolfKill']> {
  const night = requireWerewolfNightState(state);
  const presence = resolveNightPresenceFacts(state.templateRoles, WEREWOLF_PRESENCE_DECLARATIONS);
  const disabled =
    presence.isFirstNightWolfAttackDisabled ||
    night.facts.disabledAbilities.some((ability) => ability.roleId === 'wolfKill');
  if (disabled) return { target: null, verdict: null, attack: null };
  const votes = new Map(
    (night.facts.wolfVotes ?? []).map((vote) => [vote.actorSeat, vote.chosenSeat ?? -1]),
  );
  const target = resolveWolfVotes(votes, {
    requireUnanimity: presence.doesWolfVoteRequireUnanimity,
    rng: createSeededRng(`${randomSeed}:wolf-vote`),
  });
  return {
    target,
    verdict: classifyWolfVotes(votes, target),
    attack:
      target === null
        ? null
        : {
            kind: 'attack',
            cause: 'wolfKill',
            source: null,
            target: resolveSelectedSeat(target, night.roles.location),
          },
  };
}

function classifyWolfVotes(
  votes: ReadonlyMap<number, number>,
  target: number | null,
): ResolvedWolfKillVerdict {
  const nonAbstainVotes = Array.from(votes.values()).filter((vote) => vote !== -1);
  if (nonAbstainVotes.length === 0) return { type: 'allAbstain' };
  if (target === null) return { type: 'splitTied' };
  const counts = new Map<number, number>();
  for (const vote of nonAbstainVotes) {
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }
  if (counts.size === 1) return { type: 'sharedTarget', targetSeat: target };
  let maxCount = 0;
  let tiedAtMax = false;
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
      tiedAtMax = false;
    } else if (count === maxCount) {
      tiedAtMax = true;
    }
  }
  return tiedAtMax
    ? { type: 'tiePicked', targetSeat: target }
    : { type: 'splitKilled', targetSeat: target };
}

function finishNight(state: GameState): readonly StateAction[] {
  const actions: StateAction[] = [];
  let settledState = state;
  const applyAction = (action: StateAction) => {
    settledState = gameReducer(settledState, action);
    actions.push(action);
  };
  let night = requireWerewolfNightState(settledState);
  if (night.wolfKill === null) {
    const settlement = { target: null, verdict: { type: 'allAbstain' as const }, attack: null };
    applyAction({ type: 'WEREWOLF_NIGHT_EVENT', event: { type: 'wolfKillSettled', settlement } });
    applyAction({
      type: 'SET_RESOLVED_WOLF_KILL_TARGET',
      payload: { target: settlement.target, verdict: settlement.verdict },
    });
    night = requireWerewolfNightState(settledState);
  }
  if (state.templateRoles.includes('seedWolf') && night.infection === null) {
    applyAction({
      type: 'WEREWOLF_NIGHT_EVENT',
      event: { type: 'infectionSettled', outcome: decideWerewolfInfection(settledState) },
    });
    night = requireWerewolfNightState(settledState);
  }
  const runtime = createWerewolfStepRuntime(null);
  const context = runtime.createContext(settledState, night.facts, null, { bySeat: {} });
  const resolution = resolveDeathEffects(collectWerewolfDeathEffects(context));
  const deathReasons: Record<number, DeathReason> = {};
  for (const seat of resolution.deaths) {
    const reason = resolution.causes[seat]?.at(-1);
    if (reason === undefined) throw new Error(`[FAIL-FAST] Missing death cause for seat ${seat}`);
    deathReasons[seat] = reason;
  }
  actions.push({ type: 'END_NIGHT', payload: { deaths: [...resolution.deaths], deathReasons } });
  return actions;
}

function resolveStepAudio(
  state: GameState,
  previousStepId: string,
  event: Extract<NightStepEvent, { type: 'advanced' }>,
): readonly AudioEffect[] {
  return event.audio.map((effect) => {
    const stepId = effect.isEndAudio ? previousStepId : event.next?.stepId;
    if (stepId === undefined || effect.audioKey === NIGHT_END_AUDIO_KEY) return effect;
    return { ...effect, audioKey: resolveNightStepAudioKey(state, stepId, effect.audioKey) };
  });
}

/** Resolve the numbered voice for a step belonging to a labelled seer. */
export function resolveNightStepAudioKey(
  state: GameState,
  stepId: string,
  audioKey: string,
): string {
  const roleId = state.templateRoles.find((role) =>
    getWerewolfRoleDefinition(role).steps.some((step) => step.id === stepId),
  );
  const label = roleId === undefined ? undefined : state.seerLabelMap?.[roleId];
  return label === undefined ? audioKey : `seer_${label}`;
}
