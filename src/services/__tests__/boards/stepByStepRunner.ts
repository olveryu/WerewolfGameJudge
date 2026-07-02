/**
 * Step-by-Step Night Runner
 *
 * Execute night flow step-by-step in real NightPlan order (no one-shot fast-forward)
 *
 * Hard requirements:
 * 1. Each step must: submit real PlayerMessage.ACTION -> advanceNight()
 * 2. Any gate (e.g. wolfRobotHunterStatusViewed) must be cleared by explicit test message
 * 3. Helpers must NOT auto-send any confirmation/ack messages
 * 4. Every sendPlayerMessage / advanceNight must fail-fast (throw on failure)
 * 5. The single source of advanceNightOrThrow is ctx.advanceNightOrThrow() (in gameFactory.ts)
 */

import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { doesRoleParticipateInWolfVote } from '@werewolf/game-engine/werewolf/models/roles';
import type { SchemaId } from '@werewolf/game-engine/werewolf/models/roles/spec';
import type { PlayerMessage } from '@werewolf/game-engine/werewolf/protocol/types';

import type { GameContext } from './gameContext';

// =============================================================================
// Fail-Fast Helpers (Exported for direct use in tests)
// =============================================================================

/**
 * Send PlayerMessage and fail-fast (throw on failure)
 *
 * Single fail-fast entry point for all board integration tests to send messages.
 * Do NOT reimplement similar helpers in test files or elsewhere to prevent drift.
 *
 * Hard requirements:
 * - This function does NOT auto-send any ack/gate message
 * - All gates (REVEAL_ACK / WOLF_ROBOT_HUNTER_STATUS_VIEWED) must be sent explicitly by tests
 *
 * @param ctx - GameContext
 * @param message - PlayerMessage
 * @param context - Context info (for error messages)
 * @throws if sendPlayerMessage returns success: false
 */
