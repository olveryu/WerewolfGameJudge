/**
 * Reducer Types - 状态动作类型定义
 *
 * StateAction 是 reducer 的输入，描述状态变更
 */

import type { RoleId } from '@/models/roles';
import type { SchemaId } from '@/models/roles/spec';
import type { BroadcastPlayer, ProtocolAction } from '@/services/protocol/types';
import type { CurrentNightResults } from '@/services/night/resolvers/types';
import type { RoleRevealAnimation } from '@/services/types/RoleRevealAnimation';

// =============================================================================
// 游戏生命周期动作
// =============================================================================

export interface InitializeGameAction {
  type: 'INITIALIZE_GAME';
  payload: {
    roomCode: string;
    hostUid: string;
    templateRoles: RoleId[];
    totalSeats: number;
  };
}
export interface RestartGameAction {
  type: 'RESTART_GAME';
}

export interface UpdateTemplateAction {
  type: 'UPDATE_TEMPLATE';
  payload: {
    templateRoles: RoleId[];
  };
}

export interface SetRoleRevealAnimationAction {
  type: 'SET_ROLE_REVEAL_ANIMATION';
  animation: RoleRevealAnimation;
}

// =============================================================================
// 座位管理动作
// =============================================================================

export interface PlayerJoinAction {
  type: 'PLAYER_JOIN';
  payload: {
    seat: number;
    player: BroadcastPlayer;
  };
}

export interface PlayerLeaveAction {
  type: 'PLAYER_LEAVE';
  payload: {
    seat: number;
  };
}

// =============================================================================
// 游戏阶段动作
// =============================================================================

export interface AssignRolesAction {
  type: 'ASSIGN_ROLES';
  payload: {
    assignments: Record<number, RoleId>;
  };
}

export interface StartNightAction {
  type: 'START_NIGHT';
  payload: {
    currentActionerIndex: number;
    /** 首步 stepId，来自 NIGHT_STEPS[0].id 表驱动单源 */
    currentStepId: SchemaId;
  };
}

export interface AdvanceToNextActionAction {
  type: 'ADVANCE_TO_NEXT_ACTION';
  payload: {
    nextActionerIndex: number;
    /** 下一步 stepId（来自 NIGHT_STEPS 表驱动单源），null 表示夜晚结束 */
    nextStepId: SchemaId | null;
  };
}

export interface EndNightAction {
  type: 'END_NIGHT';
  payload: {
    deaths: number[];
  };
}

// =============================================================================
// 夜晚行动动作
// =============================================================================

export interface RecordActionAction {
  type: 'RECORD_ACTION';
  payload: {
    action: ProtocolAction;
  };
}

export interface ApplyResolverResultAction {
  type: 'APPLY_RESOLVER_RESULT';
  payload: {
    updates?: Partial<CurrentNightResults>;
    seerReveal?: { targetSeat: number; result: '好人' | '狼人' };
    psychicReveal?: { targetSeat: number; result: string };
    gargoyleReveal?: { targetSeat: number; result: string };
    wolfRobotReveal?: {
      targetSeat: number;
      result: string;
      /**
       * The learned role ID (strict RoleId) - REQUIRED for hunter gate check and disguise.
       * This is never optional when wolfRobotReveal exists.
       */
      learnedRoleId: RoleId;
      /** When learned hunter, whether wolfRobot can shoot as hunter */
      canShootAsHunter?: boolean;
    };
    /** Wolf Robot disguise context - written when wolfRobot learns a target */
    wolfRobotContext?: { learnedSeat: number; disguisedRole: RoleId };
    /**
     * Gate: wolfRobot learned hunter and must view status before proceeding.
     * Set to false when wolfRobotLearn reveal shows hunter.
     */
    wolfRobotHunterStatusViewed?: boolean;
  };
}

export interface SetWitchContextAction {
  type: 'SET_WITCH_CONTEXT';
  payload: {
    killedIndex: number;
    canSave: boolean;
    canPoison: boolean;
  };
}

export interface SetConfirmStatusAction {
  type: 'SET_CONFIRM_STATUS';
  payload: {
    role: 'hunter' | 'darkWolfKing';
    canShoot: boolean;
  };
}

export interface ClearRevealStateAction {
  type: 'CLEAR_REVEAL_STATE';
}

export interface SetWolfKillDisabledAction {
  type: 'SET_WOLF_KILL_DISABLED';
  payload: {
    disabled: boolean;
    blockedSeat?: number;
  };
}

