/**
 * handlers/night — Night-phase handlers (action, audio-ack, audio-gate, etc.)
 *
 * All night-specific route handlers. Each function is a `HandlerFn` that parses the
 * request body, validates parameters, delegates to the game-engine handler via
 * `processGameAction`, and returns a JSON response.
 * Does not define routes or call `Deno.serve`.
 */

import { jsonResponse } from '../../_shared/cors.ts';
import {
  type AudioEffect,
  decideWolfVoteTimerAction,
  type EndNightIntent,
  gameReducer,
  type GameState,
  GameStatus,
  handleEndNight,
  handleSetAudioPlaying,
  handleSetWolfRobotHunterStatusViewed,
  handleSubmitAction,
  isWolfVoteAllComplete,
  type SchemaId,
  SCHEMAS,
  type SetAudioPlayingIntent,
  type StateAction,
  type SubmitActionIntent,
} from '../../_shared/game-engine/index.js';
import { processGameAction } from '../../_shared/gameStateManager.ts';
import { buildHandlerContext } from '../../_shared/handlerContext.ts';
import { resultToStatus } from '../../_shared/responseStatus.ts';
import type {
  ActionRequestBody,
  AudioGateRequestBody,
  GroupConfirmAckRequestBody,
  WolfRobotViewedRequestBody,
} from '../../_shared/types.ts';
import { type HandlerFn, missingParams } from './shared.ts';

// ---------------------------------------------------------------------------
// Night handlers
// ---------------------------------------------------------------------------

export const handleAction: HandlerFn = async (req) => {
  const body = (await req.json()) as ActionRequestBody;
  const { roomCode, seat, role, target, extra } = body;

  if (!roomCode || typeof seat !== 'number' || !role) {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat, role, target, extra },
      };
      const actionResult = handleSubmitAction(intent, handlerCtx);
      if (!actionResult.success) return actionResult;

      // Wolf vote timer: if this was a wolfVote step, manage the 5s countdown timer.
      const stepId = state.currentStepId;
      if (stepId) {
        const schema = SCHEMAS[stepId as SchemaId];
        if (schema?.kind === 'wolfVote') {
          let tempState = state;
          for (const action of actionResult.actions) {
            tempState = gameReducer(tempState, action);
          }

          const allVoted = isWolfVoteAllComplete(tempState);
          const hasExistingTimer = tempState.wolfVoteDeadline != null;
          const timerAction = decideWolfVoteTimerAction(allVoted, hasExistingTimer, Date.now());

          const actions = [...actionResult.actions];
          if (timerAction.type === 'set') {
            actions.push({
              type: 'SET_WOLF_VOTE_DEADLINE' as const,
              payload: { deadline: timerAction.deadline },
            });
          } else if (timerAction.type === 'clear') {
            actions.push({ type: 'CLEAR_WOLF_VOTE_DEADLINE' as const });
          }

          return { ...actionResult, actions };
        }
      }

      return actionResult;
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};

export const handleAudioAck: HandlerFn = async (req) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state) => {
      // Guard: idempotent no-op if audio is already not playing and no pending effects
      if (
        !state.isAudioPlaying &&
        (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0)
      ) {
        return { success: true, actions: [] };
      }
      return {
        success: true,
        actions: [
          { type: 'CLEAR_PENDING_AUDIO_EFFECTS' as const },
          { type: 'SET_AUDIO_PLAYING' as const, payload: { isPlaying: false } },
        ],
      };
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};

export const handleAudioGate: HandlerFn = async (req) => {
  const body = (await req.json()) as AudioGateRequestBody;
  const { roomCode, isPlaying } = body;

  if (!roomCode || typeof isPlaying !== 'boolean') {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const intent: SetAudioPlayingIntent = {
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying },
    };
    return handleSetAudioPlaying(intent, handlerCtx);
  });

  return jsonResponse(result, resultToStatus(result));
};

export const handleEnd: HandlerFn = async (req) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const intent: EndNightIntent = { type: 'END_NIGHT' };
    const handlerResult = handleEndNight(intent, handlerCtx);
    if (!handlerResult.success) return handlerResult;

    // Extract PLAY_AUDIO sideEffects → convert to state actions (same as handleStart)
    const audioEffects: AudioEffect[] = (handlerResult.sideEffects ?? [])
      .filter(
        (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
          e.type === 'PLAY_AUDIO',
      )
      .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));

    if (audioEffects.length > 0) {
      const extraActions: StateAction[] = [
        { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
        { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
      ];
      return {
        ...handlerResult,
        actions: [...handlerResult.actions, ...extraActions],
      };
    }

    return handlerResult;
  });

  return jsonResponse(result, resultToStatus(result));
};

export const handleProgression: HandlerFn = async (req) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state) => {
      if (state.status !== GameStatus.Ongoing) {
        return { success: false, reason: 'not_ongoing', actions: [] };
      }
      return { success: true, actions: [] };
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};

export const handleRevealAck: HandlerFn = async (req) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state) => {
      if (!state.pendingRevealAcks || state.pendingRevealAcks.length === 0) {
        return { success: false, reason: 'no_pending_acks', actions: [] };
      }
      return {
        success: true,
        actions: [{ type: 'CLEAR_REVEAL_ACKS' as const }],
        sideEffects: [{ type: 'BROADCAST_STATE' as const }],
      };
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};

export const handleWolfRobotViewed: HandlerFn = async (req) => {
  const body = (await req.json()) as WolfRobotViewedRequestBody;
  const { roomCode, seat } = body;

  if (!roomCode || typeof seat !== 'number') {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      return handleSetWolfRobotHunterStatusViewed(handlerCtx, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat,
      });
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};

export const handleGroupConfirmAck: HandlerFn = async (req) => {
  const body = (await req.json()) as GroupConfirmAckRequestBody;
  const { roomCode, seat, uid } = body;

  if (!roomCode || typeof seat !== 'number' || !uid) {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state: GameState) => {
      // Must be ongoing
      if (state.status !== GameStatus.Ongoing) {
        return { success: false, reason: 'not_ongoing', actions: [] };
      }
      // Current step must be a groupConfirm schema
      const stepId = state.currentStepId;
      if (!stepId) {
        return { success: false, reason: 'no_current_step', actions: [] };
      }
      const schema = SCHEMAS[stepId as SchemaId];
      if (!schema || schema.kind !== 'groupConfirm') {
        return { success: false, reason: 'not_group_confirm_step', actions: [] };
      }
      // Validate seat has a player and uid matches
      const player = state.players[seat];
      if (!player) {
        return { success: false, reason: 'no_player_at_seat', actions: [] };
      }
      if (player.uid !== uid && uid !== state.hostUid) {
        return { success: false, reason: 'uid_mismatch', actions: [] };
      }
      // Idempotent: already acked → no-op success
      const acks = state.piperRevealAcks ?? [];
      if (acks.includes(seat)) {
        return { success: true, actions: [] };
      }

      // Build action: ack this single seat only
      const actions: StateAction[] = [{ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } }];

      return { success: true, actions };
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};
