/**
 * API Request/Response Types for Edge Functions
 *
 * 从 api/_lib/types.ts 移植，删除 Vercel 特有类型。
 * 仅包含类型定义，不包含运行时逻辑。
 */

import type { GameState, RoleId, SideEffect, StateAction } from '../_shared/game-engine/index.js';

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
  state?: GameState;
  /** DB state_revision（客户端用于 applySnapshot） */
  revision?: number;
  sideEffects?: SideEffect[];
  /** Internal error message (only on INTERNAL_ERROR, stripped in production) */
  error?: string;
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

/** POST /game/assign */
export interface AssignRequestBody {
  roomCode: string;
}

/** POST /game/fill-bots */
export interface FillBotsRequestBody {
  roomCode: string;
}

/** POST /game/start */
export interface StartRequestBody {
  roomCode: string;
}

/** POST /game/restart */
export interface RestartRequestBody {
  roomCode: string;
}

/** POST /game/view-role */
export interface ViewRoleRequestBody {
  roomCode: string;
  uid: string;
  seat: number;
}

/** POST /game/update-template */
export interface UpdateTemplateRequestBody {
  roomCode: string;
  templateRoles: RoleId[];
}

/** POST /game/share-review */
export interface ShareReviewRequestBody {
  roomCode: string;
  allowedSeats: number[];
}

/** POST /game/set-animation */
export interface SetAnimationRequestBody {
  roomCode: string;
  animation:
    | 'roulette'
    | 'roleHunt'
    | 'scratch'
    | 'tarot'
    | 'gachaMachine'
    | 'cardPick'
    | 'constellation'
    | 'none'
    | 'random';
}

/** POST /game/mark-bots-viewed */
export interface MarkBotsViewedRequestBody {
  roomCode: string;
}

/** POST /game/clear-seats */
export interface ClearSeatsRequestBody {
  roomCode: string;
}

// ---------------------------------------------------------------------------
// Night Flow API
// ---------------------------------------------------------------------------

/** POST /game/night/action */
export interface ActionRequestBody {
  roomCode: string;
  seat: number;
  role: RoleId;
  target: number | null;
  extra?: unknown;
}

/** POST /game/night/wolf-vote */
export interface WolfVoteRequestBody {
  roomCode: string;
  voterSeat: number;
  targetSeat: number;
}

/** POST /game/night/end */
export interface EndNightRequestBody {
  roomCode: string;
}

/** POST /game/night/audio-gate */
export interface AudioGateRequestBody {
  roomCode: string;
  isPlaying: boolean;
}

/** POST /game/night/audio-ack */
export interface AudioAckRequestBody {
  roomCode: string;
}

/** POST /game/night/progression */
export interface ProgressionRequestBody {
  roomCode: string;
}

/** POST /game/night/reveal-ack */
export interface RevealAckRequestBody {
  roomCode: string;
}

/** POST /game/night/wolf-robot-viewed */
export interface WolfRobotViewedRequestBody {
  roomCode: string;
  seat: number;
}

/** POST /game/night/group-confirm-ack */
export interface GroupConfirmAckRequestBody {
  roomCode: string;
  seat: number;
  uid: string;
}