// =============================================================================
// UI Hint 动作（Host 广播驱动，UI 只读）
// =============================================================================

/**
 * 设置当前步骤的 UI Hint
 *
 * 职责：Host 通过 resolver/handler 判定后写入，进入下一 step 时清空。
 * UI 只读展示，不推导。按 targetRoleIds 过滤"谁能看到"。
 */
export interface SetUiHintAction {
  type: 'SET_UI_HINT';
  payload: {
    currentActorHint: {
      kind: 'blocked_by_nightmare' | 'wolf_kill_disabled';
      targetRoleIds: RoleId[];
      message: string;
      bottomAction?: 'skipOnly' | 'wolfEmptyOnly';
      promptOverride?: { title?: string; text?: string };
    } | null;
  };
}

// =============================================================================
// 音频状态动作
// =============================================================================

export interface SetAudioPlayingAction {
  type: 'SET_AUDIO_PLAYING';
  payload: {
    isPlaying: boolean;
  };
}

// =============================================================================
// 玩家状态动作
// =============================================================================

export interface PlayerViewedRoleAction {
  type: 'PLAYER_VIEWED_ROLE';
  payload: {
    seat: number;
  };
}

// =============================================================================
// 错误/拒绝动作
// =============================================================================

export interface ActionRejectedAction {
  type: 'ACTION_REJECTED';
  payload: {
    action: string;
    reason: string;
    targetUid: string;
    /**
     * Unique id for this rejection event.
     * Used by UI to avoid accidentally deduping distinct rejections that share the same reason.
     */
    rejectionId: string;
  };
}

export interface ClearActionRejectedAction {
  type: 'CLEAR_ACTION_REJECTED';
}

// =============================================================================
// Reveal ACK 动作
// =============================================================================

export interface AddRevealAckAction {
  type: 'ADD_REVEAL_ACK';
  payload: {
    ackKey: string;
  };
}

export interface ClearRevealAcksAction {
  type: 'CLEAR_REVEAL_ACKS';
}

// =============================================================================
// Wolf Robot Hunter Gate 动作
// =============================================================================

export interface SetWolfRobotHunterStatusViewedAction {
  type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED';
  payload: {
    viewed: boolean;
  };
}

// =============================================================================
// Schema ID 追踪（用于当前步骤）
// =============================================================================

export interface SetCurrentStepAction {
  type: 'SET_CURRENT_STEP';
  payload: {
    schemaId: SchemaId | null;
  };
}

// =============================================================================
// Debug Bots 动作
// =============================================================================

/**
 * 填充机器人动作
 * 为所有空座位创建 bot player，设置 debugMode.botsEnabled = true
 */
export interface FillWithBotsAction {
  type: 'FILL_WITH_BOTS';
  payload: {
    /** bot players to add (keyed by seat number) */
    bots: Record<number, BroadcastPlayer>;
  };
}

/**
 * 标记所有机器人已查看角色动作
 * 仅对 isBot === true 的玩家设置 hasViewedRole = true
 */
export interface MarkAllBotsViewedAction {
  type: 'MARK_ALL_BOTS_VIEWED';
}

// =============================================================================
// StateAction 联合类型
// =============================================================================

export type StateAction =
  // 生命周期
  | InitializeGameAction
  | RestartGameAction
  | UpdateTemplateAction
  | SetRoleRevealAnimationAction
  // 座位
  | PlayerJoinAction
  | PlayerLeaveAction
  // 游戏阶段
  | AssignRolesAction
  | StartNightAction
  | AdvanceToNextActionAction
  | EndNightAction
  // 夜晚行动
  | RecordActionAction
  | ApplyResolverResultAction
  | SetWitchContextAction
  | SetConfirmStatusAction
  | ClearRevealStateAction
  // 狼人相关
  | SetWolfKillDisabledAction
  // Wolf Robot Hunter Gate
  | SetWolfRobotHunterStatusViewedAction
  // UI Hint（Host 广播驱动）
  | SetUiHintAction
  // 音频
  | SetAudioPlayingAction
  // 玩家状态
  | PlayerViewedRoleAction
  // 错误
  | ActionRejectedAction
  | ClearActionRejectedAction
  // Reveal ACK
  | AddRevealAckAction
  | ClearRevealAcksAction
  // 步骤追踪
  | SetCurrentStepAction
  // Debug Bots
  | FillWithBotsAction
  | MarkAllBotsViewedAction;
