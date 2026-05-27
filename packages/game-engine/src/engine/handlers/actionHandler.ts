/**
 * Action Handler — dispatch shell for night action submission.
 *
 * Validates preconditions (via actionGuards), builds resolver context,
 * dispatches to the matching resolver, and assembles the StateAction list.
 * Does not contain IO (network / audio / alert); does not directly mutate state.
 *
 * Reveal payload construction lives in revealPayload.ts.
 * Gate predicates live in actionGuards.ts.
 * VIEWED_ROLE handling lives in viewedRoleHandler.ts.
 */

import { ROLE_SPECS, type RoleId, type SchemaId, SCHEMAS, Team } from '../../models';
import type { ProtocolAction } from '../../protocol/types';
import { RESOLVERS } from '../../resolvers';
import type { ActionInput, ResolverContext, ResolverResult } from '../../resolvers/types';
import { newRejectionId } from '../../utils/id';
import { buildSeatRoleMap } from '../../utils/playerHelpers';
import type { SubmitActionIntent } from '../intents/types';
import { gameReducer } from '../reducer/gameReducer';
import type { ActionRejectedAction, RecordActionAction, StateAction } from '../reducer/types';
import {
  checkNightmareBlockGuard,
  isBottomCardActorOverride,
  validateActionPreconditions,
} from './actionGuards';
import { computeCanShootForSeat } from './confirmContext';
import { decideWolfVoteTimerAction, isWolfVoteAllComplete } from './progressionEvaluator';
import { buildRevealPayload } from './revealPayload';
import type { HandlerContext, HandlerResult, NonNullState } from './types';
import { handlerRejection, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';

// Re-export moved symbols for backward compatibility
export { checkNightmareBlockGuard, isSkipAction } from './actionGuards';
export { isBottomCardActorOverride } from './actionGuards';
export { handleViewedRole } from './viewedRoleHandler';

/**
 * Build resolver context
 */
function buildResolverContext(
  state: NonNullState,
  actorSeat: number,
  actorRoleId: RoleId,
): ResolverContext {
  // Build players: seat -> role
  const players = buildSeatRoleMap(state.players);

  // FAIL-FAST: currentNightResults must exist when status === GameStatus.Ongoing
  if (!state.currentNightResults) {
    throw new Error('[FAIL-FAST] currentNightResults missing in ongoing state');
  }

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: state.currentNightResults,
    wolfRobotContext: state.wolfRobotContext,
    witchState: state.witchContext,
    gameState: {
      isNight1: true, // Night-1 only
      hypnotizedSeats: state.hypnotizedSeats ?? [],
    },
    ...(state.bottomCards && (state.treasureMasterSeat != null || state.thiefSeat != null)
      ? {
          bottomCardContext: {
            bottomCards: state.bottomCards,
            actorSeat: state.treasureMasterSeat ?? state.thiefSeat!,
          },
        }
      : {}),
  };
}

/**
 * Build ActionInput
 */
function buildActionInput(
  schemaId: SchemaId,
  target: number | null,
  extra?: Record<string, unknown>,
): ActionInput {
  return {
    schemaId,
    target: target ?? undefined,
    confirmed: extra?.confirmed as boolean | undefined,
    targets: extra?.targets as readonly number[] | undefined,
    stepResults: extra?.stepResults as Record<string, number | null> | undefined,
    cardIndex: extra?.cardIndex as number | undefined,
  };
}

function getActionTimestamp(extra?: Record<string, unknown>): number {
  const maybe = extra?.timestamp;
  return typeof maybe === 'number' ? maybe : Date.now();
}

/**
 * Eclipse Wolf Queen shelter redirect — redirects a god-role's skill target from the sheltered player to the actor
 *
 * Rewrites all target fields in ActionInput before the resolver is called.
 * Since buildSuccessResult uses the same effectiveTarget,
 * ProtocolAction.targetSeat stays consistent with the resolver result.
 */
