/**
 * Protocol Types - 协议层类型定义（唯一权威）
 *
 * 所有线协议类型的单一真相（Single Source of Truth）。
 * 其他文件必须从此处导入这些类型，禁止从 BroadcastService.ts 导入。
 *
 * ⚠️ 本文件只能包含 type-only imports 和类型定义，禁止任何运行时代码。
 */

// ⚠️ 以现有 repo 导出路径为准
import type { RoleId } from '../../models/roles';
import type { SchemaId } from '../../models/roles/spec';
import type { CurrentNightResults } from '../night/resolvers/types';

// =============================================================================
// 协议动作记录（ProtocolAction）— 线安全、稳定
// =============================================================================

/** 用于线传输的动作记录 */
export interface ProtocolAction {
  readonly schemaId: SchemaId;
  readonly actorSeat: number;
  readonly targetSeat?: number;
  readonly timestamp: number;
}

// =============================================================================
// 广播玩家（BroadcastPlayer）
// =============================================================================

export interface BroadcastPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role?: RoleId | null;
  hasViewedRole: boolean;
}

// =============================================================================
// 广播游戏状态（BroadcastGameState）— 线协议
// =============================================================================

export interface BroadcastGameState {
  // --- 核心字段（现有） ---
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleId[];

  // ⚠️ Phase 1: players 保持 Record<number, ...> 不改，与现有实现一致
  players: Record<number, BroadcastPlayer | null>;

  currentActionerIndex: number;
  isAudioPlaying: boolean;

  // --- Seat-map 字段 ---
  /** 狼人投票状态 */
  wolfVoteStatus?: Record<string, boolean>;

  /** 狼人投票（v2 新增）- voterSeat -> targetSeat */
  wolfVotes?: Record<string, number>;

  // --- 执行状态（v2，可选，向后兼容） ---
  /** 第一夜动作记录 */
  actions?: ProtocolAction[];

  /** 当前夜晚累积结果（type-only from resolver types，单一真相） */
  currentNightResults?: CurrentNightResults;

  /** 待确认的揭示确认 */
  pendingRevealAcks?: string[];

  /** 上一夜死亡 */
  lastNightDeaths?: number[];

  // --- 梦魇封锁 ---
  nightmareBlockedSeat?: number;
  wolfKillDisabled?: boolean;

  // --- 角色特定上下文（全部公开，UI 按 myRole 过滤） ---
  /** Witch turn context - only display to witch via UI filter */
  witchContext?: {
    killedIndex: number;
    canSave: boolean;
    canPoison: boolean;
  };

  /** Seer reveal result - only display to seer via UI filter */
  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  /** Psychic reveal result - only display to psychic via UI filter */
  psychicReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Gargoyle reveal result - only display to gargoyle via UI filter */
  gargoyleReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Wolf Robot reveal result - only display to wolf robot via UI filter */
  wolfRobotReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Confirm status for hunter/darkWolfKing - only display to that role via UI filter */
  confirmStatus?: {
    role: 'hunter' | 'darkWolfKing';
    canShoot: boolean;
  };

  /** Action rejected feedback - only display to the rejected player via UI filter */
  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string;
  };
}

// =============================================================================
// 主机广播消息（HostBroadcast）
// =============================================================================

export type HostBroadcast =
  | { type: 'STATE_UPDATE'; state: BroadcastGameState; revision: number }
  | {
      type: 'ROLE_TURN';
      role: RoleId;
      pendingSeats: number[];
      killedIndex?: number;
      stepId?: SchemaId;
    }
  | { type: 'NIGHT_END'; deaths: number[] }
  | { type: 'PLAYER_JOINED'; seat: number; player: BroadcastPlayer }
  | { type: 'PLAYER_LEFT'; seat: number }
  | { type: 'GAME_RESTARTED' }
  | { type: 'SEAT_REJECTED'; seat: number; requestUid: string; reason: 'seat_taken' }
  | {
      type: 'SEAT_ACTION_ACK';
      requestId: string;
      toUid: string;
      success: boolean;
      seat: number;
      reason?: string;
    }
  | {
      type: 'SNAPSHOT_RESPONSE';
      requestId: string;
      toUid: string;
      state: BroadcastGameState;
      revision: number;
    };

// =============================================================================
// 玩家消息（PlayerMessage）
// =============================================================================

export type PlayerMessage =
  | { type: 'REQUEST_STATE'; uid: string }
  | { type: 'JOIN'; seat: number; uid: string; displayName: string; avatarUrl?: string }
  | { type: 'LEAVE'; seat: number; uid: string }
  | { type: 'ACTION'; seat: number; role: RoleId; target: number | null; extra?: unknown }
  | { type: 'WOLF_VOTE'; seat: number; target: number }
  | { type: 'VIEWED_ROLE'; seat: number }
  | { type: 'REVEAL_ACK'; seat: number; role: RoleId; revision: number }
  | {
      type: 'SEAT_ACTION_REQUEST';
      requestId: string;
      action: 'sit' | 'standup';
      seat: number;
      uid: string;
      displayName?: string;
      avatarUrl?: string;
    }
  | { type: 'SNAPSHOT_REQUEST'; requestId: string; uid: string; lastRevision?: number };
