/**
 * API Request/Response Types
 *
 * Vercel API Route 的请求体和响应体类型定义。
 *
 * ✅ 允许：类型定义
 * ❌ 禁止：运行时逻辑
 */

import type { BroadcastGameState, RoleId, SideEffect, StateAction } from '@werewolf/game-engine';

// ---------------------------------------------------------------------------
// 通用
// ---------------------------------------------------------------------------

/** processGameAction 回调的返回值 */
export interface ProcessResult {
  success: boolean;
  reason?: string;
  actions: StateAction[];
  sideEffects?: SideEffect[];
}

/** processGameAction 的最终返回值 */
export interface GameActionResult {
  success: boolean;
  reason?: string;
  state?: BroadcastGameState;
  sideEffects?: SideEffect[];
}

// ---------------------------------------------------------------------------
// Seat API
// ---------------------------------------------------------------------------

export interface SeatRequestBody {
  roomCode: string;
  action: 'sit' | 'standup';
  uid: string;
  seat?: number; // action='sit' 时必填
  displayName?: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Game Control API
// ---------------------------------------------------------------------------

/** POST /api/game/assign */
export interface AssignRequestBody {
  roomCode: string;
  hostUid: string;
}

/** POST /api/game/fill-bots */
export interface FillBotsRequestBody {
  roomCode: string;
  hostUid: string;
}

/** POST /api/game/start */
export interface StartRequestBody {
  roomCode: string;
  hostUid: string;
}

/** POST /api/game/restart */
export interface RestartRequestBody {
  roomCode: string;
  hostUid: string;
}

/** POST /api/game/view-role */
export interface ViewRoleRequestBody {
  roomCode: string;
  uid: string;
  seat: number;
}

/** POST /api/game/update-template */
export interface UpdateTemplateRequestBody {
  roomCode: string;
  hostUid: string;
  templateRoles: RoleId[];
}

/** POST /api/game/set-animation */
export interface SetAnimationRequestBody {
  roomCode: string;
  hostUid: string;
  animation: 'roulette' | 'flip' | 'none';
}

/** POST /api/game/mark-bots-viewed */
export interface MarkBotsViewedRequestBody {
  roomCode: string;
  hostUid: string;
}
