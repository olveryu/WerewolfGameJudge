/**
 * Intent Types - 意图类型定义
 *
 * Intent 是 UI 层发出的动作请求，由 Handler 处理
 * Intent 与 PlayerMessage 对应，但更加类型安全
 */

import type { RoleId } from '../../../models/roles';

// =============================================================================
// 座位相关 Intent
// =============================================================================

export interface JoinSeatIntent {
  type: 'JOIN_SEAT';
  payload: {
    seat: number;
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface LeaveSeatIntent {
  type: 'LEAVE_SEAT';
  payload: {
    seat: number;
    uid: string;
  };
}

// =============================================================================
// 游戏生命周期 Intent
// =============================================================================

export interface StartGameIntent {
  type: 'START_GAME';
}

export interface RestartGameIntent {
  type: 'RESTART_GAME';
}

// =============================================================================
// 夜晚行动 Intent
// =============================================================================

export interface SubmitActionIntent {
  type: 'SUBMIT_ACTION';
  payload: {
    seat: number;
    role: RoleId;
    target: number | null;
    extra?: unknown;
  };
}

export interface SubmitWolfVoteIntent {
  type: 'SUBMIT_WOLF_VOTE';
  payload: {
    seat: number;
    target: number;
  };
}

// =============================================================================
// 玩家状态 Intent
// =============================================================================

export interface ViewedRoleIntent {
  type: 'VIEWED_ROLE';
  payload: {
    seat: number;
  };
}

export interface RevealAckIntent {
  type: 'REVEAL_ACK';
  payload: {
    seat: number;
    role: RoleId;
    revision: number;
  };
}

// =============================================================================
// 音频控制 Intent（仅主机）
// =============================================================================

export interface SkipAudioIntent {
  type: 'SKIP_AUDIO';
}

export interface PlayNextAudioIntent {
  type: 'PLAY_NEXT_AUDIO';
}

// =============================================================================
// 状态同步 Intent
// =============================================================================

export interface RequestSnapshotIntent {
  type: 'REQUEST_SNAPSHOT';
  payload: {
    uid: string;
    lastRevision?: number;
  };
}

// =============================================================================
// Intent 联合类型
// =============================================================================

export type GameIntent =
  | JoinSeatIntent
  | LeaveSeatIntent
  | StartGameIntent
  | RestartGameIntent
  | SubmitActionIntent
  | SubmitWolfVoteIntent
  | ViewedRoleIntent
  | RevealAckIntent
  | SkipAudioIntent
  | PlayNextAudioIntent
  | RequestSnapshotIntent;
