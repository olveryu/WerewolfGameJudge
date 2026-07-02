/**
 * Confirm Context - Confirm-context computation for Hunter / DarkWolfKing / Avenger / HiddenWolf
 *
 * Pure-function module, responsible for:
 * - Computing canShoot before entering hunterConfirm / darkWolfKingConfirm steps
 * - Computing faction before entering avengerConfirm step
 * - Computing wolf-teammate seats before entering hiddenWolfConfirm step
 * - Returning a SET_CONFIRM_STATUS action or null
 *
 * Design principles:
 * - Single source of truth: confirmStatus lives only in WerewolfState.confirmStatus
 * - Pure function: no IO, no external reads, no state writes
 * - Symmetric with witchContext.ts: step-entry context, ready before the step begins
 *
 * @remarks Exact canShoot conditions:
 *   canShoot = true only when the cause of death is wolfKill or exile (daytime exile vote).
 *   The following causes cannot shoot: poison (witch/poisoner), couple (lover suicide), dream (dreamcatcher chain), charm (eclipse wolf queen charm).
 *   Check order: witchContext.killedSeat -> coupleDeathVictim -> dreamLinkedDeath -> wolfQueenCharm.
 *   deriveConfirmStepRoleMap() builds a static mapping from ROLE_SPECS at module load time.
 */

import { findSeatByRole } from '../../utils/playerHelpers';
import { type SchemaId } from '../models/roles/spec';
import type { RoleSpec } from '../models/roles/spec/roleSpec.types';
import { ROLE_SPECS } from '../models/roles/spec/specs';
import { Faction, Team } from '../models/roles/spec/types';
import type { ConfirmStatus, WolfTeammatesConfirmStatus } from '../protocol/types';
import type { SetConfirmStatusAction } from '../reducer/types';
import type { NonNullState } from './types';

type ConfirmRole = 'hunter' | 'darkWolfKing' | 'avenger' | 'hiddenWolf';

/**
 * Derive the confirm-step → role mapping from ROLE_SPECS.
 * Scans for roles with confirm-kind nightSteps.
 */
function deriveConfirmStepRoleMap(): Record<string, ConfirmRole> {
  const map: Record<string, ConfirmRole> = {};
  for (const [roleId, rawSpec] of Object.entries(ROLE_SPECS)) {
    const spec = rawSpec as RoleSpec;
    if (!spec.nightSteps) continue;
    for (const step of spec.nightSteps) {
      if (step.actionKind === 'confirm') {
        map[step.stepId] = roleId as ConfirmRole;
      }
    }
  }
  return map;
}

/** hunterConfirm / darkWolfKingConfirm / avengerConfirm stepId -> role mapping */
const CONFIRM_STEP_ROLE: Record<string, ConfirmRole> = deriveConfirmStepRoleMap();

/**
 * Determine whether a seat can shoot at night (only when killed by wolves or exiled by vote).
 *
 * Abnormal night deaths (poison / lover suicide / dreamcatcher chain / charm chain) cannot shoot.
 * Shared by confirmContext (Hunter / DarkWolfKing) and actionHandler (wolfRobot learning Hunter).
 */
