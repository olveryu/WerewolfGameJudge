/** Production-command Night-1 scenario runner for Werewolf board tests. */

import {
  doesRoleParticipateInWolfVote,
  GameStatus,
  getSchema,
  type RoleId,
  type SchemaId,
  type WerewolfActionInput,
} from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext, TestCommandExecution } from './gameContext';

const MAX_NIGHT_TRANSITIONS = 64;

type ActionValue =
  | number
  | null
  | { readonly save: number | null; readonly poison: number | null }
  | { readonly targets: readonly number[] }
  | { readonly confirmed: boolean }
  | { readonly cardIndex: number };

type CustomActions = Partial<Record<RoleId, ActionValue>>;

interface StepByStepResult {
  readonly deaths: number[];
  readonly completed: boolean;
}

export function submitActionOrThrow(
  ctx: GameContext,
  actorSeat: number,
  input: WerewolfActionInput,
  context: string | { readonly stepId?: SchemaId },
  execution?: TestCommandExecution,
): void {
  const contextText =
    typeof context === 'string' ? context : `step "${context.stepId ?? 'unknown'}"`;
  ctx.dispatchAsSeatOrThrow(
    actorSeat,
    { type: 'werewolf.action.submit', input },
    contextText,
    execution,
  );
}

function acknowledgeAudio(ctx: GameContext, context: string): boolean {
  if (!ctx.getGameState().isAudioPlaying) return false;
  ctx.acknowledgePendingAudioOrThrow(context);
  return true;
}

function acknowledgeReveal(ctx: GameContext): boolean {
  const state = ctx.getGameState();
  if (state.pendingRevealAcks.length === 0) return false;
  const stepId = state.currentStepId;
  if (stepId === undefined) {
    throw new Error('[FAIL-FAST] Reveal acknowledgement exists without a current step');
  }
  const action = [...state.actions].reverse().find((candidate) => candidate.schemaId === stepId);
  if (action === undefined) {
    throw new Error(`[FAIL-FAST] Reveal acknowledgement has no action for ${stepId}`);
  }
  ctx.dispatchAsSeatOrThrow(
    action.actorSeat,
    { type: 'werewolf.reveal.ack' },
    `acknowledge reveal for ${stepId}`,
  );
  return true;
}

function acknowledgeWolfRobotHunterStatus(ctx: GameContext): boolean {
  const state = ctx.getGameState();
  if (
    state.currentStepId !== 'wolfRobotLearn' ||
    state.wolfRobotHunterStatusViewed !== false ||
    state.wolfRobotReveal?.learnedRoleId === undefined
  ) {
    return false;
  }
  const actorSeat = ctx.findSeatByRole('wolfRobot');
  if (actorSeat === -1) {
    throw new Error('[FAIL-FAST] Wolf Robot gate exists without a seated Wolf Robot');
  }
  ctx.dispatchAsSeatOrThrow(
    actorSeat,
    { type: 'werewolf.wolfRobot.ackHunterStatus' },
    'acknowledge Wolf Robot hunter status',
  );
  return true;
}

function acknowledgeGroupConfirmation(ctx: GameContext): boolean {
  const state = ctx.getGameState();
  const stepId = state.currentStepId;
  if (stepId === undefined || getSchema(stepId).kind !== 'groupConfirm') return false;

  for (const player of Object.values(state.players)) {
    if (player === null) continue;
    ctx.dispatchAsSeatOrThrow(
      player.seat,
      { type: 'werewolf.groupConfirm.ack' },
      `acknowledge group confirmation for ${stepId} at seat ${player.seat}`,
    );
  }
  return true;
}

function releaseStepDeadline(ctx: GameContext): boolean {
  const deadline = ctx.getGameState().stepDeadline;
  if (deadline === undefined) return false;
  ctx.dispatchOrThrow(
    { type: 'werewolf.progress.request' },
    `release step deadline at ${deadline}`,
    undefined,
    { nowMs: deadline },
  );
  return true;
}

function settleCompletedStep(ctx: GameContext): boolean {
  return (
    acknowledgeAudio(ctx, 'complete authoritative playback') ||
    acknowledgeReveal(ctx) ||
    acknowledgeWolfRobotHunterStatus(ctx) ||
    acknowledgeGroupConfirmation(ctx) ||
    releaseStepDeadline(ctx)
  );
}

