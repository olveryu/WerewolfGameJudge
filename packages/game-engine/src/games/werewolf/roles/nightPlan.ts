import type { RoleId } from '../domain/models';
import {
  WEREWOLF_ROLE_DEFINITIONS,
  WEREWOLF_SHARED_STEP_OWNER_ROLE_ID,
  WEREWOLF_SHARED_STEPS,
  type WerewolfConversionDeclaration,
  type WerewolfNightFacts,
  type WerewolfRoleDefinition,
  type WerewolfRoleState,
  type WerewolfRoleStepDefinition,
} from '.';
import { withConversionLock } from './conversion';
import { grantBorrowedAbility, replaceCurrentRole } from './identity';
import { NIGHT_STEP_ORDER } from './nightStepOrder';

export type WerewolfRoleStep = WerewolfRoleStepDefinition;

export interface WerewolfNightDeal {
  readonly seats: readonly { readonly seat: number; readonly role: RoleId }[];
  readonly templateRoles: readonly RoleId[];
  readonly seerLabelMap: Readonly<Record<string, number>>;
  readonly witchCanSelfHeal: boolean;
}

export interface PlannedWerewolfStep {
  readonly roleId: RoleId;
  readonly stepId: string;
}

export const EMPTY_WEREWOLF_NIGHT_FACTS: WerewolfNightFacts = {
  selections: [],
  identityChanges: [],
  cardSelections: [],
  disabledAbilities: [],
  deathEffects: [],
};

const ROLE_BY_ID = new Map<string, WerewolfRoleDefinition>(
  WEREWOLF_ROLE_DEFINITIONS.map((role) => [role.id, role]),
);

export function getWerewolfRoleDefinition(roleId: string): WerewolfRoleDefinition {
  const role = ROLE_BY_ID.get(roleId);
  if (role === undefined) throw new Error(`[FAIL-FAST] Missing new role ${roleId}`);
  return role;
}

function getWerewolfConversionDeclaration(roleId: string): WerewolfConversionDeclaration {
  const declaration = getWerewolfRoleDefinition(roleId).conversion;
  if (declaration === undefined) {
    throw new Error(`[FAIL-FAST] ${roleId} converted a player but declares no conversion`);
  }
  return declaration;
}

/** The role on this board that can convert another player, with its rule; null when none can. */
export function getWerewolfBoardConversion(
  templateRoles: readonly string[],
): { readonly roleId: string; readonly declaration: WerewolfConversionDeclaration } | null {
  const converting = [...new Set(templateRoles)].flatMap((roleId) => {
    const declaration = getWerewolfRoleDefinition(roleId).conversion;
    return declaration === undefined ? [] : [{ roleId, declaration }];
  });
  if (converting.length > 1) {
    throw new Error('[FAIL-FAST] A board holds more than one converting role');
  }
  return converting[0] ?? null;
}

function createWerewolfStepDefinitions(): Readonly<Record<string, WerewolfRoleStep>> {
  const definitions: Record<string, WerewolfRoleStep> = {};
  for (const role of WEREWOLF_ROLE_DEFINITIONS) {
    for (const step of role.steps) {
      if (definitions[step.id] !== undefined) {
        throw new Error(`[FAIL-FAST] Duplicate new step ${step.id}`);
      }
      definitions[step.id] = withConversionLock(step, role.id, getWerewolfConversionDeclaration);
    }
  }
  for (const step of WEREWOLF_SHARED_STEPS) {
    if (definitions[step.id] !== undefined) {
      throw new Error(`[FAIL-FAST] Duplicate new step ${step.id}`);
    }
    definitions[step.id] = step;
  }
  return definitions;
}

export const WEREWOLF_STEP_DEFINITIONS = createWerewolfStepDefinitions();

export function isWerewolfStepId(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(WEREWOLF_STEP_DEFINITIONS, value);
}

export function createWerewolfRoleState(deal: WerewolfNightDeal): WerewolfRoleState {
  return {
    identities: Object.fromEntries(
      deal.seats.map(({ seat, role }) => [
        seat,
        { dealtRole: role, currentRole: role, borrowedAbilityRole: null },
      ]),
    ),
    location: { swap: null },
    sight: { roleOverridesBySeat: {} },
    seatedSeats: deal.seats.map((player) => player.seat).sort((a, b) => a - b),
    rules: { witchCanSelfHeal: deal.witchCanSelfHeal },
    usedResources: [],
  };
}

