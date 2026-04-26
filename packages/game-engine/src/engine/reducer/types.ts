/**
 * Reducer Types - 状态动作类型定义
 *
 * StateAction 是 reducer 的输入，描述状态变更
 */

import type { RoleId, SchemaId } from '../../models';
import type { WolfKillOverride } from '../../models/roles/spec/schema.types';
import type { ConfirmStatus, Player, ProtocolAction, RosterEntry } from '../../protocol/types';
import type { AudioEffect, BoardNomination } from '../../protocol/types';
import type { CurrentNightResults } from '../../resolvers/types';
import type { DeathReason } from '../DeathCalculator';

// =============================================================================
// 游戏生命周期动作
// =============================================================================

export interface InitializeGameAction {
  type: 'INITIALIZE_GAME';
  payload: {
    roomCode: string;
    hostUserId: string;
    templateRoles: RoleId[];
    totalSeats: number;
  };
}
export interface RestartGameAction {
  type: 'RESTART_GAME';
  /** Pre-computed nonce for random animation resolution (injected by handler) */
  nonce: string;
}

export interface UpdateTemplateAction {
  type: 'UPDATE_TEMPLATE';
  payload: {
    templateRoles: RoleId[];
  };
}

// =============================================================================
// 座位管理动作
// =============================================================================

export interface PlayerJoinAction {
  type: 'PLAYER_JOIN';
  payload: {
    seat: number;
    player: Player;
    rosterEntry: RosterEntry;
  };
}

export interface PlayerLeaveAction {
  type: 'PLAYER_LEAVE';
  payload: {
    seat: number;
  };
}

/**
 * 更新在座玩家的展示资料（roster 字段：displayName / avatarUrl / avatarFrame）
 */
export interface UpdatePlayerProfileAction {
  type: 'UPDATE_PLAYER_PROFILE';
  payload: {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    nameStyle?: string;
    roleRevealEffect?: string;
    seatAnimation?: string;
  };
}

// =============================================================================
// 游戏阶段动作
// =============================================================================

export interface AssignRolesAction {
  type: 'ASSIGN_ROLES';
  payload: {
    assignments: Record<number, RoleId>;
    /** Seer label map - set when both seer + mirrorSeer are in template */
    seerLabelMap?: Readonly<Record<string, number>>;
    /** 底牌角色列表（盗宝大师 3 张 / 盗贼 2 张），仅底牌角色在场时存在 */
    bottomCards?: readonly RoleId[];
    /** 盗宝大师所在座位号 */
    treasureMasterSeat?: number;
    /** 盗贼所在座位号 */
    thiefSeat?: number;
    /** 丘比特所在座位号 */
    cupidSeat?: number;
  };
}

export interface StartNightAction {
  type: 'START_NIGHT';
  payload: {
    currentStepIndex: number;
    /** 首步 stepId，来自 NIGHT_STEPS[0].id 表驱动单源 */
    currentStepId: SchemaId;
  };
}

export interface AdvanceToNextActionAction {
  type: 'ADVANCE_TO_NEXT_ACTION';
  payload: {
    nextStepIndex: number;
    /** 下一步 stepId（来自 NIGHT_STEPS 表驱动单源），null 表示夜晚结束 */
    nextStepId: SchemaId | null;
  };
}

export interface EndNightAction {
  type: 'END_NIGHT';
  payload: {
    deaths: number[];
    deathReasons?: Record<number, DeathReason>;
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
    mirrorSeerReveal?: { targetSeat: number; result: '好人' | '狼人' };
    drunkSeerReveal?: { targetSeat: number; result: '好人' | '狼人' };
    psychicReveal?: { targetSeat: number; result: string };
    gargoyleReveal?: { targetSeat: number; result: string };
    pureWhiteReveal?: { targetSeat: number; result: string };
    wolfWitchReveal?: { targetSeat: number; result: string };
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
    killedSeat: number;
    canSave: boolean;
    canPoison: boolean;
  };
}

export interface SetConfirmStatusAction {
  type: 'SET_CONFIRM_STATUS';
  payload: ConfirmStatus;
}

export interface ClearRevealStateAction {
  type: 'CLEAR_REVEAL_STATE';
}