export function executeStepsUntil(
  ctx: GameContext,
  targetStepId: SchemaId,
  customActions: CustomActions = {},
): boolean {
  for (let transition = 0; transition < MAX_NIGHT_TRANSITIONS; transition += 1) {
    acknowledgeAudio(ctx, `complete playback before ${targetStepId}`);
    const state = ctx.getGameState();
    if (state.currentStepId === targetStepId) return true;
    if (state.status === GameStatus.Ended || state.currentStepId === undefined) return false;
    if (settleCompletedStep(ctx)) continue;
    executeCurrentStep(ctx, customActions);
  }
  throw new Error(
    `[FAIL-FAST] executeStepsUntil exceeded ${MAX_NIGHT_TRANSITIONS} transitions before ${targetStepId}`,
  );
}

export function executeRemainingSteps(
  ctx: GameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  for (let transition = 0; transition < MAX_NIGHT_TRANSITIONS; transition += 1) {
    if (settleCompletedStep(ctx)) continue;

    const state = ctx.getGameState();
    if (state.status === GameStatus.Ended) {
      return { deaths: state.lastNightDeaths ?? [], completed: true };
    }
    if (state.status !== GameStatus.Ongoing) {
      throw new Error(`[FAIL-FAST] Night runner received lifecycle ${state.status}`);
    }
    if (state.currentStepId === undefined) {
      ctx.dispatchOrThrow({ type: 'werewolf.progress.request' }, 'finish Night-1');
      continue;
    }
    executeCurrentStep(ctx, customActions);
  }
  throw new Error(`[FAIL-FAST] Night runner exceeded ${MAX_NIGHT_TRANSITIONS} transitions`);
}

export function executeFullNight(
  ctx: GameContext,
  customActions: CustomActions = {},
): StepByStepResult {
  return executeRemainingSteps(ctx, customActions);
}

function executeCurrentStep(ctx: GameContext, customActions: CustomActions): void {
  const state = ctx.getGameState();
  const currentStepId = state.currentStepId;
  if (currentStepId === undefined) {
    throw new Error('[FAIL-FAST] Cannot execute an action without a current step');
  }
  const step = ctx.getNightPlan().steps.find((candidate) => candidate.stepId === currentStepId);
  if (step === undefined) {
    throw new Error(`[FAIL-FAST] Night plan does not contain current step ${currentStepId}`);
  }

  let actorSeat = ctx.findSeatByRole(step.roleId);
  if (actorSeat === -1) {
    if (
      state.currentNightResults?.treasureMasterChosenCard === step.roleId &&
      state.treasureMasterSeat !== undefined
    ) {
      actorSeat = state.treasureMasterSeat;
    } else if (
      state.currentNightResults?.thiefChosenCard === step.roleId &&
      state.thiefSeat !== undefined
    ) {
      actorSeat = state.thiefSeat;
    } else if (state.stepDeadline !== undefined) {
      releaseStepDeadline(ctx);
      return;
    } else {
      throw new Error(`[FAIL-FAST] Current step ${currentStepId} has no effective actor`);
    }
  }

  submitActionForStep(ctx, currentStepId, step.roleId, actorSeat, customActions[step.roleId]);
}

