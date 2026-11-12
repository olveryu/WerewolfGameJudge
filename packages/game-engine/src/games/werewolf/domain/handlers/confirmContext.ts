/**
 * Confirm Context - Confirm-context computation for status-driven role steps
 *
 * Pure-function module, responsible for:
 * - Computing canShoot before entering hunterConfirm / darkWolfKingConfirm steps
 * - Computing faction before entering avengerConfirm step
 * - Computing wolf-teammate seats before entering hiddenWolfConfirm step
 * - Returning a SET_CONFIRM_STATUS action or null
 *
 * Design principles:
 * - Single source of truth: confirmStatus lives only in GameState.confirmStatus
 * - Pure function: no IO, no external reads, no state writes
 * - Symmetric with witchContext.ts: step-entry context, ready before the step begins
 *
 * @remarks Exact canShoot conditions:
 *   Living players retain eligibility for a later wolf kill or daytime exile.
 *   A night death permits shooting only when all damage sources are wolfKill or its magician transfer.
 *   The authoritative death pipeline applies protection, reflection, links and swaps to known actions.
 *   deriveConfirmStepRoleMap() builds a static mapping from ROLE_SPECS at module load time.
 */

import { type RoleId, type SchemaId } from '../models/roles/spec';
import { getAllRoleIds, getRoleSpec } from '../models/roles/spec/specs';
import { Faction } from '../models/roles/spec/types';
import { buildSeatRoleMap, isVacantBottomCardStep, resolveNightStepActor } from '../playerHelpers';
import type {
  ConfirmStatus,
  GameState,
  SeedWolfConfirmStatus,
  WolfTeammatesConfirmStatus,
} from '../protocol/types';
import type { SetConfirmStatusAction } from '../reducer/types';
import { getRoleAfterSwap } from '../resolvers/types';
import { calculateNightDeaths } from './deathResolution';
import { getLegacyWolfKillTarget } from './wolfKillResolution';

type ConfirmRole = 'hunter' | 'darkWolfKing' | 'avenger' | 'hiddenWolf' | 'seedWolf';

function isConfirmRole(roleId: RoleId): roleId is ConfirmRole {
  return (
    roleId === 'hunter' ||
    roleId === 'darkWolfKing' ||
    roleId === 'avenger' ||
    roleId === 'hiddenWolf' ||
    roleId === 'seedWolf'
  );
}

/**
 * Derive the confirm-step → role mapping from ROLE_SPECS.
 * Scans for roles with confirm-kind nightSteps.
 */
function deriveConfirmStepRoleMap(): Partial<Record<SchemaId, ConfirmRole>> {
  const map: Partial<Record<SchemaId, ConfirmRole>> = {};
  for (const roleId of getAllRoleIds()) {
    const spec = getRoleSpec(roleId);
    if (!spec.nightSteps) continue;
    for (const step of spec.nightSteps) {
      if (step.actionKind === 'confirm') {
        if (!isConfirmRole(roleId)) {
          throw new Error(`[confirmContext] Unsupported confirm role: ${roleId}`);
        }
        map[step.stepId] = roleId;
      }
    }
  }
  return map;
}

/** hunterConfirm / darkWolfKingConfirm / avengerConfirm stepId -> role mapping */
const CONFIRM_STEP_ROLE = deriveConfirmStepRoleMap();

/**
 * Determine whether a seat can shoot at night (only when killed by wolves or exiled by vote).
 *
 * Abnormal night deaths (poison / lover suicide / dreamcatcher chain / charm chain) cannot shoot.
 * Shared by confirmContext (Hunter / DarkWolfKing) and actionHandler (wolfRobot learning Hunter).
 */
export function computeCanShootForSeat(seat: number, state: GameState): boolean {
  const { deathSources } = calculateNightDeaths(state, getLegacyWolfKillTarget(state) ?? null);
  const sources = deathSources[seat];
  return (
    sources === undefined ||
    sources.every((source) => source === 'wolfKill' || source === 'magicianSwap')
  );
}

