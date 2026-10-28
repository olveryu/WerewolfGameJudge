/**
 * Death Resolution - night-end death settlement helpers
 *
 * Pure function module, responsible for:
 * - Building NightActions from state (wolf kill, guard, witch, wolf queen charm, etc.)
 * - Building effective role -> seat map (magician swap aware)
 * - Building RoleSeatMap (deathCalcRole driven, consumed by DeathCalculator)
 * - Building reflection source list (checkSource / poisonSource)
 *
 * Only consumed by handleEndNight. No IO, does not mutate state.
 *
 * @remarks effective seat (effectiveRoleSeatMap) vs physical seat (roleSeatMap):
 *   After magician/thief swap, effectiveRoleSeatMap reflects runtime role positions,
 *   while state.players reflects initial assignment. Death calculation uses effective.
 *   Death priority is determined internally by DeathCalculator: wolfKill > poison > couple > dream > charm.
 */

import {
  calculateDeathsDetailed,
  type DeathsDetailed,
  type NightActions,
  type ReflectionSource,
  type RoleSeatMap,
} from '../DeathCalculator';
import { type RoleId, type SchemaId } from '../models';
import type { WitchAction } from '../models/actions/WitchAction';
import {
  getWitchPoisonTarget,
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
} from '../models/actions/WitchAction';
import { getRoleSpec } from '../models/roles/spec/specs';
import { Team } from '../models/roles/spec/types';
import { buildSeatRoleMap } from '../playerHelpers';
import type { GameState, ProtocolAction, SeedWolfInfectionResult } from '../protocol/types';
import { getRoleAfterSwap } from '../resolvers/types';

/**
 * Build RoleSeatMap from state.players (magician swap aware)
 *
 * Unified identity resolution: iterate all seats, use getRoleAfterSwap to get the
 * post-swap effective identity, then reverse-lookup the "effective seat" for each key role.
 * This way, rules like Spirit Knight reflection and poison immunity in DeathCalculator
 * automatically follow the post-swap identity.
 *
 * Constraint validation still uses the original players map (players don't know about
 * swap; action legality is judged by known information).
 */
function buildEffectiveRoleSeatMap(state: GameState): Map<RoleId, number> {
  const swappedSeats = state.currentNightResults?.swappedSeats;
  const players = buildSeatRoleMap(state.players);

  const effectiveRoleSeatMap = new Map<RoleId, number>();
  for (const [seat] of players) {
    const effectiveRole = getRoleAfterSwap(seat, players, swappedSeats);
    if (effectiveRole) {
      effectiveRoleSeatMap.set(effectiveRole, seat);
    }
  }
  return effectiveRoleSeatMap;
}

/**
 * Build RoleSeatMap from effectiveRoleSeatMap (deathCalcRole driven)
 *
 * Single-loop scan over each role's deathCalcRole + immunities + abilities,
 * replacing the previous hardcoded lookup of 7 roleId strings.
 * reflectionSources is built by buildReflectionSources then injected.
 */
function buildRoleSeatMap(
  effectiveRoleSeatMap: Map<RoleId, number>,
  reflectionSources: readonly ReflectionSource[],
  isBonded: boolean,
  coupleLinkSeats: RoleSeatMap['coupleLinkSeats'],
  checkedSeats: readonly number[],
): RoleSeatMap {
  const poisonImmuneSeats: number[] = [];
  const reflectsDamageSeats: number[] = [];
  const wolfKillSilentImmuneSeats: number[] = [];
  const checkDeathVulnerableSeats: number[] = [];
  const bondedLinkCandidates: number[] = [];
  let wolfQueenLinkSeat = -1;
  let dreamcatcherLinkSeat = -1;
  let guardProtectorSeat = -1;
  let poisonSourceSeat = -1;

  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec = getRoleSpec(roleId);

    // Flag-driven seat arrays
    if (spec.immunities?.some((i) => i.kind === 'poison')) {
      poisonImmuneSeats.push(seat);
    }
    if (spec.abilities.some((a) => a.type === 'passive' && a.effect === 'reflectsDamage')) {
      reflectsDamageSeats.push(seat);
    }
    // Silent wolf kill immunity (cursedFox): wolves CAN target, kill silently negated
    if (spec.abilities.some((a) => a.type === 'passive' && a.effect === 'silentWolfKillImmune')) {
      wolfKillSilentImmuneSeats.push(seat);
    }

    // deathCalcRole-driven fields
    switch (spec.deathCalcRole) {
      case 'wolfQueenLink':
        wolfQueenLinkSeat = seat;
        break;
      case 'dreamcatcherLink':
        dreamcatcherLinkSeat = seat;
        break;
      case 'guardProtector':
        guardProtectorSeat = seat;
        break;
      case 'poisonSource':
        poisonSourceSeat = seat;
        break;
      case 'bondedLink':
        bondedLinkCandidates.push(seat);
        break;
      case 'checkDeathTarget':
        checkDeathVulnerableSeats.push(seat);
        break;
      // 'checkSource' and 'reflectTarget' don't need dedicated fields
    }
  }

  // bondedLinkSeats is only active when isBonded=true AND exactly 2 candidates found
  const bondedLinkSeats: RoleSeatMap['bondedLinkSeats'] =
    isBonded && bondedLinkCandidates.length === 2
      ? [bondedLinkCandidates[0]!, bondedLinkCandidates[1]!]
      : null;

  // checkDeathTargetSeats = intersection of vulnerable seats AND actually-checked seats
  const checkDeathTargetSeats = checkDeathVulnerableSeats.filter((s) => checkedSeats.includes(s));

  return {
    wolfQueenLinkSeat,
    dreamcatcherLinkSeat,
    guardProtectorSeat,
    poisonSourceSeat,
    bondedLinkSeats,
    coupleLinkSeats,
    poisonImmuneSeats,
    reflectsDamageSeats,
    wolfKillSilentImmuneSeats,
    checkDeathTargetSeats,
    reflectionSources,
  };
}