export function sendMessageOrThrow(
  ctx: GameContext,
  message: PlayerMessage,
  context: string | { stepId?: SchemaId | null },
): void {
  const result = ctx.sendPlayerMessage(message);
  if (!result.success) {
    let contextStr: string;
    if (typeof context === 'string') {
      contextStr = context;
    } else if (context.stepId) {
      contextStr = `step "${context.stepId}"`;
    } else {
      contextStr = 'unknown step';
    }
    throw new Error(
      `[sendMessageOrThrow] failed at ${contextStr}: ` +
        `type=${message.type}, seat=${'seat' in message ? message.seat : 'N/A'}, ` +
        `reason=${result.reason ?? 'unknown'}`,
    );
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Custom action config
 *
 * Supported value types:
 * - number: target seat
 * - null: skip attack / no action
 * - { save: number | null; poison: number | null }: witch compound action
 * - { targets: number[] }: magician swap
 * - { confirmed: boolean }: confirmation-type action
 * - { cardIndex: number }: Treasure Master card pick
 */
type ActionValue =
  | number
  | null
  | { save: number | null; poison: number | null }
  | { targets: readonly number[] }
  | { confirmed: boolean }
  | { cardIndex: number };

type CustomActions = Partial<Record<RoleId, ActionValue>>;

/**
 * Execution result
 */
interface StepByStepResult {
  /** Final deaths list */
  deaths: number[];
  /** Whether the night completed */
  completed: boolean;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Execute step-by-step in real NightPlan order until target step (skipping nothing)
 *
 * For each step:
 * 1. Submit that role's action
 * 2. advanceNight() to next step
 *
 * Any gate (e.g. pendingRevealAcks / wolfRobotHunterStatusViewed)
 *    must be cleared by explicit test message in customActions callback
 *
 * @param ctx - GameContext
 * @param targetStepId - Target step ID
 * @param customActions - Custom actions for specific roles
 * @returns Whether target step was reached
 * @throws if advanceNight fails
 */
export function executeStepsUntil(
  ctx: GameContext,
  targetStepId: SchemaId,
  customActions: CustomActions = {},
): boolean {
  const MAX_ITERATIONS = 30;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const state = ctx.getGameState();
    const currentStepId = state.currentStepId;
    if (!currentStepId) return false;

    // Target reached
    if (currentStepId === targetStepId) {
      return true;
    }

    // Execute current step
    executeCurrentStep(ctx, customActions);

    // Advance to next step (use ctx.advanceNightOrThrow - single source)
    ctx.advanceNightOrThrow(`executeStepsUntil step "${currentStepId}"`);
  }

  return false;
}

/**
 * Continue from current step to end of Night-1
 *
 * Semantics: continue step-by-step from current `WerewolfState.currentStepId` until Night-1 ends.
 * Supports calling `executeStepsUntil` to a step first, then invoking this to finish the rest.
 *
 * Hard requirements (MUST follow):
 * - This function does NOT auto-send any ack/gate message
 * - Any gate (e.g. pendingRevealAcks / wolfRobotHunterStatusViewed)
 *   must be cleared by explicit test message
 * - Throws (fail-fast) when blocked by a gate; does NOT auto-handle
 *
 * @param ctx - GameContext
 * @param customActions - Custom actions for specific roles
 * @returns Execution result (deaths list + completion flag)
 * @throws if advanceNight fails (including gate blockage)
 * @throws if state.status !== Ongoing while currentStepId exists (inconsistent state)
 */
export function executeRemainingSteps(
  ctx: GameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  const MAX_ITERATIONS = 30;

  // Fail-fast check: state must be valid (read-only check, does not mutate state)
  const initialState = ctx.getGameState();
  if (initialState.currentStepId && initialState.status !== GameStatus.Ongoing) {
    throw new Error(
      `[executeRemainingSteps] Invalid state: currentStepId="${initialState.currentStepId}" ` +
        `but status="${initialState.status}" (expected "ongoing"). ` +
        `Night flow may have been corrupted.`,
    );
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const state = ctx.getGameState();
    const currentStepId = state.currentStepId;

    // Night already ended (currentStepId empty)
    if (!currentStepId) {
      // Trigger death settlement
      const result = ctx.endNight();
      return {
        deaths: result.deaths,
        completed: true,
      };
    }

    // Check whether already ended
    if (state.status === GameStatus.Ended) {
      return {
        deaths: state.lastNightDeaths ?? [],
        completed: true,
      };
    }

    // Execute current step
    executeCurrentStep(ctx, customActions);

    // Advance to next step (use ctx.advanceNightOrThrow - single source)
    ctx.advanceNightOrThrow(`executeRemainingSteps step "${currentStepId}"`);
  }

  // Exceeded max iterations, trigger end
  const result = ctx.endNight();
  return {
    deaths: result.deaths,
    completed: true,
  };
}

/**
 * Execute the full Night-1 flow (test-intent alias)
 *
 * This is a thin wrapper around `executeRemainingSteps` to improve test readability.
 *
 * Hard guardrails (MUST follow):
 * - This function does **NOT** start night or reset state
 * - This function does **NOT** auto-handle any ack/gate, including:
 *   - pendingRevealAcks (test must send REVEAL_ACK explicitly)
 *   - wolfRobotHunterStatusViewed (test must send WOLF_ROBOT_HUNTER_STATUS_VIEWED explicitly)
 * - Gates must be cleared by explicit test message
 * - Throws (fail-fast) when blocked by a gate; does NOT auto-handle
 *
 * Do NOT add to this function:
 * - Auto-sending REVEAL_ACK / WOLF_ROBOT_HUNTER_STATUS_VIEWED
 * - Auto-clearing any gate
 * - Auto skip step / fast-forward / jump
 * - Any "auto-handle when encountering a gate" logic
 *
 * @param ctx - GameContext
 * @param customActions - Custom actions for specific roles
 * @returns Execution result (deaths list + completion flag)
 * @throws if advanceNight fails (including gate blockage)
 */
export function executeFullNight(
  ctx: GameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  // Thin wrapper: only call executeRemainingSteps, do NOT add any extra logic
  return executeRemainingSteps(ctx, customActions);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Execute the current step (without advancing)
 *
 * Only submits the action for the current step.
 *
 * Any gate (e.g. pendingRevealAcks / wolfRobotHunterStatusViewed)
 *    must be cleared by explicit test message in customActions callback
 */
function executeCurrentStep(ctx: GameContext, customActions: CustomActions): void {
  const plan = ctx.getNightPlan();
  const state = ctx.getGameState();
  const currentStepId = state.currentStepId;
  if (!currentStepId) return;

  // Find the config for the current step
  const stepConfig = plan.steps.find((s) => s.stepId === currentStepId);
  if (!stepConfig) return;

  const roleId = stepConfig.roleId;
  let actorSeat = ctx.findSeatByRole(roleId);
  let actorRole: RoleId = roleId;

  // TreasureMaster actor override: the chosen deck card role's step is performed by Treasure Master
  if (actorSeat === -1) {
    const state2 = ctx.getGameState();
    if (state2.treasureMasterChosenCard === roleId && state2.treasureMasterSeat != null) {
      actorSeat = state2.treasureMasterSeat;
      actorRole = 'treasureMaster'; // Gate 4b/5b requires sending the actual seat's role
    } else if (state2.thiefChosenCard === roleId && state2.thiefSeat != null) {
      actorSeat = state2.thiefSeat;
      actorRole = 'thief';
    } else {
      // Role not in template, skip (advanceNight will be called by caller)
      return;
    }
  }

  // Get custom action
  const actionValue = customActions[roleId];

  // Submit action based on step type
  submitActionForStep(ctx, currentStepId, actorRole, actorSeat, actionValue);

  // Note: reveal ack / wolfRobot hunter gate and other confirmation messages
  // must be sent explicitly by the test in customActions; not auto-sent here
}

/**
 * Submit the corresponding action based on step type
 */
function submitActionForStep(
  ctx: GameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  if (stepId === 'treasureMasterChoose' || stepId === 'thiefChoose') {
    submitChooseCardAction(ctx, stepId, roleId, actorSeat, actionValue);
  } else if (stepId === 'wolfKill') {
    submitWolfKillAction(ctx, stepId, actorSeat, actionValue);
  } else if (stepId === 'witchAction') {
    submitWitchAction(ctx, stepId, actorSeat, actionValue);
  } else if (stepId === 'magicianSwap') {
    submitMagicianSwapAction(ctx, stepId, actorSeat, actionValue);
  } else if (
    stepId === 'hunterConfirm' ||
    stepId === 'darkWolfKingConfirm' ||
    stepId === 'avengerConfirm'
  ) {
    submitConfirmAction(ctx, stepId, roleId, actorSeat, actionValue);
  } else if (stepId === 'piperHypnotize') {
    submitPiperHypnotizeAction(ctx, stepId, roleId, actorSeat, actionValue);
  } else if (stepId === 'cupidChooseLovers') {
    submitCupidChooseLoversAction(ctx, stepId, roleId, actorSeat, actionValue);
  } else if (stepId === 'piperHypnotizedReveal') {
    // groupConfirm: auto-completes after audio, no action submission needed
    return;
  } else if (stepId === 'awakenedGargoyleConvertReveal') {
    // groupConfirm: auto-completes after audio, no action submission needed
    return;
  } else if (stepId === 'cupidLoversReveal') {
    // groupConfirm: auto-completes after audio, no action submission needed
    return;
  } else {
    // Normal action (seer, guard, nightmare, etc.)
    submitNormalAction(ctx, stepId, roleId, actorSeat, actionValue);
  }
}

/**
 * Submit Treasure Master card pick action
 */
function submitChooseCardAction(
  ctx: GameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  const cardIndex =
    actionValue != null && typeof actionValue === 'object' && 'cardIndex' in actionValue
      ? actionValue.cardIndex
      : null;

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: roleId,
      target: null,
      extra: cardIndex != null ? { cardIndex } : undefined,
    },
    { stepId },
  );
}

/**
 * Submit attack action
 */
function submitWolfKillAction(
  ctx: GameContext,
  stepId: SchemaId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  const target = typeof actionValue === 'number' ? actionValue : null;
  const state = ctx.getGameState();

  // All wolves participating in attack vote (fail-fast)
  // Note: only roles with participatesInWolfVote=true send WOLF_VOTE
  if (target !== null) {
    for (const [seatStr, player] of Object.entries(state.players)) {
      const seat = Number.parseInt(seatStr, 10);
      const role = player?.role;
      if (role && doesRoleParticipateInWolfVote(role)) {
        sendMessageOrThrow(
          ctx,
          {
            type: 'WOLF_VOTE',
            seat,
            target,
          },
          { stepId },
        );
      }
    }
  }

  // Find lead wolf seat (first wolf participating in attack)
  let leadWolfSeat = actorSeat;
  let leadWolfRole: RoleId = 'wolf';
  for (const [seatStr, player] of Object.entries(state.players)) {
    const seat = Number.parseInt(seatStr, 10);
    const role = player?.role;
    // Only roles with participatesInWolfVote=true can be lead wolf
    if (role && doesRoleParticipateInWolfVote(role)) {
      leadWolfSeat = seat;
      leadWolfRole = role;
      break;
    }
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: leadWolfSeat,
      role: leadWolfRole,
      target,
      extra: undefined,
    },
    { stepId },
  );
}

