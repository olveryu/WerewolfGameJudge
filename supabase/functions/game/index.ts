/**
 * Game Edge Function — POST /functions/v1/game/*
 *
 * 将所有游戏 API 合并为一个 fat Edge Function（减少冷启动），
 * 通过 URL pathname 分派到对应 handler。
 * 从 api/game/[action].ts 和 api/game/night/[action].ts 移植，
 * 核心游戏逻辑完全一致。
 *
 * 支持的路由：
 *   /game/assign, /game/clear-seats, /game/fill-bots, /game/mark-bots-viewed,
 *   /game/restart, /game/seat, /game/set-animation, /game/share-review,
 *   /game/start, /game/update-template, /game/view-role
 *   /game/night/action, /game/night/audio-ack, /game/night/audio-gate,
 *   /game/night/end, /game/night/group-confirm-ack, /game/night/progression,
 *   /game/night/reveal-ack, /game/night/wolf-robot-viewed, /game/night/wolf-vote
 *
 * 负责请求解析与分派，不直接操作 DB / state（委托 gameStateManager），不播放音频。
 */

import {
  type AudioEffect,
  decideWolfVoteTimerAction,
  type EndNightIntent,
  gameReducer,
  type GameState,
  GameStatus,
  handleAssignRoles,
  handleClearAllSeats,
  handleEndNight,
  handleFillWithBots,
  handleJoinSeat,
  handleLeaveMySeat,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleSetAudioPlaying,
  handleSetRoleRevealAnimation,
  handleSetWolfRobotHunterStatusViewed,
  handleShareNightReview,
  handleStartNight,
  handleSubmitAction,
  handleSubmitWolfVote,
  handleUpdateTemplate,
  handleViewedRole,
  isWolfVoteAllComplete,
  type JoinSeatIntent,
  type LeaveMySeatIntent,
  type SchemaId,
  SCHEMAS,
  type SetAudioPlayingIntent,
  type StateAction,
  type SubmitActionIntent,
  type SubmitWolfVoteIntent,
} from '../_shared/game-engine/index.js';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { processGameAction } from '../_shared/gameStateManager.ts';
import { buildHandlerContext } from '../_shared/handlerContext.ts';
import { resultToStatus } from '../_shared/responseStatus.ts';
import type {
  ActionRequestBody,
  AudioGateRequestBody,
  GroupConfirmAckRequestBody,
  SeatRequestBody,
  SetAnimationRequestBody,
  ShareReviewRequestBody,
  StartRequestBody,
  UpdateTemplateRequestBody,
  ViewRoleRequestBody,
  WolfRobotViewedRequestBody,
  WolfVoteRequestBody,
} from '../_shared/types.ts';

// ---------------------------------------------------------------------------
// Shared helpers (DRY)
// ---------------------------------------------------------------------------

type HandlerFn = (req: Request) => Promise<Response>;

/** Respond with 400 MISSING_PARAMS */
function missingParams(): Response {
  return jsonResponse({ success: false, reason: 'MISSING_PARAMS' }, 400);
}

/**
 * Factory for simple handlers that only need roomCode.
 *
 * Pattern: parse body → validate → processGameAction →
 * buildHandlerContext(state, state.hostUid) → handlerFn → respond.
 */
function createSimpleHandler<I extends { type: string }>(
  handlerFn: (
    intent: I,
    ctx: ReturnType<typeof buildHandlerContext>,
  ) => ReturnType<typeof handleAssignRoles>,
  intent: I,
): HandlerFn {
  return async (req: Request) => {
    const body = (await req.json()) as { roomCode?: string };
    const { roomCode } = body;
    if (!roomCode) return missingParams();

    const result = await processGameAction(roomCode, (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      return handlerFn(intent, handlerCtx);
    });
    return jsonResponse(result, resultToStatus(result));
  };
}

// ---------------------------------------------------------------------------
// Game Control handlers
// ---------------------------------------------------------------------------

const handleAssign = createSimpleHandler(handleAssignRoles, { type: 'ASSIGN_ROLES' as const });
const handleFillBots = createSimpleHandler(handleFillWithBots, {
  type: 'FILL_WITH_BOTS' as const,
});
const handleMarkBotsViewed = createSimpleHandler(handleMarkAllBotsViewed, {
  type: 'MARK_ALL_BOTS_VIEWED' as const,
});
const handleClearSeats = createSimpleHandler(handleClearAllSeats, {
  type: 'CLEAR_ALL_SEATS' as const,
});
const handleRestart = createSimpleHandler(handleRestartGame, { type: 'RESTART_GAME' as const });

