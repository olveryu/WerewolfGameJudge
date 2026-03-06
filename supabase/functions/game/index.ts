/**
 * Game Edge Function — POST /functions/v1/game/*
 *
 * 将所有游戏 API 合并为一个 fat Edge Function（减少冷启动），
 * 通过 URL pathname 分派到对应 handler。
 * 核心游戏逻辑委托 handlers/ 子模块，本文件仅负责路由分派。
 *
 * 支持的路由：
 *   /game/assign, /game/clear-seats, /game/fill-bots, /game/mark-bots-viewed,
 *   /game/restart, /game/seat, /game/set-animation, /game/share-review,
 *   /game/start, /game/update-template, /game/view-role
 *   /game/night/action, /game/night/audio-ack, /game/night/audio-gate,
 *   /game/night/end, /game/night/group-confirm-ack, /game/night/progression,
 *   /game/night/reveal-ack, /game/night/wolf-robot-viewed
 *
 * 负责请求解析与分派，不直接操作 DB / state（委托 gameStateManager），不播放音频。
 */

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  handleAssign,
  handleClearSeats,
  handleFillBots,
  handleMarkBotsViewed,
  handleRestart,
  handleSeat,
  handleSetAnimation,
  handleShareReview,
  handleStart,
  handleUpdateTemplateRoute,
  handleViewRole,
} from './handlers/gameControl.ts';
import {
  handleAction,
  handleAudioAck,
  handleAudioGate,
  handleEnd,
  handleGroupConfirmAck,
  handleProgression,
  handleRevealAck,
  handleWolfRobotViewed,
} from './handlers/night.ts';
import type { HandlerFn } from './handlers/shared.ts';

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
    const message = err instanceof Error ? err.message : String(err);
    console.error('[game] Unhandled error in request handler:', message, err);
    return jsonResponse({ success: false, reason: 'INTERNAL_ERROR' }, 500);
  }
});
