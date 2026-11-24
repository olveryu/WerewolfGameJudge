import { evolveStepSlice, type StepEvent } from '../../../platform/steps';
import type { RoleId } from '../domain/models';
import type { GameState, SeedWolfInfectionResult } from '../domain/protocol/types';
import type { DeathEffect } from './deathEffects';
import { replaceCurrentRole } from './identity';
import {
  applyWerewolfRoleFacts,
  createWerewolfNightPlan,
  createWerewolfRoleState,
  EMPTY_WEREWOLF_NIGHT_FACTS,
  mergeWerewolfNightFacts,
  type WerewolfNightDeal,
} from './nightPlan';
import { collectWerewolfDeathEffects, createWerewolfStepRuntime } from './nightRuntime';
import type { WerewolfNightState } from './nightState';
import type { WerewolfNightFacts, WerewolfRoleStepResult } from './role';
import { resolveSeedWolfInfection } from './seedWolf';

type WerewolfStepEvent = StepEvent<string, WerewolfNightFacts, WerewolfRoleStepResult>;

/** Events owned by the Werewolf night; shared step events remain intact. */
export type WerewolfNightEvent =
  | { readonly type: 'initialized'; readonly night: WerewolfNightState }
  | { readonly type: 'step'; readonly event: WerewolfStepEvent }
  | {
      readonly type: 'wolfKillSettled';
      readonly settlement: NonNullable<WerewolfNightState['wolfKill']>;
    }
  | { readonly type: 'infectionSettled'; readonly outcome: SeedWolfInfectionResult };

function createNightDeal(state: GameState): WerewolfNightDeal {
  const seats: { seat: number; role: RoleId }[] = [];
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.role == null) {
      throw new Error(`[FAIL-FAST] Night cannot start without a role at seat ${seatKey}`);
    }
    seats.push({ seat: Number(seatKey), role: player.role });
  }
  return {
    seats,
    templateRoles: state.templateRoles,
    seerLabelMap: state.seerLabelMap ?? {},
    witchCanSelfHeal: state.rules?.witchCanSelfHeal ?? false,
  };
}

/** Build the first-night state from the assigned physical cards. */
export function createWerewolfNightState(state: GameState): WerewolfNightState {
  const deal = createNightDeal(state);
  const order = createWerewolfNightPlan(deal).map((step) => step.stepId);
  const firstStep = order[0];
  return {
    slice: {
      order,
      current: firstStep === undefined ? null : { stepId: firstStep, serial: 1 },
      records: {},
      deadlineMs: null,
    },
    roles: createWerewolfRoleState(deal),
    facts: EMPTY_WEREWOLF_NIGHT_FACTS,
    emissions: [],
    wolfKill: null,
    infection: null,
    provisionalInfectionSight: null,
  };
}

/** Apply one night event without time, randomness, or I/O. */
export function evolveWerewolfNight(
  state: GameState,
  event: WerewolfNightEvent,
): WerewolfNightState {
  if (event.type === 'initialized') return event.night;
  const night = state.nightState;
  if (night === null) throw new Error('[FAIL-FAST] Night event without an initialized night');
  switch (event.type) {
    case 'step':
      return evolveStep(state, night, event.event);
    case 'wolfKillSettled': {
      if (night.wolfKill !== null) throw new Error('[FAIL-FAST] Wolf kill already settled');
      const attack = event.settlement.attack;
      return refreshInfectionSight(state, {
        ...night,
        wolfKill: event.settlement,
        facts: mergeWerewolfNightFacts(night.facts, {
          deathEffects: attack === null ? [] : [attack],
        }),
      });
    }
    case 'infectionSettled':
      return finalizeInfection(state, night, event.outcome);
  }
}

function evolveStep(
  state: GameState,
  night: WerewolfNightState,
  event: WerewolfStepEvent,
): WerewolfNightState {
  const slice = evolveStepSlice(night.slice, event);
  if (event.type === 'submitted') {
    const cleanNight = clearProvisionalInfectionSight(night);
    const replaced = event.replacesActionKeys ?? [event.submission.actionKey];
    const emissions = event.revisable
      ? cleanNight.emissions.filter(
          (entry) =>
            entry.stepId !== event.stepId ||
            entry.actorSeat !== event.seat ||
            !replaced.includes(entry.actionKey),
        )
      : cleanNight.emissions;
    return refreshInfectionSight(state, {
      ...cleanNight,
      slice,
      roles: applyWerewolfRoleFacts(cleanNight.roles, event.facts),
      facts: mergeWerewolfNightFacts(cleanNight.facts, event.facts),
      emissions: [
        ...emissions,
        {
          stepId: event.stepId,
          actorSeat: event.seat,
          actionKey: event.submission.actionKey,
          facts: event.facts,
        },
      ],
    });
  }
  if (event.type === 'withdrawn') {
    return refreshInfectionSight(state, {
      ...night,
      slice,
      facts: {
        ...night.facts,
        wolfVotes: (night.facts.wolfVotes ?? []).filter((vote) => vote.actorSeat !== event.seat),
      },
      emissions: night.emissions.filter(
        (entry) =>
          entry.stepId !== event.stepId ||
          entry.actorSeat !== event.seat ||
          entry.actionKey !== event.actionKey,
      ),
    });
  }
  return { ...night, slice };
}

