/**
 * Inline Progression — server-side inline progression (pure function)
 *
 * Responsibilities:
 * - After action processing completes, evaluate and execute night progression (advance / endNight) within the same request
 * - Collect PLAY_AUDIO sideEffects produced during progression -> AudioEffect[]
 * - All StateActions accumulate in order, reduced uniformly by the outer caller
 *
 * Design:
 * - Pure function, no IO (DB / network / audio)
 * - Uses evaluateNightProgression (server always has permission)
 * - Recursively advances until decision=none (equivalent to client handleNightProgression)
 * - At most MAX_PROGRESSION_LOOPS iterations to prevent infinite loops
 *
 * Reads state, invokes handler pure functions and returns actions/effects;
 * contains no IO, side effects, or time dependency (Date.now is passed in by caller).
 */

import { GameStatus, type SchemaId, SCHEMAS } from '../models';
import { getStepSpec } from '../models/roles/spec/nightSteps';
import type { AudioEffect, GameState } from '../protocol/types';
import { getEngineLogger } from '../utils/logger';
import { randomIntInclusive } from '../utils/random';
import { isWolfVoteAllComplete } from './handlers/progressionEvaluator';
import { handleAdvanceNight, handleEndNight } from './handlers/stepTransitionHandler';
import type { HandlerContext, SideEffect } from './handlers/types';
import { gameReducer } from './reducer/gameReducer';
import type { StateAction } from './reducer/types';

const log = getEngineLogger().extend('InlineProgression');

/** Random delay range for vacant bottom card step (ms) */
export const AUTO_SKIP_DELAY_MIN_MS = 5000;
export const AUTO_SKIP_DELAY_MAX_MS = 10000;

/** Max progression loop iterations (prevents infinite loops) */
const MAX_PROGRESSION_LOOPS = 20;

/**
 * Inline progression result
 */
interface InlineProgressionResult {
  /** All StateActions accumulated during progression (excluding the trigger action itself) */
  actions: StateAction[];
  /** Pending audio collected during progression (in playback order) */
  audioEffects: AudioEffect[];
  /** Final state after applying all actions (may differ from input) */
  finalState: GameState;
  /** Number of steps advanced (0 = no progression); each ADVANCE_NIGHT or END_NIGHT counts as 1 */
  stepsAdvanced: number;
}

/**
 * Check whether the current step is complete (equivalent to progressionEvaluator.isCurrentStepComplete)
 *
 * Inlined here to avoid exporting a private function.
 */
function isStepComplete(state: GameState): boolean {
  const stepId = state.currentStepId;
  if (!stepId) return true; // No current step -> complete (enter endNight)

  if (stepId === 'wolfKill') {
    return isWolfVoteAllComplete(state);
  }

  // groupConfirm steps: complete when all seated players have acked.
  const schema = SCHEMAS[stepId as SchemaId];
  if (schema?.kind === 'groupConfirm') {
    const acks =
      stepId === 'awakenedGargoyleConvertReveal'
        ? (state.conversionRevealAcks ?? [])
        : stepId === 'cupidLoversReveal'
          ? (state.cupidLoversRevealAcks ?? [])
          : (state.piperRevealAcks ?? []);
    // All seated (non-null) players must ack
    const seatedCount = Object.values(state.players).filter((p) => p !== null).length;
    return acks.length >= seatedCount;
  }

  const actions = state.actions;
  return actions.some((a) => a.schemaId === stepId);
}

/**
 * Check if the current step belongs to an unchosen bottom card role.
 *
 * When treasureMaster/thief picks a card, the unchosen bottom card roles' steps
 * have no player operating them → auto-advance immediately after audio.
 */
function isUnchosenBottomCardStep(state: GameState): boolean {
  const { currentStepId, bottomCardStepRoles } = state;
  // Determine the chosen card (either treasureMaster or thief)
  const chosenCard = state.treasureMasterChosenCard ?? state.thiefChosenCard;
  if (!currentStepId || !bottomCardStepRoles || !chosenCard) return false;

  const step = getStepSpec(currentStepId);
  if (!step) return false;

  // Not a bottom card role → not applicable
  if (!bottomCardStepRoles.includes(step.roleId)) return false;

  // This IS the chosen card's step → the bottom card role holder will act, don't skip
  if (step.roleId === chosenCard) return false;

  // Role also exists as a player (e.g. wolf in bottom + wolf players) → don't skip
  const hasPlayerWithRole = Object.values(state.players).some((p) => p?.role === step.roleId);
  if (hasPlayerWithRole) return false;

  return true;
}

/**
 * Server-side inline progression decision evaluation
 *
 * Equivalent to evaluateNightProgression, except:
 * - Does not use ProgressionTracker (server is stateless)
 * - Accepts nowMs for stepDeadline checks
 */
