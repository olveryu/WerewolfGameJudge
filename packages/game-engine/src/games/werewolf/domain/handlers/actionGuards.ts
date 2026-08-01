/**
 * Action guards — precondition validation and nightmare block check.
 *
 * Pure predicates called by handleSubmitAction before resolver dispatch.
 * Exported `isSkipAction` and `checkNightmareBlockGuard` are also consumed by tests.
 */

import {
  type ActionSchema,
  doesRoleParticipateInWolfVote,
  GameStatus,
  type RoleId,
  type SchemaId,
  SCHEMAS,
} from '../models';
import { BLOCKED_UI_DEFAULTS, getStepSpec, NIGHT_STEPS } from '../models/roles/spec';
import type { GameState } from '../protocol/types';
import type { ActionInput } from '../resolvers/types';
import type { HandlerResult } from './types';
import { handlerError } from './types';

/**
 * Check if the given step is a bottom card role's chosen card role's step.
 *
 * Used for Gate 4b override and for resolver role substitution.
 * Supports both treasureMaster and thief.
 */
export function isBottomCardActorOverride(state: GameState, stepId: SchemaId): boolean {
  const results = state.currentNightResults;
  if (results === undefined) {
    throw new Error('[FAIL-FAST] Bottom-card actor override requires currentNightResults');
  }
  // treasureMaster
  if (results.treasureMasterChosenCard) {
    const step = getStepSpec(stepId);
    if (step && step.roleId === results.treasureMasterChosenCard) return true;
  }
  // thief
  if (results.thiefChosenCard) {
    const step = getStepSpec(stepId);
    if (step && step.roleId === results.thiefChosenCard) return true;
  }
  return false;
}

/**
 * Get the corresponding SchemaId for a given role.
 */
function getSchemaIdForRole(role: RoleId): SchemaId | null {
  for (const step of NIGHT_STEPS) {
    if (step.roleId === role) {
      return step.id;
    }
  }
  return null;
}

/**
 * Validate the full action precondition chain.
 *
 * Gate order (must follow):
 * 1. invalid_status (must be ongoing)
 * 2. forbidden_while_audio_playing
 * 3. invalid_step (currentStepId must exist and match)
 * 4. not_seated (actor seat must have a player)
 * 5. schema constraints (handled by resolver)
 */
export function validateActionPreconditions(
  state: GameState,
  actorSeat: number,
  role: RoleId,
):
  | { valid: false; result: HandlerResult }
  | { valid: true; schemaId: SchemaId; state: GameState; schema: ActionSchema } {
  // Gate 1: invalid_status (must be ongoing)
  if (state.status !== GameStatus.Ongoing) {
    return {
      valid: false,
      result: handlerError('invalid_status'),
    };
  }

  // Gate 2: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      valid: false,
      result: handlerError('forbidden_while_audio_playing'),
    };
  }

  // Gate 3: invalid_step (currentStepId must exist and be found in SCHEMAS)
  const currentStepId = state.currentStepId;
  if (!currentStepId) {
    return {
      valid: false,
      result: handlerError('invalid_step'),
    };
  }

  const schema = SCHEMAS[currentStepId];
  if (!schema) {
    return {
      valid: false,
      result: handlerError('invalid_step'),
    };
  }

  // Gate 3b: step mismatch - submitted role must match the current step
  const expectedSchemaId = getSchemaIdForRole(role);
  // Special case: wolfKill is a meeting step shared by multiple wolf-team roles
  // (e.g. wolf, spiritKnight, wolfQueen...). For this step we validate participation
  // via ROLE_SPECS[*].wolfMeeting.participatesInWolfVote instead of role->schema mapping.
  if (currentStepId === 'wolfKill' && doesRoleParticipateInWolfVote(role)) {
    // ok
  } else if (
    (role === 'treasureMaster' || role === 'thief') &&
    isBottomCardActorOverride(state, currentStepId)
  ) {
    // Bottom card role acting on the chosen card's step — allowed
  } else if (expectedSchemaId !== currentStepId) {
    return {
      valid: false,
      result: handlerError('step_mismatch'),
    };
  }

  // Gate 4: not_seated (actor seat must have a player)
  const player = state.players[actorSeat];
  if (!player) {
    return {
      valid: false,
      result: handlerError('not_seated'),
    };
  }

  // Gate 4b: player role must match
  if (player.role !== role) {
    return {
      valid: false,
      result: handlerError('role_mismatch'),
    };
  }

  return { valid: true, schemaId: currentStepId, state, schema };
}