function applyShelterRedirect(
  input: ActionInput,
  actorSeat: number,
  actorRoleId: RoleId,
  shelteredSeat: number | undefined,
): ActionInput {
  if (shelteredSeat === undefined) return input;

  const spec = ROLE_SPECS[actorRoleId];
  if (spec.team !== Team.Good) return input;

  const redirect = (seat: number | undefined): number | undefined =>
    seat === shelteredSeat ? actorSeat : seat;

  const redirectNullable = (seat: number | null): number | null =>
    seat === shelteredSeat ? actorSeat : seat;

  const redirected =
    redirect(input.target) !== input.target ||
    input.targets?.some((t) => t === shelteredSeat) ||
    (input.stepResults && Object.values(input.stepResults).some((v) => v === shelteredSeat));

  return {
    ...input,
    target: redirect(input.target),
    targets: input.targets?.map((t) => (t === shelteredSeat ? actorSeat : t)),
    stepResults: input.stepResults
      ? Object.fromEntries(
          Object.entries(input.stepResults).map(([k, v]) => [k, redirectNullable(v)]),
        )
      : undefined,
    ...(redirected ? { shelterRedirected: true } : {}),
  };
}

/**
 * Handle submit action (PR4: SUBMIT_ACTION)
 *
 * Resolver-first: all business validation is handled by the resolver
 * Rejections are also broadcast: prevents the UI from getting stuck in a pending state
 */
export function handleSubmitAction(
  intent: SubmitActionIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat, role, target, extra } = intent.payload;

  // Validate preconditions (full gate chain)
  const validation = validateActionPreconditions(context.state, seat, role);
  if (!validation.valid) {
    return (validation as { valid: false; result: HandlerResult }).result;
  }
  const { schemaId, state, schema } = validation;

  // Build ActionInput (built first, used by nightmare guard and resolver)
  let actionInput = buildActionInput(
    schemaId,
    target,
    extra as Record<string, unknown> | undefined,
  );

  // Eclipse Wolf Queen shelter redirect (applied before nightmare guard and resolver)
  const shelteredSeat = state.currentNightResults?.shelteredSeat;
  actionInput = applyShelterRedirect(actionInput, seat, role, shelteredSeat);
  const effectiveTarget = actionInput.target ?? null;

  // Nightmare block guard (single-point guard, schema-aware)
  const blockRejectReason = checkNightmareBlockGuard(
    seat,
    schema,
    actionInput,
    state.currentNightResults?.blockedSeat,
  );
  if (blockRejectReason) {
    return buildRejectionResult(schemaId, blockRejectReason, state, seat);
  }

  // Get resolver
  const resolver = RESOLVERS[schemaId]!;

  // Bottom card actor override: when acting on the chosen card's step,
  // use the chosen card's role for the resolver context
  let resolverRole = role;
  if (role === ('treasureMaster' as RoleId) && isBottomCardActorOverride(state, schemaId)) {
    resolverRole = state.treasureMasterChosenCard as RoleId;
  } else if (role === ('thief' as RoleId) && isBottomCardActorOverride(state, schemaId)) {
    resolverRole = state.thiefChosenCard as RoleId;
  }

  // Build context
  const resolverContext = buildResolverContext(state, seat, resolverRole);

  // Call resolver (resolver-first)
  let result = resolver(resolverContext, actionInput);

  if (!result.valid) {
    return buildRejectionResult(schemaId, result.rejectReason, state, seat);
  }

  // When wolfRobot learns hunter, the resolver only flags canShootAsHunter=true (without full death cause info);
  // authoritative override using the full GameState here (shares logic with confirmContext for hunter/wolfKing).
  if (result.result?.canShootAsHunter !== undefined) {
    result = {
      ...result,
      result: { ...result.result, canShootAsHunter: computeCanShootForSeat(seat, state) },
    };
  }

  // Build success result
  const handlerResult = buildSuccessResult(
    schemaId,
    seat,
    effectiveTarget,
    role,
    result,
    extra as Record<string, unknown> | undefined,
  );

  // Wolf vote timer: manages stepDeadline after a wolfVote step is submitted
  if (schema.kind === 'wolfVote' && handlerResult.kind === 'success') {
    // Temporarily reduce all actions to get the latest vote state
    let tempState = state;
    for (const action of handlerResult.actions) {
      tempState = gameReducer(tempState, action);
    }
    const allVoted = isWolfVoteAllComplete(tempState);
    const hasExistingTimer = tempState.stepDeadline != null;
    const timerAction = decideWolfVoteTimerAction(allVoted, hasExistingTimer, Date.now());

    const extraActions: StateAction[] = [];
    if (timerAction.type === 'set') {
      extraActions.push({
        type: 'SET_STEP_DEADLINE' as const,
        payload: { deadline: timerAction.deadline },
      });
    } else if (timerAction.type === 'clear') {
      extraActions.push({ type: 'CLEAR_STEP_DEADLINE' as const });
    }
    if (extraActions.length > 0) {
      return handlerSuccess([...handlerResult.actions, ...extraActions], handlerResult.sideEffects);
    }
  }

  return handlerResult;
}

