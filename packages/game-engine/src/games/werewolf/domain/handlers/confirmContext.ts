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
 * - Single source of truth: confirmStatus lives only in GameState.confirmStatus
 * - Pure function: no IO, no external reads, no state writes
 * - Symmetric with witchContext.ts: step-entry context, ready before the step begins
 *
 * @remarks Exact canShoot conditions:
 *   canShoot = true only when the cause of death is wolfKill or exile (daytime exile vote).
 *   The following causes cannot shoot: poison (witch/poisoner), couple (lover suicide), dream (dreamcatcher chain), charm (eclipse wolf queen charm).
 *   Check order: witchContext.killedSeat -> coupleDeathVictim -> dreamLinkedDeath -> wolfQueenCharm.
 *   deriveConfirmStepRoleMap() builds a static mapping from ROLE_SPECS at module load time.
 */

import { type RoleId, type SchemaId } from '../models/roles/spec';
import { getAllRoleIds, getRoleSpec } from '../models/roles/spec/specs';
import { Faction } from '../models/roles/spec/types';
import { isVacantBottomCardStep, resolveNightStepActor } from '../playerHelpers';
import type { ConfirmStatus, GameState, WolfTeammatesConfirmStatus } from '../protocol/types';
import type { SetConfirmStatusAction } from '../reducer/types';

type ConfirmRole = 'hunter' | 'darkWolfKing' | 'avenger' | 'hiddenWolf';

function isConfirmRole(roleId: RoleId): roleId is ConfirmRole {
  return (
    roleId === 'hunter' ||
    roleId === 'darkWolfKing' ||
    roleId === 'avenger' ||
    roleId === 'hiddenWolf'
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
function computeConfirmStatus(role: ConfirmRole, state: GameState): ConfirmStatus {
  if (role === 'avenger') {
    return computeAvengerConfirmStatus(state);
  }
  if (role === 'hiddenWolf') {
    return computeHiddenWolfConfirmStatus(state);
  }

  // Hunter / DarkWolfKing
  const roleActor = resolveNightStepActor(state, role);

  if (roleActor === null) {
    throw new Error(`[FAIL-FAST] ${role} confirm step has no assigned role seat`);
  }

  return { role, canShoot: computeCanShootForSeat(roleActor.seat, state) };
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

// =============================================================================
// Abnormal night-death checks (conditions where canShoot = false)
// =============================================================================

/**
 * Determine whether a seat will die at night (wolf-killed and not saved / poisoned).
 *
 * Used only as a sub-condition for chain-death checks.
 * Called during hunterConfirm / darkWolfKingConfirm steps (after wolf/witch have acted).
 */
function willDieTonight(seat: number, state: GameState): boolean {
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
function isCoupleDeathVictim(seat: number, state: GameState): boolean {
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
function isDreamLinkedDeath(seat: number, state: GameState): boolean {
  const results = state.currentNightResults;
  if (results?.dreamingSeat !== seat) return false;

  const dreamcatcherActor = resolveNightStepActor(state, 'dreamcatcher');
  if (dreamcatcherActor === null) return false;

  return willDieTonight(dreamcatcherActor.seat, state);
}

/**
 * Determine whether the seat will die due to the Eclipse Wolf Queen charm chain.
 *
 * Condition: the seat is the charm target (charmedSeat) and the Eclipse Wolf Queen will die that night.
 */
function isWolfQueenCharmVictim(seat: number, state: GameState): boolean {
  const results = state.currentNightResults;
  if (results?.charmedSeat !== seat) return false;

  const wolfQueenActor = resolveNightStepActor(state, 'wolfQueen');
  if (wolfQueenActor === null) return false;

  return willDieTonight(wolfQueenActor.seat, state);
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
    payload: computeConfirmStatus(role, state),
  };
}