// =============================================================================
// Nightmare Block Guard (Single-point guard, schema-aware)
// =============================================================================

/**
 * Schema-aware skip detection.
 *
 * Determines whether the submission is a skip (no actual action) based on schema.kind.
 *
 * @param schema - Schema definition of the current step
 * @param actionInput - Player-submitted action input
 * @returns true for skip, false for actual action
 */
export function isSkipAction(schema: ActionSchema, actionInput: ActionInput): boolean {
  switch (schema.kind) {
    case 'confirm':
      // confirm kind: confirmed !== true is treated as skip
      return actionInput.confirmed !== true;

    case 'chooseSeat':
    case 'wolfVote':
    case 'confirmTarget':
      // chooseSeat kind: target == null is treated as skip
      return actionInput.target === undefined || actionInput.target === null;

    case 'multiChooseSeat':
      // multiChooseSeat kind: empty targets is treated as skip
      return !actionInput.targets || actionInput.targets.length === 0;

    case 'swap':
      // swap kind: empty targets is treated as skip
      return !actionInput.targets || actionInput.targets.length === 0;

    case 'compound': {
      // compound kind: empty stepResults or all-null is treated as skip
      if (!actionInput.stepResults) return true;
      const results = Object.values(actionInput.stepResults);
      // empty array is considered skip; all-null is also skip
      if (results.length === 0) return true;
      return results.every((v) => v === null);
    }

    case 'groupConfirm':
      // groupConfirm kind: confirmation step, never a skip
      return false;

    case 'chooseCard':
      // chooseCard kind: cardIndex == null is treated as skip
      return actionInput.cardIndex === undefined || actionInput.cardIndex === null;

    case 'skip':
      return true;

    default: {
      const exhaustive: never = schema;
      return exhaustive;
    }
  }
}

/**
 * Unified nightmare block validation (single-point guard, schema-aware).
 *
 * Rules (MUST follow):
 *
 * 1. Blocked by Nightmare = rules forbid input, only skip is allowed.
 *    - When blocked: only skip is valid; any non-skip action must be rejected.
 *
 * 2. confirm kind (hunter/darkWolfKing) skip rules:
 *    - When not blocked: skip not allowed (confirmed !== true is invalid -> reject)
 *    - When blocked: only skip allowed (confirmed===true is also rejected; only "skip" is valid)
 *
 * 3. Other kinds (chooseSeat/wolfVote/swap/compound):
 *    - When blocked: only skip allowed
 *    - When not blocked: no extra restrictions
 *
 * @param seat - Actor seat
 * @param schema - Schema definition of the current step
 * @param actionInput - Constructed ActionInput (includes all payload fields)
 * @param blockedSeat - Seat blocked by Nightmare
 * @returns rejectReason if rejected, undefined if allowed
 */
export function checkNightmareBlockGuard(
  seat: number,
  schema: ActionSchema,
  actionInput: ActionInput,
  blockedSeat: number | undefined,
): string | undefined {
  const isBlocked = blockedSeat === seat;
  const isSkip = isSkipAction(schema, actionInput);

  // Special rule for confirm kind: skip not allowed when not blocked
  if (schema.kind === 'confirm') {
    if (!isBlocked && isSkip) {
      return '当前无法跳过，请执行行动';
    }
    if (isBlocked && !isSkip) {
      return BLOCKED_UI_DEFAULTS.message;
    }
    return undefined;
  }

  // Other schemas: only skip allowed when blocked
  if (isBlocked && !isSkip) {
    return BLOCKED_UI_DEFAULTS.message;
  }

  return undefined;
}
