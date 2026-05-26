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

import { type RoleId, type SchemaId } from '../../models';
import type { WitchAction } from '../../models/actions/WitchAction';
import {
  getWitchPoisonTarget,
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
} from '../../models/actions/WitchAction';
import type { RoleSpec } from '../../models/roles/spec/roleSpec.types';
import { ROLE_SPECS } from '../../models/roles/spec/specs';
import type { ProtocolAction } from '../../protocol/types';
import { getRoleAfterSwap } from '../../resolvers/types';
import { buildSeatRoleMap } from '../../utils/playerHelpers';
import type { NightActions, ReflectionSource, RoleSeatMap } from '../DeathCalculator';
import { resolveWolfVotes } from '../resolveWolfVotes';
import type { NonNullState } from './types';

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
export function buildEffectiveRoleSeatMap(state: NonNullState): Map<RoleId, number> {
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
export function buildRoleSeatMap(
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
    const spec = ROLE_SPECS[roleId] as RoleSpec;

    // Flag-driven seat arrays (unchanged from V2)
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
export function buildCheckedSeats(
  effectiveRoleSeatMap: Map<RoleId, number>,
  protocolActions: readonly ProtocolAction[],
  nightActions: NightActions,
): number[] {
  const checkedSeats: number[] = [];
  const { nightmareBlock } = nightActions;

  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec = ROLE_SPECS[roleId] as RoleSpec;
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
export function buildReflectionSources(
  effectiveRoleSeatMap: Map<RoleId, number>,
  protocolActions: readonly ProtocolAction[],
  nightActions: NightActions,
): readonly ReflectionSource[] {
  const sources: ReflectionSource[] = [];
  const { nightmareBlock } = nightActions;

  for (const [roleId, seat] of effectiveRoleSeatMap) {
    const spec = ROLE_SPECS[roleId] as RoleSpec;
    if (!spec.deathCalcRole) continue;

    // Skip nightmare-blocked sources
    if (nightmareBlock !== undefined && nightmareBlock === seat) continue;

    if (spec.deathCalcRole === 'checkSource') {
      // Find schemaId from the role's first nightStep
      const stepId = spec.nightSteps?.[0]?.stepId;
      if (!stepId) continue;
      const action = findActionBySchemaId(protocolActions, stepId as SchemaId);
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
export function buildNightActions(state: NonNullState): NightActions {
  const actions = state.actions;
  const nightActions: NightActions = {};

  // Wolf kill - resolve final target from wolfVotesBySeat
  // Single source of truth is the votes table; final target is derived.
  if (!state.wolfKillOverride) {
    if (!state.currentNightResults) {
      throw new Error(
        '[FAIL-FAST] buildNightActions: currentNightResults missing in ongoing state',
      );
    }
    const wolfVotesBySeat = state.currentNightResults.wolfVotesBySeat ?? {};
    const votes = new Map<number, number>();
    for (const [seatStr, targetSeat] of Object.entries(wolfVotesBySeat)) {
      const seat = Number.parseInt(seatStr, 10);
      if (!Number.isFinite(seat) || typeof targetSeat !== 'number') continue;
      votes.set(seat, targetSeat);
    }

    const resolved = resolveWolfVotes(votes, {
      requireUnanimity: state.templateRoles.includes('cupid'),
    });
    if (typeof resolved === 'number') {
      nightActions.wolfKill = resolved;
    }
  }

  // Check whether nightmare blocked a wolf
  if (state.wolfKillOverride) {
    nightActions.isWolfBlockedByNightmare = true;
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
