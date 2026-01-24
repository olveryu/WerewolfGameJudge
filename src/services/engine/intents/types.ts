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

/**
 * 离开我的座位（不需要指定 seat）
 * seat 由 handler 从 context.mySeat 获取
 */
export interface LeaveMySeatIntent {
  type: 'LEAVE_MY_SEAT';
  payload: {
    uid: string;
  };
}

// =============================================================================
// 游戏生命周期 Intent
// =============================================================================

/**
 * 分配角色 Intent（Host-only）
 * 前置条件：status === 'seated'
 * 结果：status → 'assigned'
 */
export interface AssignRolesIntent {
  type: 'ASSIGN_ROLES';
}

export interface StartGameIntent {
  type: 'START_GAME';
}

/**
 * 开始夜晚 Intent（Host-only）
 * 前置条件：status === 'ready'
 * 结果：status → 'ongoing'，初始化 Night-1 字段
 */
export interface StartNightIntent {
  type: 'START_NIGHT';
}

export interface RestartGameIntent {
  type: 'RESTART_GAME';
}

/**
 * 更新模板 Intent（Host-only）
 * 前置条件：status === 'unseated' | 'seated'（准备看牌前）
 * 用于 Host 编辑房间配置
 */
export interface UpdateTemplateIntent {
  type: 'UPDATE_TEMPLATE';
  payload: {
    templateRoles: RoleId[];
  };
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

/**
 * 设置音频播放状态 Intent（Host-only）
 *
 * PR7: 音频时序控制
 * - 当音频开始播放时，调用 setAudioPlaying(true)
 * - 当音频结束（或被跳过）时，调用 setAudioPlaying(false)
 *
 * Gate:
 * - host_only
 * - no_state
 * - invalid_status（必须 ongoing）
 */
export interface SetAudioPlayingIntent {
  type: 'SET_AUDIO_PLAYING';
  payload: {
    isPlaying: boolean;
  };
}

export interface SkipAudioIntent {
  type: 'SKIP_AUDIO';
}

export interface PlayNextAudioIntent {
  type: 'PLAY_NEXT_AUDIO';
}

// =============================================================================
// 夜晚流程 Intent（仅主机）
// =============================================================================

/**
 * 推进夜晚到下一步
 * Host-only：音频结束后调用，推进 currentActionerIndex + currentStepId
 */
export interface AdvanceNightIntent {
  type: 'ADVANCE_NIGHT';
}

/**
 * 结束夜晚
 * Host-only：夜晚结束音频结束后，进行死亡结算并置 ended
 */
export interface EndNightIntent {
  type: 'END_NIGHT';
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
  | LeaveMySeatIntent
  | AssignRolesIntent
  | StartGameIntent
  | StartNightIntent
  | RestartGameIntent
  | UpdateTemplateIntent
  | SubmitActionIntent
  | SubmitWolfVoteIntent
  | ViewedRoleIntent
  | RevealAckIntent
  | SetAudioPlayingIntent
  | SkipAudioIntent
  | PlayNextAudioIntent
  | AdvanceNightIntent
  | EndNightIntent
  | RequestSnapshotIntent;