export interface SetWolfKillOverrideAction {
  type: 'SET_WOLF_KILL_OVERRIDE';
  payload: {
    override?: WolfKillOverride;
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
      kind: 'blocked_by_nightmare' | 'wolf_kill_disabled' | 'wolf_unanimity_required';
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
    targetUserId: string;
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
    bots: Record<number, Player>;
    /** bot roster entries to add (keyed by userId) */
    botRoster: Record<string, RosterEntry>;
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
// 步骤推进截止时间（统一 deadline-gate）
// =============================================================================

/**
 * 设置当前步骤的推进截止时间（epoch ms）。
 * - wolfKill 步骤：全投完后 set (now + WOLF_VOTE_COUNTDOWN_MS)
 * - 底牌空步骤：步入时 set (now + random(5000, 10000))
 */
export interface SetStepDeadlineAction {
  type: 'SET_STEP_DEADLINE';
  payload: {
    deadline: number;
  };
}

/**
 * 清除当前步骤的推进截止时间。
 * 狼人撤回投票导致未全投完时清除。
 */
export interface ClearStepDeadlineAction {
  type: 'CLEAR_STEP_DEADLINE';
}

// =============================================================================
// 待消费音频队列动作
// =============================================================================

/**
 * 设置待消费音频队列（服务端内联推进产物）
 * 服务端推进后写入 pendingAudioEffects。
 */
export interface SetPendingAudioEffectsAction {
  type: 'SET_PENDING_AUDIO_EFFECTS';
  payload: {
    effects: AudioEffect[];
  };
}

/**
 * 清除待消费音频队列
 * Host 播放完成后 POST audio-ack 清除。
 */
export interface ClearPendingAudioEffectsAction {
  type: 'CLEAR_PENDING_AUDIO_EFFECTS';
}

/**
 * 设置详细信息分享权限
 * Host 在 ended 阶段选择允许查看「详细信息」的座位列表。
 */
export interface SetNightReviewAllowedSeatsAction {
  type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS';
  allowedSeats: number[];
}

// =============================================================================
// 吹笛者 groupConfirm ACK
// =============================================================================

/**
 * 记录某座位已确认催眠状态（幂等：重复 ack 忽略）。
 * 所有在座玩家 ack 后，服务端推进到下一步骤。
 */
export interface AddPiperRevealAckAction {
  type: 'ADD_PIPER_REVEAL_ACK';
  payload: {
    seat: number;
  };
}

// =============================================================================
// 觉醒石像鬼 groupConfirm ACK
// =============================================================================

/**
 * 记录某座位已确认转化状态（幂等：重复 ack 忽略）。
 * 所有在座玩家 ack 后，服务端推进到下一步骤。
 */
export interface AddConversionRevealAckAction {
  type: 'ADD_CONVERSION_REVEAL_ACK';
  payload: {
    seat: number;
  };
}

// =============================================================================
// 丘比特 groupConfirm ACK
// =============================================================================

/**
 * 记录某座位已确认情侣状态（幂等：重复 ack 忽略）。
 * 所有在座玩家 ack 后，服务端推进到下一步骤。
 */
export interface AddCupidLoversRevealAckAction {
  type: 'ADD_CUPID_LOVERS_REVEAL_ACK';
  payload: {
    seat: number;
  };
}

// =============================================================================
// 板子建议动作
// =============================================================================

/** 提交/更新板子建议（每 userId 仅一条，后覆盖前） */
export interface SetBoardNominationAction {
  type: 'SET_BOARD_NOMINATION';
  payload: {
    nomination: BoardNomination;
  };
}

/** 点赞板子建议 */
export interface UpvoteBoardNominationAction {
  type: 'UPVOTE_BOARD_NOMINATION';
  payload: {
    /** 被点赞的建议提交者 userId */
    targetUserId: string;
    /** 点赞者 userId */
    voterUid: string;
  };
}

/** 撤回板子建议 */
export interface WithdrawBoardNominationAction {
  type: 'WITHDRAW_BOARD_NOMINATION';
  payload: {
    userId: string;
  };
}

/** 结算后批量更新 roster level */
export interface UpdateRosterLevelsAction {
  type: 'UPDATE_ROSTER_LEVELS';
  payload: {
    levels: Record<string, number>;
  };
}

// =============================================================================
// StateAction 联合类型
// =============================================================================

export type StateAction =
  // 生命周期
  | InitializeGameAction
  | RestartGameAction
  | UpdateTemplateAction
  // 座位
  | PlayerJoinAction
  | PlayerLeaveAction
  | UpdatePlayerProfileAction
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
  | SetWolfKillOverrideAction
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
  // Debug Bots
  | FillWithBotsAction
  | MarkAllBotsViewedAction
  // 步骤推进截止时间
  | SetStepDeadlineAction
  | ClearStepDeadlineAction
  // 待消费音频队列
  | SetPendingAudioEffectsAction
  | ClearPendingAudioEffectsAction
  // 详细信息分享
  | SetNightReviewAllowedSeatsAction
  // 吹笛者 groupConfirm ACK
  | AddPiperRevealAckAction
  // 觉醒石像鬼 groupConfirm ACK
  | AddConversionRevealAckAction
  // 丘比特 groupConfirm ACK
  | AddCupidLoversRevealAckAction
  // 板子建议
  | SetBoardNominationAction
  | UpvoteBoardNominationAction
  | WithdrawBoardNominationAction
  // 成长结算
  | UpdateRosterLevelsAction;
