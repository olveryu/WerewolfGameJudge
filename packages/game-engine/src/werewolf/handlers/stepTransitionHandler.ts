/**
 * Step Transition Handler - night step progression and resolution handler (Host-only)
 *
 * Responsibilities:
 * - ADVANCE_NIGHT: progress to the next step after audio ends
 * - END_NIGHT: run death settlement after night ends
 * - SET_AUDIO_PLAYING: set the audio playback gate state
 *
 * Returns StateAction list and SideEffect (PLAY_AUDIO); does not perform IO
 * (network / audio playback / Alert — audio IO is executed by Facade), does not
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

import { resolveSeerAudioKey } from '../../utils/audioKeyOverride';
import { getEngineLogger } from '../../utils/logger';
import { calculateDeathsDetailed } from '../DeathCalculator';
import type { AdvanceNightIntent, EndNightIntent, SetAudioPlayingIntent } from '../intents/types';
import { type SchemaId } from '../models';
import { buildNightPlan, getStepSpec } from '../models/roles/spec';
import { Team } from '../models/roles/spec/types';
import type {
  AdvanceToNextActionAction,
  EndNightAction,
  SetAudioPlayingAction,
  StateAction,
} from '../reducer/types';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import {
  buildCheckedSeats,
  buildEffectiveRoleSeatMap,
  buildNightActions,
  buildReflectionSources,
  buildRoleSeatMap,
} from './deathResolution';
import {
  validateNightFlowPreconditions,
  validateSetAudioPlayingPreconditions,
} from './stepTransitionGuards';
import type { HandlerContext, HandlerResult, SideEffect } from './types';
import { handlerError, handlerSuccess } from './types';
import { maybeCreateUiHintAction } from './uiHint';
import { maybeCreateWitchContextAction } from './witchContext';

const nightFlowLog = getEngineLogger().extend('NightFlow');

// =============================================================================
// ADVANCE_NIGHT Handler
// =============================================================================

/**
 * Advance night to the next step
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status
 * 4. forbidden_while_audio_playing
 *
 * Logic:
 * - Advance from current currentStepIndex to the next
 * - Compute the next stepId
 * - Return ADVANCE_TO_NEXT_ACTION action
 */
export function handleAdvanceNight(
  _intent: AdvanceNightIntent,
  context: HandlerContext,
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

  // Unified entry: if about to enter witchAction, set witchContext
  // Guard: nextStepId must exist (undefined at night end — should not set witchContext)
  const witchContextAction = nextStepId ? maybeCreateWitchContextAction(nextStepId, state) : null;
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // Unified entry: if about to enter hunterConfirm / darkWolfKingConfirm, set confirmStatus
  const confirmStatusAction = nextStepId ? maybeCreateConfirmStatusAction(nextStepId, state) : null;
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

  // Audio playback: current step's end audio + next step's start audio
  // Append to sideEffects in order; Facade plays them in sequence
  const currentStepId = state.currentStepId;
  const sideEffects: SideEffect[] = [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }];

  // 1) Current step's end audio
  if (currentStepId) {
    const currentStep = getStepSpec(currentStepId);
    if (currentStep) {
      const audioEndKey = currentStep.audioEndKey ?? currentStep.audioKey;
      sideEffects.push({
        type: 'PLAY_AUDIO',
        audioKey: resolveSeerAudioKey(audioEndKey, state.seerLabelMap),
        isEndAudio: true, // mark as end audio, routed to the audio_end directory
      });
    }
  }

  // 2) Next step's start audio (if there is a next step)
  if (nextStepId) {
    const nextStepSpec = getStepSpec(nextStepId);
    if (nextStepSpec) {
      sideEffects.push({
        type: 'PLAY_AUDIO',
        audioKey: resolveSeerAudioKey(nextStepSpec.audioKey, state.seerLabelMap),
        isEndAudio: false, // start audio, routed to the normal directory
      });
    }
  }

  return handlerSuccess(actions, sideEffects);
}