const handleSeat: HandlerFn = async (req) => {
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

const handleSetAnimation: HandlerFn = async (req) => {
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

const handleStart: HandlerFn = async (req) => {
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

const handleUpdateTemplateRoute: HandlerFn = async (req) => {
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

const handleViewRole: HandlerFn = async (req) => {
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

const handleShareReview: HandlerFn = async (req) => {
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

// ---------------------------------------------------------------------------
// Night handlers
// ---------------------------------------------------------------------------

const handleAction: HandlerFn = async (req) => {
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
      return handleSubmitAction(intent, handlerCtx);
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};

const handleAudioAck: HandlerFn = async (req) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state) => {
      // Guard: no-op if audio is already not playing and no pending effects
      if (
        !state.isAudioPlaying &&
        (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0)
      ) {
        return { success: false, reason: 'no_audio_playing', actions: [] };
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

const handleAudioGate: HandlerFn = async (req) => {
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

const handleEnd: HandlerFn = async (req) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return missingParams();
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const intent: EndNightIntent = { type: 'END_NIGHT' };
    return handleEndNight(intent, handlerCtx);
  });

  return jsonResponse(result, resultToStatus(result));
};

const handleProgression: HandlerFn = async (req) => {
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

const handleRevealAck: HandlerFn = async (req) => {
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

const handleWolfRobotViewed: HandlerFn = async (req) => {
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

const handleWolfVote: HandlerFn = async (req) => {
  const body = (await req.json()) as WolfVoteRequestBody;
  const { roomCode, voterSeat, targetSeat } = body;

  if (!roomCode || typeof voterSeat !== 'number' || typeof targetSeat !== 'number') {
    return missingParams();
  }

  const result = await processGameAction(
    roomCode,
    (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      const intent: SubmitWolfVoteIntent = {
        type: 'SUBMIT_WOLF_VOTE',
        payload: { seat: voterSeat, target: targetSeat },
      };
      const voteResult = handleSubmitWolfVote(intent, handlerCtx);
      if (!voteResult.success) return voteResult;

      // Apply vote actions locally to check timer decision
      let tempState = state;
      for (const action of voteResult.actions) {
        tempState = gameReducer(tempState, action);
      }

      // Wolf vote timer decision (based on post-vote state)
      const allVoted = isWolfVoteAllComplete(tempState);
      const hasExistingTimer = tempState.wolfVoteDeadline != null;
      const timerAction = decideWolfVoteTimerAction(allVoted, hasExistingTimer, Date.now());

      // Add timer actions to the result
      const actions = [...voteResult.actions];
      if (timerAction.type === 'set') {
        actions.push({
          type: 'SET_WOLF_VOTE_DEADLINE' as const,
          payload: { deadline: timerAction.deadline },
        });
      } else if (timerAction.type === 'clear') {
        actions.push({ type: 'CLEAR_WOLF_VOTE_DEADLINE' as const });
      }

      return { ...voteResult, actions };
    },
    { enabled: true },
  );

  return jsonResponse(result, resultToStatus(result));
};

const handleGroupConfirmAck: HandlerFn = async (req) => {
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

// ---------------------------------------------------------------------------
// Route maps
// ---------------------------------------------------------------------------

const GAME_ROUTES: Record<string, HandlerFn> = {
  assign: handleAssign,
  'clear-seats': handleClearSeats,
  'fill-bots': handleFillBots,
  'mark-bots-viewed': handleMarkBotsViewed,
  restart: handleRestart,
  seat: handleSeat,
  'set-animation': handleSetAnimation,
  'share-review': handleShareReview,
  start: handleStart,
  'update-template': handleUpdateTemplateRoute,
  'view-role': handleViewRole,
};

const NIGHT_ROUTES: Record<string, HandlerFn> = {
  action: handleAction,
  'audio-ack': handleAudioAck,
  'audio-gate': handleAudioGate,
  end: handleEnd,
  'group-confirm-ack': handleGroupConfirmAck,
  progression: handleProgression,
  'reveal-ack': handleRevealAck,
  'wolf-robot-viewed': handleWolfRobotViewed,
  'wolf-vote': handleWolfVote,
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Health check — lightweight GET that returns 200 without touching the DB.
    if (req.method === 'GET') {
      const url = new URL(req.url);
      if (url.pathname.endsWith('/health')) {
        return jsonResponse({ status: 'ok' }, 200);
      }
    }

    if (req.method !== 'POST') {
      return jsonResponse({ success: false, reason: 'METHOD_NOT_ALLOWED' }, 405);
    }

    // Parse route from URL pathname
    // URL patterns: /game/<action> or /game/night/<action>
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);

    // Expected: ["game", action] or ["game", "night", action]
    // Also handle: ["functions", "v1", "game", action] (full Supabase URL)
    const gameIdx = segments.indexOf('game');
    if (gameIdx === -1) {
      return jsonResponse({ success: false, reason: 'UNKNOWN_ACTION' }, 404);
    }

    const remaining = segments.slice(gameIdx + 1);

    if (remaining.length === 1) {
      // /game/<action>
      const handler = GAME_ROUTES[remaining[0]];
      if (!handler) {
        return jsonResponse({ success: false, reason: 'UNKNOWN_ACTION' }, 404);
      }
      return await handler(req);
    }

    if (remaining.length === 2 && remaining[0] === 'night') {
      // /game/night/<action>
      const handler = NIGHT_ROUTES[remaining[1]];
      if (!handler) {
        return jsonResponse({ success: false, reason: 'UNKNOWN_NIGHT_ACTION' }, 404);
      }
      return await handler(req);
    }

    return jsonResponse({ success: false, reason: 'UNKNOWN_ACTION' }, 404);
  } catch (err) {
    // Global catch — prevents Deno from returning a raw 500 without CORS headers.
    // All handler-level errors should be caught by processGameAction; this is a
    // last-resort safety net for unexpected throws (e.g. req.json() SyntaxError,
    // runtime errors before processGameAction is reached).
    const message = err instanceof Error ? err.message : String(err);
    console.error('[game] Unhandled error in request handler:', message, err);
    return jsonResponse({ success: false, reason: 'INTERNAL_ERROR', error: message }, 500);
  }
});
