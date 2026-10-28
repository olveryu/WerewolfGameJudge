/**
 * Step Transition Handler - night step progression and resolution handler (Host-only)
 *
 * Responsibilities:
 * - ADVANCE_NIGHT: progress to the next step after audio ends
 * - END_NIGHT: run death settlement after night ends
 *
 * Returns authoritative StateAction lists, including the Host audio queue; does not perform IO
 * (network / audio playback / Alert), does not
 * mutate state directly (returned StateAction list is applied by the reducer),
 * does not manually advance index (`++` fallback strategy is forbidden).
 *
 * @remarks 4-gate validation order: (1) status=Ongoing (2) isAudioPlaying=false (3) isHost
 *   (4) a live night step exists. Any failure returns handlerError.
 *   Manual step arithmetic is forbidden; only progress via ADVANCE_TO_NEXT_ACTION action.
 *   death calculation is only executed on END_NIGHT (computed by the DeathCalculator pure function).
 *
 * Gate validation → stepTransitionGuards.ts
 * Death resolution helpers → deathResolution.ts
 * UI hint calculation → uiHint.ts
 */

import { type AudioEffect, NIGHT_END_AUDIO_KEY } from '../../../../platform/audio';
import { createSeededRng } from '../../../../platform/random';
import { resolveSeerAudioKey } from '../audioKeyOverride';
import { createAudioQueueActions } from '../audioQueue';
import type { AdvanceNightIntent, EndNightIntent } from '../intents/types';
import { type SchemaId } from '../models';
import { buildNightPlan, getStepSpec, NIGHT_STEP_ORDER } from '../models/roles/spec';
import { resolveCurrentNightStep } from '../nightStep';
import type {
  AdvanceToNextActionAction,
  EndNightAction,
  FinalizeSeedWolfInfectionAction,
  StateAction,
} from '../reducer/types';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import { calculateNightDeaths, resolveSeedWolfInfectionResult } from './deathResolution';
import { buildRevealPayload } from './revealPayload';
import { validateNightFlowPreconditions } from './stepTransitionGuards';
import type { HandlerContext, HandlerExecutionContext, HandlerResult } from './types';
import { handlerError, handlerSuccess } from './types';
import { maybeCreateUiHintAction } from './uiHint';
import { maybeCreateWitchContextAction } from './witchContext';
import {
  getLegacyWolfKillTarget,
  maybeCreateResolvedWolfKillTargetAction,
  resolveWolfKillTargetFromVotes,
} from './wolfKillResolution';

// =============================================================================
// ADVANCE_NIGHT Handler
// =============================================================================

/**
 * Advance night to the next step
 *
 * Gate:
 * 1. host_only
 * 2. invalid_status
 * 3. forbidden_while_audio_playing
 *
 * Logic:
 * - Advance from the current night step to the next
 * - Compute the next stepId
 * - Return ADVANCE_TO_NEXT_ACTION action
 */