/**
 * Submit witch action
 */
function submitWitchAction(
  ctx: GameContext,
  stepId: SchemaId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  let stepResults = { save: null as number | null, poison: null as number | null };

  if (actionValue && typeof actionValue === 'object' && 'save' in actionValue) {
    stepResults = actionValue;
  } else if (typeof actionValue === 'number') {
    // A single number means save
    stepResults = { save: actionValue, poison: null };
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: 'witch',
      target: null,
      extra: { stepResults },
    },
    { stepId },
  );
}

/**
 * Submit magician swap action
 */
function submitMagicianSwapAction(
  ctx: GameContext,
  stepId: SchemaId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  let targets: readonly number[] = [];

  if (actionValue && typeof actionValue === 'object' && 'targets' in actionValue) {
    targets = actionValue.targets;
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: 'magician',
      target: null,
      extra: targets.length > 0 ? { targets } : undefined,
    },
    { stepId },
  );
}

/**
 * Submit confirmation-type action
 *
 * Defaults confirmed = true (normal confirm passes)
 * Tests that need to skip (confirmed: false) must specify explicitly
 */
function submitConfirmAction(
  ctx: GameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  // Default true: under normal conditions, confirm step requires confirmed: true
  let confirmed = true;

  if (actionValue && typeof actionValue === 'object' && 'confirmed' in actionValue) {
    confirmed = actionValue.confirmed;
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: roleId,
      target: null,
      extra: { confirmed },
    },
    { stepId },
  );
}

