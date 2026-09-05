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
 *   (4) currentStepIndex !== -1. Any failure returns handlerError.
 *   Manual currentStepIndex++ is forbidden; only progress via ADVANCE_TO_NEXT_ACTION action.
 *   death calculation is only executed on END_NIGHT (computed by the DeathCalculator pure function).
 *
 * Gate validation → stepTransitionGuards.ts
 * Death resolution helpers → deathResolution.ts
 * UI hint calculation → uiHint.ts
 */

import { createSeededRng } from '../../../../platform/random';
import { resolveSeerAudioKey } from '../audioKeyOverride';
import { createAudioQueueActions } from '../audioQueue';
import type { AdvanceNightIntent, EndNightIntent } from '../intents/types';
import { type SchemaId } from '../models';
import { buildNightPlan, getStepSpec } from '../models/roles/spec';
import type { AudioEffect } from '../protocol/types';
import type {
  AdvanceToNextActionAction,
  EndNightAction,
  FinalizeSeedWolfInfectionAction,
  StateAction,
} from '../reducer/types';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import {
  buildNightActions,
  calculateNightDeaths,
  resolveSeedWolfInfectionResult,
} from './deathResolution';
import { buildRevealPayload } from './revealPayload';
import { validateNightFlowPreconditions } from './stepTransitionGuards';
import type { HandlerContext, HandlerExecutionContext, HandlerResult } from './types';
import { handlerError, handlerSuccess } from './types';
import { maybeCreateUiHintAction } from './uiHint';
import { maybeCreateWitchContextAction } from './witchContext';

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
 * - Advance from current currentStepIndex to the next
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
  const currentIndex = state.currentStepIndex;

  // Compute next index
  const nextIndex = currentIndex + 1;

  // Use buildNightPlan's filtered steps instead of the full NIGHT_STEPS.
  // This ensures that in the 2-player template (only wolf + villager) there are no further steps after wolfKill.
  const nightPlan = buildNightPlan(state.templateRoles, state.seerLabelMap);

  // Compute next stepId (null if out of range, indicating night end)
  const nextStep = nightPlan.steps[nextIndex] ?? null;
  const nextStepId: SchemaId | null = nextStep?.stepId ?? null;

  const advanceAction: AdvanceToNextActionAction = {
    type: 'ADVANCE_TO_NEXT_ACTION',
    payload: {
      nextStepIndex: nextIndex,
      nextStepId,
    },
  };

  // Collect all actions to return
  const actions: StateAction[] = [advanceAction];

  if (nextStepId === 'seedWolfInfectReveal') {
    actions.push(...createSeedWolfFinalizationActions(state));
  }

  // Unified entry: if about to enter witchAction, set witchContext
  // Guard: nextStepId must exist (undefined at night end — should not set witchContext)
  const witchContextAction = nextStepId
    ? maybeCreateWitchContextAction(
        nextStepId,
        state,
        createSeededRng(`${execution.randomSeed}:wolf-vote`),
      )
    : null;
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // Unified entry: if about to enter hunterConfirm / darkWolfKingConfirm, set confirmStatus
  const wolfVoteRng = createSeededRng(`${execution.randomSeed}:wolf-vote`);
  const wolfKillTarget =
    nextStepId === 'seedWolfInfect'
      ? buildNightActions(state, { kind: 'votes', rng: wolfVoteRng }).wolfKill
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
  const currentStepId = state.currentStepId;
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
 * 4. night_not_complete (currentStepId must be undefined - all steps must be finished)
 *
 * Logic:
 * - Call resolveWolfVotes on wolfVotes to derive wolfKill
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
  // currentStepId must be undefined, indicating all steps are complete (after advanceNight sets nextStepId to null)
  // Calling endNight mid-night is a severe architectural violation and must fail-fast
  if (state.currentStepId !== undefined) {
    return handlerError('night_not_complete');
  }

  const { deaths, deathReasons } = calculateNightDeaths(
    state,
    createSeededRng(`${execution.randomSeed}:wolf-vote`),
  );

  const endNightAction: EndNightAction = {
    type: 'END_NIGHT',
    payload: { deaths, deathReasons },
  };

  return handlerSuccess([endNightAction, ...createAudioQueueActions([{ audioKey: 'night_end' }])]);
}