function evaluateProgression(state: GameState, nowMs: number): 'advance' | 'end_night' | 'none' {
  if (state.status !== GameStatus.Ongoing) return 'none';
  if (state.isAudioPlaying) return 'none';
  if (state.pendingRevealAcks && state.pendingRevealAcks.length > 0) return 'none';

  if (state.currentStepId === undefined) return 'end_night';

  if (isStepComplete(state)) {
    // Unified deadline gate: step complete but deadline not yet reached → wait
    if (state.stepDeadline != null && nowMs < state.stepDeadline) {
      return 'none';
    }
    return 'advance';
  }

  // Auto-skip: unchosen bottom card role steps advance after random delay
  if (isUnchosenBottomCardStep(state)) {
    // No deadline set yet → signal 'none' so runInlineProgression can set it
    if (state.stepDeadline == null) return 'none';
    // Deadline not yet reached → wait
    if (nowMs < state.stepDeadline) return 'none';
    // Deadline passed → advance
    return 'advance';
  }

  return 'none';
}

/**
 * Extract AudioEffect[] from sideEffects
 */
function extractAudioEffects(sideEffects: readonly SideEffect[] | undefined): AudioEffect[] {
  if (!sideEffects) return [];
  return sideEffects
    .filter(
      (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
        e.type === 'PLAY_AUDIO',
    )
    .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));
}

/**
 * Server-side inline progression (pure function)
 *
 * After action processing completes, evaluate and execute the progression chain within the same request:
 * action complete -> evaluate -> advance -> evaluate -> ... -> none/end_night
 *
 * @pre state.status === 'Ongoing'
 * @remarks MAX_PROGRESSION_LOOPS=20 circuit-breaker protection. Recursively advances until evaluateProgression returns 'none'.
 *   auto-skip delay: vacant bottom card step sets stepDeadline = now + random(5000, 10000)ms,
 *   set only when no pending audio (avoids audio duration overlapping with deadline window).
 *
 * @param state - state after action processing
 * @param hostUserId - Host UID (used to build HandlerContext)
 * @param nowMs - current timestamp (used for stepDeadline check, defaults to Date.now())
 * @returns progression result (actions + audioEffects + finalState)
 */
export function runInlineProgression(
  state: GameState,
  hostUserId: string,
  nowMs: number = Date.now(),
): InlineProgressionResult {
  const allActions: StateAction[] = [];
  const allAudioEffects: AudioEffect[] = [];
  let currentState = state;
  let stepsAdvanced = 0;

  for (let i = 0; i < MAX_PROGRESSION_LOOPS; i++) {
    const decision = evaluateProgression(currentState, nowMs);

    if (decision === 'none') break;

    const ctx: HandlerContext = {
      state: currentState,
      myUserId: hostUserId,
      mySeat: null, // server-side doesn't need mySeat
    };

    if (decision === 'advance') {
      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, ctx);
      if (result.kind === 'error') {
        log.warn('Inline advance failed', { reason: result.reason });
        break;
      }

      // Apply actions to get new state
      for (const action of result.actions) {
        currentState = gameReducer(currentState, action);
      }
      allActions.push(...result.actions);
      allAudioEffects.push(...extractAudioEffects(result.sideEffects));
      stepsAdvanced++;

      // Continue loop to evaluate next step
      continue;
    }

    if (decision === 'end_night') {
      const result = handleEndNight({ type: 'END_NIGHT' }, ctx);
      if (result.kind === 'error') {
        log.warn('Inline endNight failed', { reason: result.reason });
        break;
      }

      for (const action of result.actions) {
        currentState = gameReducer(currentState, action);
      }
      allActions.push(...result.actions);
      allAudioEffects.push(...extractAudioEffects(result.sideEffects));
      stepsAdvanced++;

      // end_night terminates progression
      break;
    }
  }

  // Set stepDeadline if we stopped at a vacant bottom card step without one.
  // Only when there are NO pending audio effects — if audio is about to play,
  // defer deadline to the audio-ack's inline progression so the random delay
  // starts AFTER audio finishes (avoids server clock race where audio duration
  // overlaps with the deadline window).
  if (
    isUnchosenBottomCardStep(currentState) &&
    currentState.stepDeadline == null &&
    allAudioEffects.length === 0
  ) {
    const deadline = nowMs + randomIntInclusive(AUTO_SKIP_DELAY_MIN_MS, AUTO_SKIP_DELAY_MAX_MS);
    const setDeadlineAction: StateAction = {
      type: 'SET_STEP_DEADLINE',
      payload: { deadline },
    };
    currentState = gameReducer(currentState, setDeadlineAction);
    allActions.push(setDeadlineAction);
    log.info('Set stepDeadline for vacant bottom card step', {
      stepId: currentState.currentStepId,
      deadline,
    });
  }

  // If there are audio effects, add SET_PENDING_AUDIO_EFFECTS + SET_AUDIO_PLAYING actions
  if (allAudioEffects.length > 0) {
    const setEffectsAction: StateAction = {
      type: 'SET_PENDING_AUDIO_EFFECTS',
      payload: { effects: allAudioEffects },
    };
    const setAudioPlayingAction: StateAction = {
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying: true },
    };
    currentState = gameReducer(currentState, setEffectsAction);
    currentState = gameReducer(currentState, setAudioPlayingAction);
    allActions.push(setEffectsAction, setAudioPlayingAction);
  }

  log.debug('runInlineProgression complete', {
    stepsAdvanced,
    audioEffects: allAudioEffects.length,
  });

  return {
    actions: allActions,
    audioEffects: allAudioEffects,
    finalState: currentState,
    stepsAdvanced,
  };
}