/** The role on this board that owns `stepId`; the shared wolf step belongs to the wolves. */
export function getWerewolfStepOwnerRoleId(
  templateRoles: readonly string[],
  stepId: string,
): string | null {
  if (WEREWOLF_SHARED_STEPS.some((step) => step.id === stepId))
    return WEREWOLF_SHARED_STEP_OWNER_ROLE_ID;
  return (
    templateRoles.find((role) =>
      getWerewolfRoleDefinition(role).steps.some((step) => step.id === stepId),
    ) ?? null
  );
}

export function createWerewolfNightPlan(deal: WerewolfNightDeal): readonly PlannedWerewolfStep[] {
  const stepsById = new Map<string, PlannedWerewolfStep>();
  for (const roleId of new Set(deal.templateRoles)) {
    for (const step of getWerewolfRoleDefinition(roleId).steps) {
      if (stepsById.has(step.id)) throw new Error(`[FAIL-FAST] Duplicate new step ${step.id}`);
      stepsById.set(step.id, { roleId, stepId: step.id });
    }
  }
  if (
    deal.templateRoles.some(
      (roleId) =>
        getWerewolfRoleDefinition(roleId).traits.recognition?.participatesInWolfVote === true,
    )
  ) {
    for (const step of WEREWOLF_SHARED_STEPS) {
      stepsById.set(step.id, { roleId: WEREWOLF_SHARED_STEP_OWNER_ROLE_ID, stepId: step.id });
    }
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

export function mergeWerewolfNightFacts(
  previous: WerewolfNightFacts,
  emitted: Partial<WerewolfNightFacts>,
): WerewolfNightFacts {
  const updatedVoters = new Set((emitted.wolfVotes ?? []).map((vote) => vote.actorSeat));
  return {
    selections: [...previous.selections, ...(emitted.selections ?? [])],
    identityChanges: [...previous.identityChanges, ...(emitted.identityChanges ?? [])],
    cardSelections: [...previous.cardSelections, ...(emitted.cardSelections ?? [])],
    disabledAbilities: [...previous.disabledAbilities, ...(emitted.disabledAbilities ?? [])],
    deathEffects: [...previous.deathEffects, ...(emitted.deathEffects ?? [])],
    wolfVotes: [
      ...(previous.wolfVotes ?? []).filter((vote) => !updatedVoters.has(vote.actorSeat)),
      ...(emitted.wolfVotes ?? []),
    ],
    locationSwaps: [...(previous.locationSwaps ?? []), ...(emitted.locationSwaps ?? [])],
    resourceUses: [...(previous.resourceUses ?? []), ...(emitted.resourceUses ?? [])],
    factionChanges: [...(previous.factionChanges ?? []), ...(emitted.factionChanges ?? [])],
    conversionAttempts: [
      ...(previous.conversionAttempts ?? []),
      ...(emitted.conversionAttempts ?? []),
    ],
    wolfGirlConfessions: [
      ...(previous.wolfGirlConfessions ?? []),
      ...(emitted.wolfGirlConfessions ?? []),
    ],
    sightOverrides: [...(previous.sightOverrides ?? []), ...(emitted.sightOverrides ?? [])],
    reflections: [...(previous.reflections ?? []), ...(emitted.reflections ?? [])],
    conversions: [...(previous.conversions ?? []), ...(emitted.conversions ?? [])],
  };
}

export function applyWerewolfRoleFacts(
  state: WerewolfRoleState,
  emitted: Partial<WerewolfNightFacts>,
): WerewolfRoleState {
  let identities = state.identities;
  for (const change of emitted.identityChanges ?? []) {
    identities =
      change.kind === 'replaceCurrentRole'
        ? replaceCurrentRole(identities, change.seat, change.roleId)
        : grantBorrowedAbility(identities, change.seat, change.roleId);
  }
  const swaps = emitted.locationSwaps ?? [];
  if (swaps.length > 1) throw new Error('[FAIL-FAST] One step emitted multiple seat swaps');
  const roleOverridesBySeat = { ...state.sight.roleOverridesBySeat };
  for (const override of emitted.sightOverrides ?? []) {
    roleOverridesBySeat[override.seat] = override.roleId;
  }
  return {
    ...state,
    identities,
    location: swaps[0] === undefined ? state.location : { swap: swaps[0] },
    sight: { roleOverridesBySeat },
    usedResources: [...state.usedResources, ...(emitted.resourceUses ?? [])],
  };
}