/**
 * Compute confirmStatus (pure function).
 *
 * Hunter / DarkWolfKing: can shoot only when killed by wolves or exiled by vote.
 * Abnormal night deaths (poison / lover suicide / dreamcatcher chain / charm chain) cannot shoot.
 *
 * Avenger: faction is precomputed by the shadow resolver and stored in currentNightResults.avengerFaction; read directly here.
 */
function computeConfirmStatus(
  role: ConfirmRole,
  state: GameState,
  wolfKillTarget?: number,
): ConfirmStatus {
  if (role === 'avenger') {
    return computeAvengerConfirmStatus(state);
  }
  if (role === 'hiddenWolf') {
    return computeHiddenWolfConfirmStatus(state);
  }
  if (role === 'seedWolf') {
    return computeSeedWolfConfirmStatus(state, wolfKillTarget);
  }

  // Hunter / DarkWolfKing
  const roleActor = resolveNightStepActor(state, role);

  if (roleActor === null) {
    throw new Error(`[FAIL-FAST] ${role} confirm step has no assigned role seat`);
  }

  return { role, canShoot: computeCanShootForSeat(roleActor.seat, state) };
}

function computeSeedWolfConfirmStatus(
  state: GameState,
  wolfKillTarget?: number,
): SeedWolfConfirmStatus {
  if (wolfKillTarget === undefined) {
    return { role: 'seedWolf', availability: 'unavailable', reason: 'noTarget' };
  }

  const roleAtTarget = getRoleAfterSwap(
    wolfKillTarget,
    buildSeatRoleMap(state.players),
    state.currentNightResults?.swappedSeats,
  );
  if (!roleAtTarget) {
    throw new Error(`[FAIL-FAST] Seed Wolf target seat ${wolfKillTarget} has no assigned role`);
  }
  if (getRoleSpec(roleAtTarget).faction === Faction.Wolf) {
    return { role: 'seedWolf', availability: 'unavailable', reason: 'wolfTarget' };
  }

  return { role: 'seedWolf', availability: 'available', targetSeat: wolfKillTarget };
}

/**
 * Compute Avenger confirm status.
 *
 * avengerFaction is computed directly by the shadow resolver during mimicry and stored in currentNightResults.
 * Just read it here; no need to re-derive. No target selected (blocked / not in template) -> default to good faction.
 */
function computeAvengerConfirmStatus(state: GameState): ConfirmStatus {
  const faction = state.currentNightResults?.avengerFaction;
  if (!faction) {
    throw new Error('[FAIL-FAST] Avenger confirm step has no resolved faction');
  }
  return {
    role: 'avenger',
    faction,
  };
}

/**
 * Compute HiddenWolf confirm status.
 *
 * Iterate over all seats and find those with faction === Faction.Wolf that are not the HiddenWolf itself.
 */
function computeHiddenWolfConfirmStatus(state: GameState): WolfTeammatesConfirmStatus {
  const wolfTeammates: number[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (!player?.role) continue;
    const spec = getRoleSpec(player.role);
    if (spec.faction === Faction.Wolf && player.role !== 'hiddenWolf') {
      const seat = Number.parseInt(seatStr, 10);
      if (!Number.isSafeInteger(seat)) {
        throw new Error(`[FAIL-FAST] Invalid player seat key: ${seatStr}`);
      }
      wolfTeammates.push(seat);
    }
  }
  return { role: 'hiddenWolf', wolfTeammates };
}

/**
 * Check whether confirmStatus needs to be set; if so, return the action.
 *
 * Unified entry: call this whenever hunterConfirm / darkWolfKingConfirm steps are about to be entered.
 *
 * @param nextStepId The step ID about to be entered
 * @param state Current game state
 * @returns SET_CONFIRM_STATUS action or null
 */
export function maybeCreateConfirmStatusAction(
  nextStepId: SchemaId,
  state: GameState,
  wolfKillTarget?: number,
): SetConfirmStatusAction | null {
  const role = CONFIRM_STEP_ROLE[nextStepId];
  if (!role) {
    return null;
  }

  // Check whether the role is in the template
  if (!state.templateRoles.includes(role)) {
    return null;
  }
  if (isVacantBottomCardStep(state, nextStepId)) return null;

  return {
    type: 'SET_CONFIRM_STATUS',
    payload: computeConfirmStatus(role, state, wolfKillTarget),
  };
}