function submitActionForStep(
  ctx: GameContext,
  stepId: SchemaId,
  roleId: RoleId,
  actorSeat: number,
  value: ActionValue | undefined,
): void {
  if (stepId === 'wolfKill') {
    submitWolfVotes(ctx, stepId, value);
    return;
  }
  if (stepId === 'witchAction') {
    submitWitchAction(ctx, stepId, actorSeat, value);
    return;
  }
  if (stepId === 'magicianSwap') {
    submitMultiTargetAction(ctx, stepId, actorSeat, value);
    return;
  }
  if (stepId === 'piperHypnotize') {
    submitPiperAction(ctx, stepId, actorSeat, value);
    return;
  }
  if (stepId === 'cupidChooseLovers') {
    submitCupidAction(ctx, stepId, actorSeat, value);
    return;
  }
  if (stepId === 'treasureMasterChoose' || stepId === 'thiefChoose') {
    if (value === null || typeof value !== 'object' || !('cardIndex' in value)) {
      throw new Error(`[FAIL-FAST] ${stepId} fixture must provide cardIndex`);
    }
    submitActionOrThrow(ctx, actorSeat, { kind: 'card', cardIndex: value.cardIndex }, { stepId });
    return;
  }
  if (
    stepId === 'hunterConfirm' ||
    stepId === 'darkWolfKingConfirm' ||
    stepId === 'avengerConfirm'
  ) {
    const shouldConfirm =
      value === null || typeof value !== 'object' || !('confirmed' in value) || value.confirmed;
    submitActionOrThrow(ctx, actorSeat, shouldConfirm ? { kind: 'confirm' } : { kind: 'skip' }, {
      stepId,
    });
    return;
  }

  const target = typeof value === 'number' ? value : null;
  submitActionOrThrow(
    ctx,
    actorSeat,
    target === null ? { kind: 'skip' } : { kind: 'target', target },
    `${stepId} (${roleId})`,
  );
}

function submitWolfVotes(ctx: GameContext, stepId: SchemaId, value: ActionValue | undefined): void {
  const target = typeof value === 'number' ? value : null;
  const wolfSeats = Object.values(ctx.getGameState().players)
    .filter((player) => player?.role && doesRoleParticipateInWolfVote(player.role))
    .map((player) => player!.seat);
  if (wolfSeats.length === 0) {
    throw new Error('[FAIL-FAST] wolfKill step has no participating wolf');
  }
  for (const seat of wolfSeats) {
    submitActionOrThrow(
      ctx,
      seat,
      target === null ? { kind: 'skip' } : { kind: 'target', target },
      { stepId },
    );
  }
}

function submitWitchAction(
  ctx: GameContext,
  stepId: SchemaId,
  actorSeat: number,
  value: ActionValue | undefined,
): void {
  if (typeof value === 'number') {
    submitActionOrThrow(
      ctx,
      actorSeat,
      { kind: 'witch', saveTarget: value, poisonTarget: null },
      { stepId },
    );
    return;
  }
  if (value !== null && typeof value === 'object' && 'save' in value) {
    const input: WerewolfActionInput =
      value.save === null && value.poison === null
        ? { kind: 'skip' }
        : { kind: 'witch', saveTarget: value.save, poisonTarget: value.poison };
    submitActionOrThrow(ctx, actorSeat, input, { stepId });
    return;
  }
  submitActionOrThrow(ctx, actorSeat, { kind: 'skip' }, { stepId });
}

function submitMultiTargetAction(
  ctx: GameContext,
  stepId: SchemaId,
  actorSeat: number,
  value: ActionValue | undefined,
): void {
  const targets =
    value !== null && typeof value === 'object' && 'targets' in value ? value.targets : [];
  submitActionOrThrow(
    ctx,
    actorSeat,
    targets.length === 0 ? { kind: 'skip' } : { kind: 'multiTarget', targets },
    { stepId },
  );
}

function submitPiperAction(
  ctx: GameContext,
  stepId: SchemaId,
  actorSeat: number,
  value: ActionValue | undefined,
): void {
  const configuredTargets =
    value !== null && typeof value === 'object' && 'targets' in value
      ? value.targets
      : typeof value === 'number'
        ? [value]
        : undefined;
  const targets =
    configuredTargets ??
    Object.values(ctx.getGameState().players)
      .filter((player) => player !== null && player.seat !== actorSeat)
      .slice(0, 1)
      .map((player) => player!.seat);
  submitActionOrThrow(
    ctx,
    actorSeat,
    targets.length === 0 ? { kind: 'skip' } : { kind: 'multiTarget', targets },
    { stepId },
  );
}

function submitCupidAction(
  ctx: GameContext,
  stepId: SchemaId,
  actorSeat: number,
  value: ActionValue | undefined,
): void {
  const targets =
    value !== null && typeof value === 'object' && 'targets' in value
      ? value.targets
      : Object.values(ctx.getGameState().players)
          .filter((player) => player !== null)
          .slice(0, 2)
          .map((player) => player.seat);
  submitActionOrThrow(ctx, actorSeat, { kind: 'multiTarget', targets }, { stepId });
}
