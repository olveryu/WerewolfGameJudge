import { createSeededRng } from '../../../platform/random';
import { getBotSeats } from '../../../platform/room/seating';
import {
  planBotAcknowledgements,
  type StepRecord,
  type StepRuntime,
} from '../../../platform/steps';
import type { RoleId } from '../domain/models';
import type { GameState, ResolvedWolfKillVerdict } from '../domain/protocol/types';
import { WEREWOLF_PRESENCE_DECLARATIONS } from '.';
import { createWerewolfRoleContext } from './context';
import { type DeathEffect, resolveDeathEffects } from './deathEffects';
import { getWerewolfRoleDefinition, WEREWOLF_STEP_DEFINITIONS } from './nightPlan';
import type { WerewolfNightState } from './nightState';
import { type NightPresenceFacts, resolveNightPresenceFacts } from './presence';
import type {
  WerewolfBottomCard,
  WerewolfNightFacts,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfRoleStepResult,
} from './role';
import { isKnownWolfTeammate } from './roleSteps';

type WerewolfStepRuntime = StepRuntime<
  string,
  GameState,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
>;

export function requireWerewolfNightState(state: GameState): WerewolfNightState {
  if (state.nightState === null) throw new Error('[FAIL-FAST] Missing Werewolf night state');
  return state.nightState;
}

/** Bind the shared step mechanism to the current Werewolf game state. */
export function createWerewolfStepRuntime(randomSeed: string | null): WerewolfStepRuntime {
  return {
    definitions: WEREWOLF_STEP_DEFINITIONS,
    getSlice: (state) => requireWerewolfNightState(state).slice,
    getFacts: (state) => requireWerewolfNightState(state).facts,
    createContext: (state, facts, seat, record) => {
      const night = requireWerewolfNightState(state);
      return createWerewolfStepContext({
        state: night.roles,
        facts,
        seat,
        record,
        stepId: night.slice.current?.stepId ?? null,
        randomSeed,
        bottomCards: state.bottomCards ?? [],
        nightPresence: resolveNightPresenceFacts(
          state.templateRoles,
          WEREWOLF_PRESENCE_DECLARATIONS,
        ),
        resolvedWolfKillTarget: night.wolfKill?.target ?? null,
        resolvedWolfKillVerdict: night.wolfKill?.verdict,
      });
    },
    isAudioPlaying: (state) => state.isAudioPlaying,
    seatedSeats: (state) => requireWerewolfNightState(state).roles.seatedSeats,
  };
}

/** Only shared group reveals may be bulk-acknowledged for bot seats. */
export function planWerewolfGroupBotAcknowledgements(state: GameState) {
  const night = requireWerewolfNightState(state);
  const current = night.slice.current;
  if (current === null) return [];
  const runtime = createWerewolfStepRuntime(null);
  const definition = runtime.definitions[current.stepId];
  if (definition === undefined) throw new Error(`[FAIL-FAST] Unknown night step ${current.stepId}`);
  if (definition.audience !== 'allSeats') return [];
  const record = night.slice.records[current.stepId] ?? { bySeat: {} };
  const context = runtime.createContext(state, night.facts, null, record);
  const actors = definition.actors(context);
  if (
    actors.length !== night.roles.seatedSeats.length ||
    night.roles.seatedSeats.some((seat) => !actors.includes(seat)) ||
    definition.actions.length === 0 ||
    !definition.actions.every((action) => action.kind === 'view')
  ) {
    throw new Error(`[FAIL-FAST] Invalid all-seat view step ${current.stepId}`);
  }
  return planBotAcknowledgements(runtime, state, getBotSeats(state.roster));
}

interface WerewolfStepContextInput {
  readonly state: WerewolfRoleState;
  readonly facts: WerewolfNightFacts;
  readonly seat: number | null;
  readonly record: StepRecord<WerewolfRoleStepResult>;
  readonly stepId: string | null;
  readonly randomSeed: string | null;
  readonly bottomCards: readonly RoleId[];
  readonly nightPresence: NightPresenceFacts<string>;
  readonly resolvedWolfKillTarget: number | null;
  readonly resolvedWolfKillVerdict?: ResolvedWolfKillVerdict | null;
}