/**
 * Build the list of seats checked tonight.
 *
 * Scans roles with deathCalcRole='checkSource', extracts actual check targets from ProtocolAction.
 * Used to compute checkDeathTargetSeats (intersection with checkDeathVulnerable).
 */
function buildCheckedSeats(
  effectiveRoleSeatMap: Map<RoleId, number>,
  protocolActions: readonly ProtocolAction[],
  nightActions: NightActions,
): number[] {
  const checkedSeats: number[] = [];
  const { nightmareBlock } = nightActions;

  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec = getRoleSpec(roleId);
    if (spec.deathCalcRole !== 'checkSource') continue;

    // Skip nightmare-blocked check sources
    if (nightmareBlock !== undefined && nightmareBlock === seat) continue;

    const stepId = spec.nightSteps?.[0]?.stepId;
    if (!stepId) continue;
    const action = protocolActions.find((a) => a.schemaId === stepId);
    if (action?.targetSeat !== undefined) {
      checkedSeats.push(action.targetSeat);
    }
  }

  return checkedSeats;
}

/**
 * Build the reflection source list.
 *
 * Scans roles with deathCalcRole='checkSource': find schemaId from spec.nightSteps[0].stepId,
 * then read targetSeat from ProtocolAction -> generate { sourceSeat, targetSeat }.
 *
 * Scans deathCalcRole='poisonSource': extract poisonTarget from nightActions.witchAction.
 *
 * Sources blocked by nightmare are excluded here (sourceSeat === nightmareBlock -> no entry generated).
 */
function buildReflectionSources(
  effectiveRoleSeatMap: Map<RoleId, number>,
  protocolActions: readonly ProtocolAction[],
  nightActions: NightActions,
): readonly ReflectionSource[] {
  const sources: ReflectionSource[] = [];
  const { nightmareBlock } = nightActions;

  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec = getRoleSpec(roleId);
    if (!spec.deathCalcRole) continue;

    // Skip nightmare-blocked sources
    if (nightmareBlock !== undefined && nightmareBlock === seat) continue;

    if (spec.deathCalcRole === 'checkSource') {
      // Find schemaId from the role's first nightStep
      const stepId = spec.nightSteps?.[0]?.stepId;
      if (!stepId) continue;
      const action = findActionBySchemaId(protocolActions, stepId);
      if (action?.targetSeat !== undefined) {
        sources.push({ sourceSeat: seat, targetSeat: action.targetSeat });
      }
    } else if (spec.deathCalcRole === 'poisonSource') {
      const poisonTarget = getWitchPoisonTarget(nightActions.witchAction);
      if (poisonTarget !== undefined) {
        sources.push({ sourceSeat: seat, targetSeat: poisonTarget });
      }
    }
  }

  return sources;
}

/**
 * Look up an action by schemaId from the ProtocolAction list.
 */
function findActionBySchemaId(
  actions: readonly ProtocolAction[],
  schemaId: SchemaId,
): ProtocolAction | undefined {
  return actions.find((a) => a.schemaId === schemaId);
}

/**
 * Reconstruct WitchAction from currentNightResults.
 *
 * wire protocol: witch's save/poison result is already written to currentNightResults.savedSeat / poisonedSeat.
 * Read directly from currentNightResults here, no longer depending on ProtocolAction.targetSeat.
 */
function extractWitchAction(currentNightResults?: {
  savedSeat?: number;
  poisonedSeat?: number;
}): WitchAction | undefined {
  const savedSeat = currentNightResults?.savedSeat;
  const poisonedSeat = currentNightResults?.poisonedSeat;

  // Check save first (save and poison cannot both be effective)
  if (savedSeat !== undefined) {
    return makeWitchSave(savedSeat);
  }

  if (poisonedSeat !== undefined) {
    return makeWitchPoison(poisonedSeat);
  }

  // No ability used
  return makeWitchNone();
}

/**
 * Build NightActions from state for death resolution.
 *
 * Data source design:
 * - currentNightResults (resolver output): wolfVotesBySeat, witchAction, swappedSeats
 *   -> these fields are processed by resolvers, representing final semantic results (e.g. witch save/poison distinction).
 * - ProtocolAction[] (raw submissions): guardProtect, wolfQueenCharm, dreamcatcherDream, nightmareBlock
 *   -> these fields are simple chooseSeat targets, resolvers do no extra transformation, targetSeat is the final value.
 * - Check-type reflection sources (seerCheck etc.) are no longer collected into NightActions, driven by buildReflectionSources instead.
 *
 * All seat numbers are physical seats (0-based), consistent coordinate space.
 */