/**
 * Submit Piper hypnotize action (multiChooseSeat)
 */
function submitPiperHypnotizeAction(
  ctx: GameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  let targets: readonly number[];
  if (actionValue && typeof actionValue === 'object' && 'targets' in actionValue) {
    targets = actionValue.targets;
  } else if (typeof actionValue === 'number') {
    targets = [actionValue];
  } else {
    // Default: hypnotize seat 0 (test convenience — pick any valid seat)
    targets = [0];
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: roleId,
      target: null,
      extra: { targets },
    },
    { stepId },
  );
}

/**
 * Submit Cupid choose-lovers action (multiChooseSeat, 2 targets)
 */
function submitCupidChooseLoversAction(
  ctx: GameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  let targets: readonly number[];
  if (actionValue && typeof actionValue === 'object' && 'targets' in actionValue) {
    targets = actionValue.targets;
  } else {
    // Default: connect seats 0 and 1 (test convenience)
    targets = [0, 1];
  }

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: roleId,
      target: null,
      extra: { targets },
    },
    { stepId },
  );
}

/**
 * Submit normal action
 */
function submitNormalAction(
  ctx: GameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  actionValue: ActionValue | undefined,
): void {
  const target = typeof actionValue === 'number' ? actionValue : null;

  sendMessageOrThrow(
    ctx,
    {
      type: 'ACTION',
      seat: actorSeat,
      role: roleId,
      target,
      extra: undefined,
    },
    { stepId },
  );
}

// handleRevealAck / handleWolfRobotHunterGate have been removed
// All confirmation messages must be sent explicitly by tests in customActions callback
