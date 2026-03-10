/**
 * handlers/gameControl — Game lifecycle handlers (assign, seat, start, restart, etc.)
 *
 * All non-night route handlers. Each function is a `HandlerFn` that parses the
 * request body, validates parameters, delegates to the game-engine handler via
 * `processGameAction`, and returns a JSON response.
 * Does not define routes or call `Deno.serve`.
 */

import { jsonResponse } from '../../_shared/cors.ts';
import {
  type AudioEffect,
  type GameState,
  handleAssignRoles,
  handleClearAllSeats,
  handleFillWithBots,
  handleJoinSeat,
  handleLeaveMySeat,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleSetRoleRevealAnimation,
  handleShareNightReview,
  handleStartNight,
  handleUpdatePlayerProfile,
  handleUpdateTemplate,
  handleViewedRole,
  type JoinSeatIntent,
  type LeaveMySeatIntent,
  type StateAction,
  type UpdatePlayerProfileIntent,
} from '../../_shared/game-engine/index.js';
import { processGameAction } from '../../_shared/gameStateManager.ts';
import { buildHandlerContext } from '../../_shared/handlerContext.ts';
import { resultToStatus } from '../../_shared/responseStatus.ts';
import type {
  SeatRequestBody,
  SetAnimationRequestBody,
  ShareReviewRequestBody,
  StartRequestBody,
  UpdateProfileRequestBody,
  UpdateTemplateRequestBody,
  ViewRoleRequestBody,
} from '../../_shared/types.ts';
import { createSimpleHandler, type HandlerFn, missingParams } from './shared.ts';

// ---------------------------------------------------------------------------
// Simple intent-only handlers (need only roomCode)
// ---------------------------------------------------------------------------

export const handleAssign = createSimpleHandler(handleAssignRoles, {
  type: 'ASSIGN_ROLES' as const,
});
export const handleFillBots = createSimpleHandler(handleFillWithBots, {
  type: 'FILL_WITH_BOTS' as const,
});
export const handleMarkBotsViewed = createSimpleHandler(handleMarkAllBotsViewed, {
  type: 'MARK_ALL_BOTS_VIEWED' as const,
});
export const handleClearSeats = createSimpleHandler(handleClearAllSeats, {
  type: 'CLEAR_ALL_SEATS' as const,
});
export const handleRestart = createSimpleHandler(handleRestartGame, {
  type: 'RESTART_GAME' as const,
});

// ---------------------------------------------------------------------------
// Parameterized handlers
// ---------------------------------------------------------------------------

export const handleSeat: HandlerFn = async (req) => {
  const body = (await req.json()) as SeatRequestBody;
  const { roomCode, action, uid, seat, displayName, avatarUrl } = body;

  if (!roomCode || !uid || !action) {
    return missingParams();
  }

  if (action !== 'sit' && action !== 'standup') {
    return jsonResponse({ success: false, reason: 'INVALID_ACTION' }, 400);
  }

  if (action === 'sit' && (seat == null || typeof seat !== 'number')) {
    return jsonResponse({ success: false, reason: 'MISSING_SEAT' }, 400);
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    if (action === 'sit') {
      const intent: JoinSeatIntent = {
        type: 'JOIN_SEAT',
        payload: { seat: seat!, uid, displayName: displayName ?? '', avatarUrl },
      };
      return handleJoinSeat(intent, handlerCtx);
    } else {
      const intent: LeaveMySeatIntent = {
        type: 'LEAVE_MY_SEAT',
        payload: { uid },
      };
      return handleLeaveMySeat(intent, handlerCtx);
    }
  });
  return jsonResponse(result, resultToStatus(result));
};

export const handleSetAnimation: HandlerFn = async (req) => {
  const body = (await req.json()) as SetAnimationRequestBody;
  const { roomCode, animation } = body;

  if (!roomCode || !animation) {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    return handleSetRoleRevealAnimation(
      { type: 'SET_ROLE_REVEAL_ANIMATION', animation },
      handlerCtx,
    );
  });
  return jsonResponse(result, resultToStatus(result));
};

export const handleStart: HandlerFn = async (req) => {
  const body = (await req.json()) as StartRequestBody;
  const { roomCode } = body;

  if (!roomCode) {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const handlerResult = handleStartNight({ type: 'START_NIGHT' }, handlerCtx);
    if (!handlerResult.success) return handlerResult;

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

export const handleUpdateTemplateRoute: HandlerFn = async (req) => {
  const body = (await req.json()) as UpdateTemplateRequestBody;
  const { roomCode, templateRoles } = body;

  if (!roomCode || !templateRoles || !Array.isArray(templateRoles)) {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    return handleUpdateTemplate(
      { type: 'UPDATE_TEMPLATE', payload: { templateRoles } },
      handlerCtx,
    );
  });
  return jsonResponse(result, resultToStatus(result));
};

export const handleViewRole: HandlerFn = async (req) => {
  const body = (await req.json()) as ViewRoleRequestBody;
  const { roomCode, uid, seat } = body;

  if (!roomCode || !uid || typeof seat !== 'number') {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    return handleViewedRole({ type: 'VIEWED_ROLE', payload: { seat } }, handlerCtx);
  });
  return jsonResponse(result, resultToStatus(result));
};

export const handleShareReview: HandlerFn = async (req) => {
  const body = (await req.json()) as ShareReviewRequestBody;
  const { roomCode, allowedSeats } = body;

  if (!roomCode || !Array.isArray(allowedSeats)) {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    return handleShareNightReview({ type: 'SHARE_NIGHT_REVIEW', allowedSeats }, handlerCtx);
  });
  return jsonResponse(result, resultToStatus(result));
};

export const handleUpdateProfile: HandlerFn = async (req) => {
  const body = (await req.json()) as UpdateProfileRequestBody;
  const { roomCode, uid, displayName, avatarUrl } = body;

  if (!roomCode || !uid) {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    const intent: UpdatePlayerProfileIntent = {
      type: 'UPDATE_PLAYER_PROFILE',
      payload: { uid, displayName, avatarUrl },
    };
    return handleUpdatePlayerProfile(intent, handlerCtx);
  });
  return jsonResponse(result, resultToStatus(result));
};