function createWerewolfStepContext(input: WerewolfStepContextInput): WerewolfRoleStepContext {
  const { state, facts, seat, record } = input;
  const role = createWerewolfRoleContext(state.identities, state.location, state.sight);
  const context: WerewolfRoleStepContext = {
    state,
    facts,
    seat,
    record,
    role,
    teamOfRole: (roleId) => getWerewolfRoleDefinition(roleId).traits.team,
    factionOfRole: (roleId) => getWerewolfRoleDefinition(roleId).traits.faction,
    checkReactionOfRole: (roleId) => getWerewolfRoleDefinition(roleId).traits.checkReaction,
    doesRoleVoteWithWolves: (roleId) =>
      getWerewolfRoleDefinition(roleId).traits.recognition?.participatesInWolfVote === true,
    isWolfKillTargetForbidden: (targetSeat) =>
      getWerewolfRoleDefinition(role.roleOf(targetSeat)).traits.wolfKillTargetForbidden === true,
    isAdjacentToWolfFaction: (targetSeat) =>
      state.seatedSeats.some((wolfSeat) => {
        if (!isKnownWolfTeammate(context, wolfSeat)) return false;
        const distance = Math.abs(targetSeat - wolfSeat);
        return distance === 1 || distance === state.seatedSeats.length - 1;
      }),
    roleNameOf: (roleId) => getWerewolfRoleDefinition(roleId).card.name,
    randomBoolean: () => {
      if (seat === null || input.stepId === null || input.randomSeed === null) {
        throw new Error('[FAIL-FAST] A random result was requested outside a submission');
      }
      return createSeededRng(`${input.randomSeed}:resolver:${input.stepId}:${seat}`)() >= 0.5;
    },
    nightPresence: input.nightPresence,
    resolvedWolfKillTarget: input.resolvedWolfKillTarget,
    resolvedWolfKillVerdict: input.resolvedWolfKillVerdict,
    canShootAtNight: (targetSeat) => {
      const causes = resolveDeathEffects(collectWerewolfDeathEffects(context)).causes[targetSeat];
      return causes === undefined || causes.every((cause) => cause === 'wolfKill');
    },
    abilityLockReasonOf: (roleId) => {
      const reason = getWerewolfRoleDefinition(roleId).abilityLockReason;
      if (reason === undefined) {
        throw new Error(`[FAIL-FAST] ${roleId} locks skills but declares no reason`);
      }
      return reason;
    },
    wolfAttackLockOf: (roleId) => {
      const lock = getWerewolfRoleDefinition(roleId).wolfAttackLock;
      if (lock === undefined) {
        throw new Error(`[FAIL-FAST] ${roleId} stops the wolf attack but declares no wording`);
      }
      return lock;
    },
    bottomCardsOf: () => createBottomCards(input.bottomCards),
  };
  return context;
}

export function collectWerewolfDeathEffects(
  context: WerewolfRoleStepContext,
): readonly DeathEffect[] {
  const effects: DeathEffect[] = [...context.facts.deathEffects];
  const passiveContext = { ...context, seat: null, record: { bySeat: {} } };
  for (const seat of context.state.seatedSeats) {
    // A card taken for the night brings its passive traits with it.
    for (const roleId of context.role.activeRoleIdsOf(seat)) {
      const role = getWerewolfRoleDefinition(roleId);
      if (role.traits.immunities !== undefined) {
        effects.push({ kind: 'immune', seat, against: role.traits.immunities });
      }
      effects.push(...(role.passiveDeathEffects?.(passiveContext, seat) ?? []));
    }
  }
  return effects;
}

function createBottomCards(bottomCards: readonly RoleId[]): readonly WerewolfBottomCard[] {
  return bottomCards.map((roleId, index) => {
    const role = getWerewolfRoleDefinition(roleId);
    return { index, label: role.card.name, roleId, faction: role.traits.faction };
  });
}