export function computeCanShootForSeat(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;
  return (
    results?.poisonedSeat !== seat &&
    !isCoupleDeathVictim(seat, state) &&
    !isDreamLinkedDeath(seat, state) &&
    !isWolfQueenCharmVictim(seat, state)
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
function computeConfirmStatus(role: ConfirmRole, state: NonNullState): ConfirmStatus {
  if (role === 'avenger') {
    return computeAvengerConfirmStatus(state);
  }
  if (role === 'hiddenWolf') {
    return computeHiddenWolfConfirmStatus(state);
  }

  // Hunter / DarkWolfKing
  const roleSeat = findSeatByRole(state.players, role);

  // Fail-closed: if the role seat is not found, canShoot = false (abnormal state should not trigger the skill)
  if (roleSeat === null) {
    return { role, canShoot: false };
  }

  return { role, canShoot: computeCanShootForSeat(roleSeat, state) };
}

/**
 * Compute Avenger confirm status.
 *
 * avengerFaction is computed directly by the shadow resolver during mimicry and stored in currentNightResults.
 * Just read it here; no need to re-derive. No target selected (blocked / not in template) -> default to good faction.
 */
function computeAvengerConfirmStatus(state: NonNullState): ConfirmStatus {
  return {
    role: 'avenger',
    faction: state.currentNightResults?.avengerFaction ?? Team.Good,
  };
}

/**
 * Compute HiddenWolf confirm status.
 *
 * Iterate over all seats and find those with faction === Faction.Wolf that are not the HiddenWolf itself.
 */
function computeHiddenWolfConfirmStatus(state: NonNullState): WolfTeammatesConfirmStatus {
  const wolfTeammates: number[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (!player?.role) continue;
    const spec = ROLE_SPECS[player.role];
    if (spec.faction === Faction.Wolf && player.role !== 'hiddenWolf') {
      wolfTeammates.push(Number.parseInt(seatStr, 10));
    }
  }
  return { role: 'hiddenWolf', wolfTeammates };
}

// =============================================================================
// Abnormal night-death checks (conditions where canShoot = false)
// =============================================================================

/**
 * Determine whether a seat will die at night (wolf-killed and not saved / poisoned).
 *
 * Used only as a sub-condition for chain-death checks.
 * Called during hunterConfirm / darkWolfKingConfirm steps (after wolf/witch have acted).
 */
function willDieTonight(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;

  // Poisoned
  if (results?.poisonedSeat === seat) return true;

  // Wolf-killed and not saved by witch
  const wolfKillTarget = state.witchContext?.killedSeat;
  if (wolfKillTarget !== undefined && wolfKillTarget >= 0 && wolfKillTarget === seat) {
    if (results?.savedSeat === seat) return false;
    return true;
  }

  return false;
}

/**
 * Determine whether the seat will die due to lover suicide.
 *
 * Checks whether the seat is one of the lovers and whether the partner will die at night.
 */
function isCoupleDeathVictim(seat: number, state: NonNullState): boolean {
  const loverSeats = state.loverSeats;
  if (!loverSeats || !loverSeats.includes(seat)) return false;

  const partnerSeat = loverSeats[0] === seat ? loverSeats[1] : loverSeats[0];
  return willDieTonight(partnerSeat, state);
}

/**
 * Determine whether the seat will die due to the dreamcatcher chain.
 *
 * Condition: the seat is the dream target (dreamingSeat) and the dreamcatcher will die that night.
 */
function isDreamLinkedDeath(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;
  if (results?.dreamingSeat !== seat) return false;

  const dreamcatcherSeat = findSeatByRole(state.players, 'dreamcatcher');
  if (dreamcatcherSeat === null) return false;

  return willDieTonight(dreamcatcherSeat, state);
}

/**
 * Determine whether the seat will die due to the Eclipse Wolf Queen charm chain.
 *
 * Condition: the seat is the charm target (charmedSeat) and the Eclipse Wolf Queen will die that night.
 */
function isWolfQueenCharmVictim(seat: number, state: NonNullState): boolean {
  const results = state.currentNightResults;
  if (results?.charmedSeat !== seat) return false;

  const wolfQueenSeat = findSeatByRole(state.players, 'wolfQueen');
  if (wolfQueenSeat === null) return false;

  return willDieTonight(wolfQueenSeat, state);
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
  state: NonNullState,
): SetConfirmStatusAction | null {
  const role = CONFIRM_STEP_ROLE[nextStepId];
  if (!role) {
    return null;
  }

  // Check whether the role is in the template
  if (!state.templateRoles.includes(role)) {
    return null;
  }

  return {
    type: 'SET_CONFIRM_STATUS',
    payload: computeConfirmStatus(role, state),
  };
}
