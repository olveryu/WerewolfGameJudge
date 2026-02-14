/**
 * API Request/Response Types
 *
 * Vercel API Route 的请求体和响应体类型定义。
 *
 * ✅ 允许：类型定义
 * ❌ 禁止：运行时逻辑
 */

import type { BroadcastGameState, SideEffect, StateAction } from '@werewolf/game-engine';

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
