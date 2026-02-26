/**
 * API Request/Response Types
 *
 * Vercel API Route 的请求体和响应体类型定义。
 * 仅包含类型定义，不包含运行时逻辑。
 */

import type { GameState, RoleId, SideEffect, StateAction } from '@werewolf/game-engine';

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

/** POST /api/game/assign */
export interface AssignRequestBody {
  roomCode: string;
}

/** POST /api/game/fill-bots */
export interface FillBotsRequestBody {
  roomCode: string;
}

/** POST /api/game/start */
export interface StartRequestBody {
  roomCode: string;
}

/** POST /api/game/restart */
export interface RestartRequestBody {
  roomCode: string;
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
  templateRoles: RoleId[];
}

/** POST /api/game/share-review */
export interface ShareReviewRequestBody {
  roomCode: string;
  allowedSeats: number[];
}

/** POST /api/game/set-animation */
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

/** POST /api/game/mark-bots-viewed */
export interface MarkBotsViewedRequestBody {
  roomCode: string;
}

/** POST /api/game/clear-seats */
export interface ClearSeatsRequestBody {
  roomCode: string;
}

// ---------------------------------------------------------------------------
// Night Flow API
// ---------------------------------------------------------------------------

/** POST /api/game/night/action */
export interface ActionRequestBody {
  roomCode: string;
  seat: number;
  role: RoleId;
  target: number | null;
  extra?: unknown;
}

/** POST /api/game/night/wolf-vote */
export interface WolfVoteRequestBody {
  roomCode: string;
  voterSeat: number;
  targetSeat: number;
}

/** POST /api/game/night/end */
export interface EndNightRequestBody {
  roomCode: string;
}

/** POST /api/game/night/audio-gate */
export interface AudioGateRequestBody {
  roomCode: string;
  isPlaying: boolean;
}

/** POST /api/game/night/audio-ack */
export interface AudioAckRequestBody {
  roomCode: string;
}

/** POST /api/game/night/progression */
export interface ProgressionRequestBody {
  roomCode: string;
}

/** POST /api/game/night/reveal-ack */
export interface RevealAckRequestBody {
  roomCode: string;
}

/** POST /api/game/night/wolf-robot-viewed */
export interface WolfRobotViewedRequestBody {
  roomCode: string;
  seat: number;
}

/** POST /api/game/night/group-confirm-ack */
export interface GroupConfirmAckRequestBody {
  roomCode: string;
  seat: number;
  uid: string;
}