/**
 * Build rejection result
 */
function buildRejectionResult(
  schemaId: SchemaId,
  rejectReason: string | undefined,
  state: NonNullState,
  seat: number,
): HandlerResult {
  const rejectAction: ActionRejectedAction = {
    type: 'ACTION_REJECTED',
    payload: {
      action: schemaId,
      reason: rejectReason ?? 'invalid_action',
      targetUserId:
        state.players[seat]?.userId ??
        (() => {
          throw new Error(`[FAIL-FAST] ACTION_REJECTED: no player at seat ${seat}`);
        })(),
      rejectionId: newRejectionId(),
    },
  };

  return handlerRejection(
    rejectReason ?? 'invalid_action',
    [rejectAction],
    [{ type: 'BROADCAST_STATE' }],
  );
}

/**
 * Build success result
 */
function buildSuccessResult(
  schemaId: SchemaId,
  seat: number,
  target: number | null,
  role: RoleId,
  result: ResolverResult,
  extra?: Record<string, unknown>,
): HandlerResult {
  const protocolAction: ProtocolAction = {
    schemaId,
    actorSeat: seat,
    targetSeat: target ?? undefined,
    timestamp: getActionTimestamp(extra),
  };

  const recordAction: RecordActionAction = {
    type: 'RECORD_ACTION',
    payload: { action: protocolAction },
  };

  const actions: StateAction[] = [recordAction];

  // Only attach reveal payload when we have a concrete target.
  // (Avoid fabricating seat=0 when target is null.)
  if (target !== null && (result.updates || result.result)) {
    const revealPayload = buildRevealPayload(result, schemaId, target);
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: revealPayload,
    });

    // If the schema defines revealKind and the reveal payload contains actual data, add a pending ack to block progression
    // ackKey uses schemaId as the stable identifier (avoids breakage if revealKind text changes)
    // Condition checks whether the payload has reveal data (shadow only has reveal when mimicking avenger)
    const schema = SCHEMAS[schemaId];
    const revealKind = (schema?.ui as { revealKind?: string } | undefined)?.revealKind;
    if (revealKind) {
      const revealKey = `${revealKind}Reveal`;
      const hasRevealData =
        revealKey in revealPayload &&
        revealPayload[revealKey as keyof typeof revealPayload] != null;
      if (hasRevealData) {
        actions.push({
          type: 'ADD_REVEAL_ACK',
          payload: { ackKey: schemaId },
        });
      }
    }
  } else if (result.updates) {
    // Updates can exist without a target (e.g. skip/blocked); keep them.
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: { updates: result.updates },
    });
  }

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
}
