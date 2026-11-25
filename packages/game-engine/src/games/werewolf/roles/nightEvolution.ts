import { evolveStepSlice, type StepEvent } from '../../../platform/steps';
import type { RoleId } from '../domain/models';
import type { GameState } from '../domain/protocol/types';
import type { DeathEffect } from './deathEffects';
import { getActiveRoleIds, getSeatIdentity, replaceCurrentRole } from './identity';
import {
  applyWerewolfRoleFacts,
  createWerewolfNightPlan,
  createWerewolfRoleState,
  EMPTY_WEREWOLF_NIGHT_FACTS,
  getWerewolfBoardConversion,
  mergeWerewolfNightFacts,
  WEREWOLF_STEP_DEFINITIONS,
  type WerewolfNightDeal,
} from './nightPlan';
import { collectWerewolfDeathEffects, createWerewolfStepRuntime } from './nightRuntime';
import type { WerewolfNightState } from './nightState';
import type {
  WerewolfConversionDeclaration,
  WerewolfConversionOutcome,
  WerewolfNightFacts,
  WerewolfRoleStepResult,
} from './role';

type WerewolfStepEvent = StepEvent<string, WerewolfNightFacts, WerewolfRoleStepResult>;

/** Events owned by the Werewolf night; shared step events remain intact. */
export type WerewolfNightEvent =
  | { readonly type: 'initialized'; readonly night: WerewolfNightState }
  | { readonly type: 'step'; readonly event: WerewolfStepEvent }
  | {
      readonly type: 'wolfKillSettled';
      readonly settlement: NonNullable<WerewolfNightState['wolfKill']>;
    }
  | { readonly type: 'conversionSettled'; readonly outcome: WerewolfConversionOutcome };

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
    conversion: null,
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
      return {
        ...night,
        wolfKill: event.settlement,
        facts: mergeWerewolfNightFacts(night.facts, {
          deathEffects: attack === null ? [] : [attack],
        }),
      };
    }
    case 'conversionSettled':
      return finalizeConversion(state, night, event.outcome);
  }
}

function evolveStep(
  state: GameState,
  night: WerewolfNightState,
  event: WerewolfStepEvent,
): WerewolfNightState {
  const slice = evolveStepSlice(night.slice, event);
  if (event.type === 'submitted') {
    const replaced = event.replacesActionKeys ?? [event.submission.actionKey];
    const emissions = event.revisable
      ? night.emissions.filter(
          (entry) =>
            entry.stepId !== event.stepId ||
            entry.actorSeat !== event.seat ||
            !replaced.includes(entry.actionKey),
        )
      : night.emissions;
    return {
      ...night,
      slice,
      roles: applyWerewolfRoleFacts(night.roles, event.facts),
      facts: mergeWerewolfNightFacts(night.facts, event.facts),
      emissions: [
        ...emissions,
        {
          stepId: event.stepId,
          actorSeat: event.seat,
          actionKey: event.submission.actionKey,
          facts: event.facts,
        },
      ],
    };
  }
  if (event.type === 'withdrawn') {
    return {
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
    };
  }
  return { ...night, slice };
}

/** The converting role's rule on this board; a conversion cannot be settled without one. */
function requireBoardConversion(state: GameState): {
  readonly roleId: string;
  readonly declaration: WerewolfConversionDeclaration;
} {
  const conversion = getWerewolfBoardConversion(state.templateRoles);
  if (conversion === null) throw new Error('[FAIL-FAST] No role on this board can convert');
  return conversion;
}

/**
 * Settle the conversion. A converted player takes the new role at once and what they did
 * earlier tonight is dropped, except for steps that declare their effect stays in force.
 */
function finalizeConversion(
  state: GameState,
  night: WerewolfNightState,
  outcome: WerewolfConversionOutcome,
): WerewolfNightState {
  if (night.conversion !== null) throw new Error('[FAIL-FAST] Conversion already settled');
  if (outcome.outcome !== 'converted') return { ...night, conversion: outcome };
  const { roleId: byRoleId, declaration } = requireBoardConversion(state);
  const target = outcome.targetSeat;
  let roles = createWerewolfRoleState(createNightDeal(state));
  let facts = EMPTY_WEREWOLF_NIGHT_FACTS;
  const emissions = night.emissions.filter(
    (entry) =>
      entry.actorSeat !== target ||
      WEREWOLF_STEP_DEFINITIONS[entry.stepId]?.survivesConversion === true,
  );
  for (const emission of emissions) {
    roles = applyWerewolfRoleFacts(roles, emission.facts);
    facts = mergeWerewolfNightFacts(facts, emission.facts);
  }
  const formerRoleIds = getActiveRoleIds(getSeatIdentity(roles.identities, target));
  // The wolf attack was settled outside the emissions, so it is put back before the conversion's own effects.
  const effects: DeathEffect[] = [
    ...(night.wolfKill?.attack == null ? [] : [night.wolfKill.attack]),
    ...declaration.effects(target),
  ];
  return {
    ...night,
    roles: {
      ...roles,
      identities: replaceCurrentRole(roles.identities, target, declaration.becomesRoleId),
    },
    facts: mergeWerewolfNightFacts(facts, {
      deathEffects: effects,
      conversions: [{ seat: target, formerRoleIds, byRoleId }],
    }),
    emissions,
    conversion: outcome,
  };
}

/** The step after which tonight's conversion is decided; null when there is none to decide. */
function getConversionSettlementStepId(state: GameState): string | null {
  const night = state.nightState;
  if (night === null) throw new Error('[FAIL-FAST] Conversion requires an initialized night');
  if (night.conversion !== null) return null;
  const conversion = getWerewolfBoardConversion(state.templateRoles);
  if (conversion === null) return null;
  const runtime = createWerewolfStepRuntime(null);
  const context = runtime.createContext(state, night.facts, null, { bySeat: {} });
  return conversion.declaration.settleAfterStepId(
    night.slice.order,
    WEREWOLF_STEP_DEFINITIONS,
    context,
  );
}

/** Whether the conversion must be decided now that `completedStepId` has finished. */
export function isConversionSettlementStep(state: GameState, completedStepId: string): boolean {
  return getConversionSettlementStepId(state) === completedStepId;
}

/** Whether this night has a conversion whose outcome nothing has settled yet. */
export function isConversionPending(state: GameState): boolean {
  return getConversionSettlementStepId(state) !== null;
}

/** Decide the conversion outcome from the attacks and protections that still stand. */
export function decideWerewolfConversion(state: GameState): WerewolfConversionOutcome {
  const night = state.nightState;
  if (night === null) throw new Error('[FAIL-FAST] Conversion requires an initialized night');
  const runtime = createWerewolfStepRuntime(null);
  const context = runtime.createContext(state, night.facts, null, { bySeat: {} });
  return requireBoardConversion(state).declaration.decide(
    night.facts,
    collectWerewolfDeathEffects(context),
  );
}