// =============================================================================
// END_NIGHT Handler
// =============================================================================

/**
 * End the night and run death settlement
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status
 * 4. forbidden_while_audio_playing
 * 5. night_not_complete (currentStepId must be undefined - all steps must be finished)
 *
 * Logic:
 * - Call resolveWolfVotes on wolfVotes to derive wolfKill
 * - Build NightActions from actions
 * - Call calculateDeaths to compute deaths
 * - Return END_NIGHT action
 */
export function handleEndNight(_intent: EndNightIntent, context: HandlerContext): HandlerResult {
  const validation = validateNightFlowPreconditions(context);
  if (!validation.valid) {
    return validation.result;
  }

  const { state } = validation;

  // Gate 5 (END_NIGHT specific): night_not_complete
  // currentStepId must be undefined, indicating all steps are complete (after advanceNight sets nextStepId to null)
  // Calling endNight mid-night is a severe architectural violation and must fail-fast
  if (state.currentStepId !== undefined) {
    nightFlowLog.error('handleEndNight: night_not_complete - currentStepId is still set', {
      currentStepId: state.currentStepId,
    });
    return handlerError('night_not_complete');
  }

  // Build NightActions
  const nightActions = buildNightActions(state);

  // Build effective role → seat mapping (shared with buildRoleSeatMap + buildReflectionSources)
  const effectiveMap = buildEffectiveRoleSeatMap(state);

  // Build reflection sources (scanned from spec.deathCalcRole + ProtocolAction)
  const reflectionSources = buildReflectionSources(effectiveMap, state.actions, nightActions);

  // Build the set of seats checked tonight (used for check-induced death determination)
  const checkedSeats = buildCheckedSeats(effectiveMap, state.actions, nightActions);

  // Build RoleSeatMap (driven by deathCalcRole)
  const isBonded = state.currentNightResults?.avengerFaction === Team.Third;
  const coupleLinkSeats = state.loverSeats ?? null;
  const roleSeatMap = buildRoleSeatMap(
    effectiveMap,
    reflectionSources,
    isBonded,
    coupleLinkSeats,
    checkedSeats,
  );

  // DEBUG: log death calculation inputs
  nightFlowLog.debug('handleEndNight: calculating deaths', {
    wolfVotes: state.currentNightResults?.wolfVotesBySeat,
    wolfKillOverride: !!state.wolfKillOverride,
    nightActions,
    roleSeatMap,
  });

  // Call DeathCalculator (reuse, do not reimplement)
  const { deaths, deathReasons } = calculateDeathsDetailed(nightActions, roleSeatMap);

  // DEBUG: log death calculation results
  nightFlowLog.debug('handleEndNight: deaths calculated', { deaths, deathReasons });

  const endNightAction: EndNightAction = {
    type: 'END_NIGHT',
    payload: { deaths, deathReasons },
  };

  return handlerSuccess(
    [endNightAction],
    [
      { type: 'BROADCAST_STATE' },
      { type: 'SAVE_STATE' },
      // P0-1: return the night-end audio playback side effect
      { type: 'PLAY_AUDIO', audioKey: 'night_end' },
    ],
  );
}

// =============================================================================
// SET_AUDIO_PLAYING Handler
// =============================================================================

/**
 * Set the audio playback state
 *
 * Audio sequencing control
 *
 * Gate:
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing or ended)
 *
 * Logic:
 * - Set isAudioPlaying = payload.isPlaying
 * - Broadcast state
 */
export function handleSetAudioPlaying(
  intent: SetAudioPlayingIntent,
  context: HandlerContext,
): HandlerResult {
  const validation = validateSetAudioPlayingPreconditions(context);
  if (!validation.valid) {
    return validation.result;
  }

  const setAudioAction: SetAudioPlayingAction = {
    type: 'SET_AUDIO_PLAYING',
    payload: { isPlaying: intent.payload.isPlaying },
  };

  return handlerSuccess([setAudioAction], [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }]);
}