type WolfKillResolution =
  | { readonly kind: 'stored'; readonly target: number | null }
  | { readonly kind: 'fixed'; readonly targetSeat: number };

function buildNightActions(state: GameState, wolfKillResolution: WolfKillResolution): NightActions {
  const actions = state.actions;
  const nightActions: NightActions = {};

  // Wolf kill - the settled target is supplied by the caller, never
  // re-resolved from the votes here. Re-resolving a tied vote with a
  // fresh seed is how settlement could pick a different target than
  // the one the witch was shown and saved. 'stored' is the single
  // settlement (GameState.resolvedWolfKillTarget); 'fixed' is the Seed
  // Wolf infection check, which asks whether a given seat would die
  // as the wolf-kill target.
  if (!state.wolfKillOverride) {
    if (wolfKillResolution.kind === 'fixed') {
      nightActions.wolfKill = wolfKillResolution.targetSeat;
    } else if (wolfKillResolution.target !== null) {
      nightActions.wolfKill = wolfKillResolution.target;
    }
  }

  // Check whether nightmare blocked a wolf
  if (state.wolfKillOverride) {
    nightActions.isWolfBlockedByNightmare = true;
  }

  if (state.seedWolfInfectionResult?.outcome === 'converted') {
    nightActions.seedWolfInfectedSeat = state.seedWolfInfectionResult.targetSeat;
  }

  // Guard protect
  const guardAction = findActionBySchemaId(actions, 'guardProtect');
  if (guardAction?.targetSeat !== undefined) {
    nightActions.guardProtect = guardAction.targetSeat;
  }

  // Witch action - read from currentNightResults.savedSeat / poisonedSeat
  nightActions.witchAction = extractWitchAction(state.currentNightResults);

  // Wolf Queen charm
  const wolfQueenAction = findActionBySchemaId(actions, 'wolfQueenCharm');
  if (wolfQueenAction?.targetSeat !== undefined) {
    nightActions.wolfQueenCharm = wolfQueenAction.targetSeat;
  }

  // Dreamcatcher dream
  const dreamcatcherAction = findActionBySchemaId(actions, 'dreamcatcherDream');
  if (dreamcatcherAction?.targetSeat !== undefined) {
    nightActions.dreamcatcherDream = dreamcatcherAction.targetSeat;
  }

  // Magician swap - read from currentNightResults.swappedSeats
  if (state.currentNightResults?.swappedSeats) {
    const [first, second] = state.currentNightResults.swappedSeats;
    nightActions.magicianSwap = { first, second };
  }

  // Nightmare block
  const nightmareAction = findActionBySchemaId(actions, 'nightmareBlock');
  if (nightmareAction?.targetSeat !== undefined) {
    nightActions.nightmareBlock = nightmareAction.targetSeat;
  }

  return nightActions;
}

/** Build all death-calculation inputs from authoritative state and settle the night. */
function calculateNightDeathsFromActions(
  state: GameState,
  nightActions: NightActions,
): DeathsDetailed {
  const effectiveMap = buildEffectiveRoleSeatMap(state);
  const reflectionSources = buildReflectionSources(effectiveMap, state.actions, nightActions);
  const checkedSeats = buildCheckedSeats(effectiveMap, state.actions, nightActions);
  const roleSeatMap = buildRoleSeatMap(
    effectiveMap,
    reflectionSources,
    state.currentNightResults?.avengerFaction === Team.Third,
    state.loverSeats ?? null,
    checkedSeats,
  );
  return calculateDeathsDetailed(nightActions, roleSeatMap);
}

/**
 * Build all death-calculation inputs from authoritative state and
 * settle the night from the settled wolf-kill target.
 * @pre target is the single settlement for this night
 *   (GameState.resolvedWolfKillTarget, or a legacy fallback the caller
 *   persists in the same command); it is never re-resolved here.
 */
export function calculateNightDeaths(state: GameState, target: number | null): DeathsDetailed {
  return calculateNightDeathsFromActions(
    state,
    buildNightActions(state, { kind: 'stored', target }),
  );
}

/** Resolve Seed Wolf infection against its already-confirmed wolf-kill target. */
export function resolveSeedWolfInfectionResult(state: GameState): SeedWolfInfectionResult {
  if (state.seedWolfInfectionResult) return state.seedWolfInfectionResult;

  const targetSeat = state.currentNightResults?.seedWolfInfectionTarget;
  if (targetSeat === undefined) return { outcome: 'notUsed' };

  const nightActions = buildNightActions(state, { kind: 'fixed', targetSeat });
  const { deathSources } = calculateNightDeathsFromActions(state, nightActions);
  return deathSources[targetSeat]?.includes('wolfKill')
    ? { outcome: 'converted', targetSeat }
    : { outcome: 'failed', targetSeat };
}