export function handleAdvanceNight(
  _intent: AdvanceNightIntent,
  context: HandlerContext,
  execution: HandlerExecutionContext,
): HandlerResult {
  const validation = validateNightFlowPreconditions(context);
  if (!validation.valid) {
    return validation.result;
  }

  const { state } = validation;
  const current = resolveCurrentNightStep(state);
  if (!current) {
    return handlerError('invalid_step');
  }

  // Use buildNightPlan's filtered steps instead of the full NIGHT_STEPS.
  // This ensures that in the 2-player template (only wolf + villager) there are no further steps after wolfKill.
  const nightPlan = buildNightPlan(state.templateRoles, state.seerLabelMap);

  // The next plan step, or the exhausted position when the plan is done.
  const nextStep = nightPlan.steps[current.index + 1] ?? null;
  const nextStepId: SchemaId | null = nextStep?.stepId ?? null;

  const advanceAction: AdvanceToNextActionAction = {
    type: 'ADVANCE_TO_NEXT_ACTION',
    payload: {
      nightStep: nextStep ? { kind: 'inStep', stepId: nextStep.stepId } : { kind: 'exhausted' },
    },
  };

  // Collect all actions to return
  const actions: StateAction[] = [advanceAction];

  if (nextStepId === 'seedWolfInfectReveal') {
    actions.push(...createSeedWolfFinalizationActions(state));
  }

  // Single wolf-kill settlement for this night. Once the advance moves
  // past the wolfKill step (or the night ends), the wolf votes are
  // final, so settle them exactly once here and persist the target;
  // every later consumer in this command and in later commands reuses
  // the local / stored value instead of rolling a tied vote again.
  // The witch entry below is the one case where the settlement and
  // the context are created in the same command: the context is
  // computed from the stored value when it exists, otherwise from a
  // fresh resolution whose result is persisted here as the same
  // target, so the two can never disagree.
  const wolfVoteRng = createSeededRng(`${execution.randomSeed}:wolf-vote`);
  const pastWolfKill =
    nextStepId === null ||
    NIGHT_STEP_ORDER.indexOf(nextStepId) > NIGHT_STEP_ORDER.indexOf('wolfKill');
  let settledWolfKillTarget = state.resolvedWolfKillTarget;
  if (pastWolfKill && settledWolfKillTarget === undefined) {
    const resolvedAction = maybeCreateResolvedWolfKillTargetAction(state, wolfVoteRng);
    if (resolvedAction) {
      actions.push(resolvedAction);
      settledWolfKillTarget = resolvedAction.payload.target;
    }
  }

  // Unified entry: if about to enter witchAction, set witchContext
  // Guard: nextStepId must exist (undefined at night end — should not set witchContext)
  // The settlement above always runs before a witch entry: witchAction
  // sits after wolfKill in NIGHT_STEP_ORDER, so pastWolfKill is true
  // here and the block above already persisted the target (to null
  // on a no-wolf board, where there are no votes to settle). The
  // context therefore always reads the stored value; there is no
  // second SET to emit after it. A night that opens directly on
  // witchAction is handled by START_NIGHT, not by this advance.
  const witchContextAction = nextStepId
    ? maybeCreateWitchContextAction(
        nextStepId,
        settledWolfKillTarget !== undefined
          ? { ...state, resolvedWolfKillTarget: settledWolfKillTarget }
          : state,
        wolfVoteRng,
      )
    : null;
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // Unified entry: if about to enter hunterConfirm / darkWolfKingConfirm, set confirmStatus
  const wolfKillTarget =
    nextStepId === 'seedWolfInfect'
      ? settledWolfKillTarget === null
        ? undefined
        : settledWolfKillTarget
      : undefined;
  const confirmStatusAction = nextStepId
    ? maybeCreateConfirmStatusAction(nextStepId, state, wolfKillTarget)
    : null;
  if (confirmStatusAction) {
    actions.push(confirmStatusAction);
  }

  // ==========================================================================
  // UI Hint: driven by Host broadcast, UI is read-only display
  // ==========================================================================
  // When advancing to the next step, check whether a UI hint needs to be set.
  // - If the next step's actor is blocked by nightmare, set blocked_by_nightmare hint
  // - If the next step is wolfVote and wolfKillOverride exists, set wolf_kill_disabled hint
  // - Otherwise clear hint (null)
  const uiHintAction = maybeCreateUiHintAction(nextStep, state);
  actions.push(uiHintAction);

  // Audio playback: current step's end audio + next step's start audio.
  const currentStepId = current.stepId;
  const audioEffects: AudioEffect[] = [];

  // 1) Current step's end audio
  if (currentStepId) {
    const currentStep = getStepSpec(currentStepId);
    if (currentStep) {
      const audioEndKey = currentStep.audioEndKey ?? currentStep.audioKey;
      audioEffects.push({
        audioKey: resolveSeerAudioKey(audioEndKey, state.seerLabelMap),
        isEndAudio: true, // mark as end audio, routed to the audio_end directory
      });
    }
  }

  // 2) Next step's start audio (if there is a next step)
  if (nextStepId) {
    const nextStepSpec = getStepSpec(nextStepId);
    if (nextStepSpec) {
      audioEffects.push({
        audioKey: resolveSeerAudioKey(nextStepSpec.audioKey, state.seerLabelMap),
        isEndAudio: false, // start audio, routed to the normal directory
      });
    }
  }

  if (audioEffects.length > 0) {
    actions.push(...createAudioQueueActions(audioEffects));
  }
  return handlerSuccess(actions);
}

