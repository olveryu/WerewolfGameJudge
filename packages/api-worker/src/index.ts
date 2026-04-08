/**
 * Werewolf API Worker — Main entry point
 *
 * 统一 HTTP 路由分派，与 Edge Functions 的 game/index.ts 路由一致。
 * 新增 /auth/* 路由和 /gemini-proxy。
 *
 * 路由结构：
 *   POST /auth/anonymous          — 匿名登录
 *   POST /auth/signup             — 邮箱注册
 *   POST /auth/signin             — 邮箱登录
 *   GET  /auth/user               — 获取当前用户
 *   PUT  /auth/profile            — 更新资料
 *   POST /auth/signout            — 登出
 *   POST /auth/forgot-password    — 发送密码重置验证码
 *   POST /auth/reset-password     — 验证码重置密码
 *   POST /game/{assign,seat,...}  — 游戏控制 API
 *   POST /game/night/{action,...} — 夜晚流程 API
 *   POST /gemini-proxy            — Gemini AI 代理
 *   GET  /health                  — 健康检查
 */

import type { Env } from './env';
import { corsPreflightResponse, jsonResponse } from './lib/cors';

// Re-export Durable Object class for wrangler
export { GameRoom } from './durableObjects/GameRoom';

// Auth handlers
import {
  handleAnonymousSignIn,
  handleChangePassword,
  handleForgotPassword,
  handleGetUser,
  handleResetPassword,
  handleSignIn,
  handleSignOut,
  handleSignUp,
  handleUpdateProfile as handleAuthUpdateProfile,
} from './handlers/authHandlers';
// Avatar handlers
import { handleAvatarServe, handleAvatarUpload } from './handlers/avatarUpload';
// Cron handlers
import { runScheduledCleanup } from './handlers/cronHandlers';
// Game control handlers
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
  handleUpdateProfileRoute,
  handleUpdateTemplateRoute,
  handleViewRole,
} from './handlers/gameControl';
// Gemini proxy
import { handleGeminiProxy } from './handlers/geminiProxy';
// Night handlers
import {
  handleAction,
  handleAudioAck,
  handleAudioGate,
  handleEnd,
  handleGroupConfirmAck,
  handleMarkBotsGroupConfirmed,
  handleProgression,
  handleRevealAck,
  handleWolfRobotViewed,
} from './handlers/night';
// Room handlers
import {
  handleCreateRoom,
  handleDeleteRoom,
  handleGetGameState,
  handleGetRevision,
  handleGetRoom,
} from './handlers/roomHandlers';
import type { HandlerFn } from './handlers/shared';

// ── Route maps ──────────────────────────────────────────────────────────────

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
  'update-profile': handleUpdateProfileRoute,
  'update-template': handleUpdateTemplateRoute,
  'view-role': handleViewRole,
};

const NIGHT_ROUTES: Record<string, HandlerFn> = {
  action: handleAction,
  'audio-ack': handleAudioAck,
  'audio-gate': handleAudioGate,
  end: handleEnd,
  'group-confirm-ack': handleGroupConfirmAck,
  'mark-bots-group-confirmed': handleMarkBotsGroupConfirmed,
  progression: handleProgression,
  'reveal-ack': handleRevealAck,
  'wolf-robot-viewed': handleWolfRobotViewed,
};

// ── Worker entry ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsPreflightResponse(env);
    }

    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);

    try {
      // /health
      if (segments[0] === 'health') {
        return jsonResponse({ status: 'ok' }, 200, env);
      }

      // /ws?roomCode=XXXX&userId=YYY — WebSocket upgrade → Durable Object
      if (segments[0] === 'ws') {
        const roomCode = url.searchParams.get('roomCode');
        if (!roomCode) {
          return jsonResponse({ error: 'roomCode required' }, 400, env);
        }
        const id = env.GAME_ROOM.idFromName(roomCode);
        const stub = env.GAME_ROOM.get(id);
        // Forward the upgrade request to the DO
        const doUrl = new URL(request.url);
        doUrl.pathname = '/websocket';
        return stub.fetch(new Request(doUrl.toString(), request));
      }

      // /auth/*
      if (segments[0] === 'auth') {
        const route = segments[1];
        if (request.method === 'POST') {
          switch (route) {
            case 'anonymous':
              return handleAnonymousSignIn(request, env);
            case 'signup':
              return handleSignUp(request, env);
            case 'signin':
              return handleSignIn(request, env);
            case 'signout':
              return handleSignOut(request, env);
            case 'forgot-password':
              return handleForgotPassword(request, env);
            case 'reset-password':
              return handleResetPassword(request, env);
          }
        }
        if (request.method === 'GET' && route === 'user') {
          return handleGetUser(request, env);
        }
        if (request.method === 'PUT') {
          switch (route) {
            case 'profile':
              return handleAuthUpdateProfile(request, env);
            case 'password':
              return handleChangePassword(request, env);
          }
        }
        return jsonResponse({ error: 'not found' }, 404, env);
      }

      // /room/*
      if (segments[0] === 'room' && request.method === 'POST') {
        switch (segments[1]) {
          case 'create':
            return handleCreateRoom(request, env);
          case 'get':
            return handleGetRoom(request, env);
          case 'delete':
            return handleDeleteRoom(request, env);
          case 'state':
            return handleGetGameState(request, env);
          case 'revision':
            return handleGetRevision(request, env);
        }
        return jsonResponse({ error: 'not found' }, 404, env);
      }

      // /game/* and /game/night/*
      if (segments[0] === 'game') {
        if (request.method !== 'POST') {
          return jsonResponse({ error: 'method not allowed' }, 405, env);
        }

        // /game/night/{handler}
        if (segments[1] === 'night' && segments[2]) {
          const handler = NIGHT_ROUTES[segments[2]];
          if (handler) return handler(request, env, ctx);
          return jsonResponse({ error: 'not found' }, 404, env);
        }

        // /game/{handler}
        if (segments[1]) {
          const handler = GAME_ROUTES[segments[1]];
          if (handler) return handler(request, env, ctx);
          return jsonResponse({ error: 'not found' }, 404, env);
        }

        return jsonResponse({ error: 'not found' }, 404, env);
      }

      // /gemini-proxy
      if (segments[0] === 'gemini-proxy') {
        if (request.method !== 'POST') {
          return jsonResponse({ error: 'method not allowed' }, 405, env);
        }
        return handleGeminiProxy(request, env);
      }

      // /avatar/upload (POST) — R2 头像上传
      if (segments[0] === 'avatar' && segments[1] === 'upload' && request.method === 'POST') {
        return handleAvatarUpload(request, env);
      }

      // /avatar/:userId/:filename (GET) — R2 头像提供
      if (segments[0] === 'avatar' && segments.length >= 3 && request.method === 'GET') {
        const key = segments.slice(1).join('/');
        return handleAvatarServe(request, env, key);
      }

      return jsonResponse({ error: 'not found' }, 404, env);
    } catch (err) {
      console.error('[worker] Unhandled error:', err);
      return jsonResponse({ success: false, reason: 'INTERNAL_ERROR' }, 500, env);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledCleanup(env));
  },
};