function refreshInfectionSight(state: GameState, night: WerewolfNightState): WerewolfNightState {
  if (night.infection !== null) return night;
  const cleanNight = clearProvisionalInfectionSight(night);
  const roleOverridesBySeat = cleanNight.roles.sight.roleOverridesBySeat;
  const runtime = createWerewolfStepRuntime(null);
  const context = runtime.createContext(
    { ...state, nightState: cleanNight },
    cleanNight.facts,
    null,
    { bySeat: {} },
  );
  const outcome = resolveSeedWolfInfection(cleanNight.facts, collectWerewolfDeathEffects(context));
  if (outcome?.outcome !== 'converted') return cleanNight;
  const previousRole = roleOverridesBySeat[outcome.targetSeat] ?? null;
  return {
    ...cleanNight,
    roles: {
      ...cleanNight.roles,
      sight: { roleOverridesBySeat: { ...roleOverridesBySeat, [outcome.targetSeat]: 'wolf' } },
    },
    provisionalInfectionSight: { seat: outcome.targetSeat, previousRole },
  };
}

function clearProvisionalInfectionSight(night: WerewolfNightState): WerewolfNightState {
  const provisional = night.provisionalInfectionSight;
  if (provisional === null) return night;
  const roleOverridesBySeat = { ...night.roles.sight.roleOverridesBySeat };
  if (provisional.previousRole === null) delete roleOverridesBySeat[provisional.seat];
  else roleOverridesBySeat[provisional.seat] = provisional.previousRole;
  return {
    ...night,
    roles: { ...night.roles, sight: { roleOverridesBySeat } },
    provisionalInfectionSight: null,
  };
}

function finalizeInfection(
  state: GameState,
  night: WerewolfNightState,
  outcome: SeedWolfInfectionResult,
): WerewolfNightState {
  if (night.infection !== null) throw new Error('[FAIL-FAST] Seed Wolf infection already settled');
  if (outcome.outcome !== 'converted') return { ...night, infection: outcome };
  const target = outcome.targetSeat;
  let roles = createWerewolfRoleState(createNightDeal(state));
  let facts = EMPTY_WEREWOLF_NIGHT_FACTS;
  const emissions = night.emissions.filter((entry) => entry.actorSeat !== target);
  for (const emission of emissions) {
    roles = applyWerewolfRoleFacts(roles, emission.facts);
    facts = mergeWerewolfNightFacts(facts, emission.facts);
  }
  const effects: DeathEffect[] = [
    ...(night.wolfKill?.attack == null ? [] : [night.wolfKill.attack]),
    { kind: 'void', scope: { cause: 'wolfKill', target } },
  ];
  facts = mergeWerewolfNightFacts(facts, { deathEffects: effects });
  const records = { ...night.slice.records };
  for (const [stepId, record] of Object.entries(records)) {
    if (record?.bySeat[target] === undefined) continue;
    const bySeat = { ...record.bySeat };
    delete bySeat[target];
    records[stepId] = { bySeat };
  }
  return {
    ...night,
    slice: { ...night.slice, records },
    roles: { ...roles, identities: replaceCurrentRole(roles.identities, target, 'wolf') },
    facts,
    emissions,
    infection: outcome,
    provisionalInfectionSight: null,
  };
}

/** Decide the infection outcome from the current effective attacks and protections. */
export function decideWerewolfInfection(state: GameState): SeedWolfInfectionResult {
  const night = state.nightState;
  if (night === null) throw new Error('[FAIL-FAST] Infection requires an initialized night');
  const runtime = createWerewolfStepRuntime(null);
  const context = runtime.createContext(state, night.facts, null, { bySeat: {} });
  return (
    resolveSeedWolfInfection(night.facts, collectWerewolfDeathEffects(context)) ?? {
      outcome: 'notUsed',
    }
  );
}