function createSeedWolfFinalizationActions(state: HandlerContext['state']): StateAction[] {
  const result = resolveSeedWolfInfectionResult(state);
  const finalizeAction: FinalizeSeedWolfInfectionAction = {
    type: 'FINALIZE_SEED_WOLF_INFECTION',
    payload: { result },
  };
  const deferredReveal = state.seedWolfDeferredReveal;
  if (result.outcome !== 'failed' || !deferredReveal) return [finalizeAction];

  const revealPayload = buildRevealPayload(
    { valid: true, reveal: deferredReveal.reveal },
    deferredReveal.schemaId,
    deferredReveal.targetSeat,
  );
  return [
    finalizeAction,
    {
      type: 'APPLY_RESOLVER_RESULT',
      payload: { sourceSeat: deferredReveal.actorSeat, ...revealPayload },
    },
    { type: 'ADD_REVEAL_ACK', payload: { ackKey: deferredReveal.schemaId } },
  ];
}

// =============================================================================
// END_NIGHT Handler
// =============================================================================

/**
 * End the night and run death settlement
 *
 * Gate:
 * 1. host_only
 * 2. invalid_status
 * 3. forbidden_while_audio_playing
 * 4. night_not_complete (nightStep must be exhausted - all steps must be finished)
 *
 * Logic:
 * - Reuse the settled wolf-kill target (stored, or the legacy
 *   fallback for pre-field rooms); only when neither exists is the
 *   target settled fresh here, and that settlement is persisted in
 *   this same command so the night review reads the same target.
 * - Build NightActions from actions
 * - Call calculateDeaths to compute deaths
 * - Return END_NIGHT action
 */
export function handleEndNight(
  _intent: EndNightIntent,
  context: HandlerContext,
  execution: HandlerExecutionContext,
): HandlerResult {
  const validation = validateNightFlowPreconditions(context);
  if (!validation.valid) {
    return validation.result;
  }

  const { state } = validation;

  // Gate 5 (END_NIGHT specific): night_not_complete
  // The night step must be exhausted, indicating all steps are complete.
  // Calling endNight mid-night is a severe architectural violation and must fail-fast
  if (state.nightStep?.kind !== 'exhausted') {
    return handlerError('night_not_complete');
  }

  const legacyTarget = getLegacyWolfKillTarget(state);
  const settledTarget =
    legacyTarget !== undefined
      ? legacyTarget
      : resolveWolfKillTargetFromVotes(state, createSeededRng(`${execution.randomSeed}:wolf-vote`));
  const { deaths, deathReasons } = calculateNightDeaths(state, settledTarget);

  const endNightAction: EndNightAction = {
    type: 'END_NIGHT',
    payload: { deaths, deathReasons },
  };

  const actions: StateAction[] = [];
  if (state.resolvedWolfKillTarget === undefined) {
    actions.push({
      type: 'SET_RESOLVED_WOLF_KILL_TARGET',
      payload: { target: settledTarget },
    });
  }
  actions.push(endNightAction);
  actions.push(...createAudioQueueActions([{ audioKey: NIGHT_END_AUDIO_KEY }]));

  return handlerSuccess(actions);
}
