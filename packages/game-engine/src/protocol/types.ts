/**
 * Protocol Types - 协议层类型定义（唯一权威）
 *
 * 所有线协议类型的单一真相（Single Source of Truth）。
 * 其他文件必须从此处导入这些类型，禁止从 BroadcastService.ts 导入。
 *
 * ⚠️ 本文件只能包含 type-only imports 和类型定义，禁止任何运行时代码。
 */

// ⚠️ 以现有 repo 导出路径为准
import type { GameStatus } from '../models/GameStatus';
import type { RoleId } from '../models/roles';
import type { SchemaId } from '../models/roles/spec';
import type { CurrentNightResults } from '../resolvers/types';
import type {
  ResolvedRoleRevealAnimation,
  RoleRevealAnimation,
} from '../types/RoleRevealAnimation';

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
// 音频效果（AudioEffect）— 服务端内联推进产物
// =============================================================================

/**
 * 音频效果描述符
 *
 * 服务端内联推进时产生，写入 `BroadcastGameState.pendingAudioEffects`。
 * Host 设备消费队列播放音频，播放完成后 POST `/api/game/night/audio-ack` 清除。
 * Non-Host 设备忽略。
 */
export interface AudioEffect {
  /** 音频资源 key（角色 ID / 'night' / 'night_end'） */
  readonly audioKey: string;
  /** 是否为结束音频（true → audio_end 目录） */
  readonly isEndAudio?: boolean;
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
  /** Debug mode: true if this is a bot placeholder (not a real player) */
  isBot?: boolean;
}

// =============================================================================
// 广播游戏状态（BroadcastGameState）— 线协议
// =============================================================================

export interface BroadcastGameState {
  // --- 核心字段（现有） ---
  roomCode: string;
  hostUid: string;
  status: `${GameStatus}`;
  templateRoles: RoleId[];

  // ⚠️ Phase 1: players 保持 Record<number, ...> 不改，与现有实现一致
  players: Record<number, BroadcastPlayer | null>;

  currentStepIndex: number;
  isAudioPlaying: boolean;

  /**
   * 开牌动画配置（Host 控制）
   * 可为具体动画、none 或 random
   */
  roleRevealAnimation?: RoleRevealAnimation;

  /**
   * 解析后的开牌动画（Host 解析 random 后广播）
   * 客户端使用此字段渲染，不含 random
   */
  resolvedRoleRevealAnimation?: ResolvedRoleRevealAnimation;

  /**
   * 本局开牌动画随机种子（用于 random 解析）
   * Host 在创建房间/重开游戏时生成
   * seed = roomCode + ':' + roleRevealRandomNonce
   */
  roleRevealRandomNonce?: string;

  /** 当前夜晚步骤 ID（来自 NIGHT_STEPS 表驱动单源） */
  currentStepId?: SchemaId;

  // --- Seat-map 字段 ---
  // NOTE: single source of truth for wolf vote is:
  // currentNightResults.wolfVotesBySeat

  // --- 执行状态 ---
  /** 第一夜动作记录（normalizeState 保证非 undefined） */
  actions: ProtocolAction[];

  /** 当前夜晚累积结果（type-only from resolver types，单一真相） */
  currentNightResults?: CurrentNightResults;

  /** 待确认的揭示确认（normalizeState 保证非 undefined） */
  pendingRevealAcks: string[];

  /** 上一夜死亡 */
  lastNightDeaths?: number[];

  // --- 梦魇封锁 ---
  nightmareBlockedSeat?: number;
  wolfKillDisabled?: boolean;

  // --- 机械狼伪装上下文 ---
  /**
   * 机械狼伪装上下文（用于“查验类”resolver 的身份解析）
   *
   * 职责：这是给 Host-only resolvers/engine 用的“计算上下文”，用于统一的
   * `resolveRoleForChecks()`：当某座位的有效身份为 wolfRobot 时，需要把它
   * 解释为 `disguisedRole`，从而影响预言家/通灵师/石像鬼等的查验结果。
   *
   * 注意：
   * - 这是 BroadcastGameState 的一部分（公开广播），但 UI 一般不直接依赖它；
   *   UI 只从 schema + BroadcastGameState 渲染，并按 myRole 过滤展示。
   * - 禁止在 engine 之外维护平行的“伪装身份”状态，避免 Host/Player drift。
   */
  wolfRobotContext?: {
    /** The seat wolfRobot learned from */
    learnedSeat: number;
    /** The role wolfRobot is disguised as (learned target's role) */
    disguisedRole: RoleId;
  };

  // --- 角色特定上下文（全部公开，UI 按 myRole 过滤） ---
  /** Witch turn context - only display to witch via UI filter */
  witchContext?: {
    killedSeat: number;
    canSave: boolean;
    canPoison: boolean;
  };

  /** Seer reveal result - only display to seer via UI filter */
  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  /** MirrorSeer reveal result - only display to mirrorSeer via UI filter (inverted) */
  mirrorSeerReveal?: {
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

  /** PureWhite reveal result - only display to pureWhite via UI filter */
  pureWhiteReveal?: {
    targetSeat: number;
    result: string;
  };

  /** WolfWitch reveal result - only display to wolfWitch via UI filter */
  wolfWitchReveal?: {
    targetSeat: number;
    result: string;
  };

  /**
   * 机械狼学习结果（公开广播的“事实结果”）
   *
   * 职责：描述 wolfRobot 在 wolfRobotLearn 这一步的计算结果（学了谁/学到什么）。
   * 这是单一真相（Single source of truth）：Host 执行 resolver 后写入并广播。
   *
   * UI：所有客户端都会收到，但必须按 myRole 过滤，只对 wolfRobot（或 Host UI）展示。
   */
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

  /**
   * Gate（流程前置条件）：机械狼学到猎人后，必须“查看状态”才能推进夜晚
   *
   * 职责：这是 Host-authoritative 的流程 gate。
   * - Host 写入：当 `wolfRobotReveal.learnedRoleId === 'hunter'` 时设置为 false（需要查看）。
   * - Host 清除：收到玩家确认消息 `WOLF_ROBOT_HUNTER_STATUS_VIEWED` 后设置为 true。
   * - NightFlow：若 gate 未清除，Host 必须拒绝推进（防止 authority split）。
   * - UI：仅根据 schema + BroadcastGameState 展示底部按钮，不允许 UI 本地状态机自推导。
   */
  wolfRobotHunterStatusViewed?: boolean;

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
    /** Unique id for this rejection event (UI uses it for dedupe). */
    rejectionId: string;
  };

  // --- 狼人投票倒计时 ---
  /**
   * 全部狼人投票完成后的截止时间（epoch ms）。
   *
   * Host 在所有狼人投票完成时写入 `Date.now() + WOLF_VOTE_COUNTDOWN_MS`，
   * 改票/撤回导致重新全投完时重置，撤回导致未全投完时清除。
   * Timer 是 best-effort 触发器，此字段是权威时间戳。
   */
  wolfVoteDeadline?: number;

  // --- 待消费音频队列（服务端内联推进产物） ---
  /**
   * 服务端推进时写入的待播放音频列表。
   *
   * Host 设备消费并按序播放，播放完成后 POST `/api/game/night/audio-ack` 清除。
   * Non-Host 设备忽略。
   *
   * 生命周期：
   * - 写入：服务端内联推进（action → advance/endNight）时从 sideEffects 提取
   * - 消费：Host 设备监听 state 变化 → 检测非空 → 播放 → POST ack 清除
   * - 清除：`/api/game/night/audio-ack` 清空数组 + 设 isAudioPlaying=false
   */
  pendingAudioEffects?: AudioEffect[];

  // --- UI Hints（Host 广播驱动，UI 只读展示） ---
  /**
   * UI hint for current step - Host writes, UI reads only (no derivation).
   *
   * 职责：允许 Host 向特定角色广播"提前提示"（如被封锁/狼刀被禁用）。
   * Host 通过 resolver/handler 判定后写入，进入下一 step 或阻断解除时清空。
   *
   * UI 规则：
   * - targetRoleIds 决定"谁能看到"这个 hint（UI 按 myRole 过滤）
   * - bottomAction === 'skipOnly' → 底部只显示 skip
   * - bottomAction === 'wolfEmptyOnly' → 底部只显示空刀
   * - promptOverride 存在 → 替换 actionPrompt 文案
   * - message 用于 banner/提示/按钮文案
   */
  ui?: {
    currentActorHint?: {
      kind: 'blocked_by_nightmare' | 'wolf_kill_disabled';
      /**
       * 哪些角色能看到这个 hint（UI 按 myRole 过滤）
       * - blocked_by_nightmare: [被封锁角色的 roleId]
       * - wolf_kill_disabled: 所有狼角色（wolf, darkWolfKing, wolfRobot, wolfQueen, etc.）
       */
      targetRoleIds: RoleId[];
      message: string;
      bottomAction?: 'skipOnly' | 'wolfEmptyOnly';
      promptOverride?: { title?: string; text?: string };
    } | null;
  };

  // --- Debug 模式 ---
  /**
   * Debug mode settings (optional, for development/testing only).
   * When debugMode.botsEnabled is true, bot-related UI and features are enabled.
   */
  debugMode?: {
    /** Whether bot placeholder mode is enabled */
    botsEnabled: boolean;
  };

  /**
   * 双预言家标签映射（当 seer + mirrorSeer 同时在模板中时生成）
   *
   * 随机分配“1号预言家”和“2号预言家”标签，玩家无法知晓哪个是真预言家。
   * 在 ASSIGN_ROLES 时生成，用于音频/显示名/角色卡。
   */
  seerLabelMap?: Readonly<Record<string, number>>;
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
      killedSeat?: number;
      stepId?: SchemaId;
    }
  | { type: 'NIGHT_END'; deaths: number[] }
  | { type: 'PLAYER_JOINED'; seat: number; player: BroadcastPlayer }
  | { type: 'PLAYER_LEFT'; seat: number }
  | { type: 'GAME_RESTARTED' }
  | { type: 'SEAT_REJECTED'; seat: number; requestUid: string; reason: 'seat_taken' }
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
  | { type: 'SNAPSHOT_REQUEST'; requestId: string; uid: string; lastRevision?: number }
  /** WolfRobot learned hunter: player viewed status, Host clears gate */
  | { type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED'; seat: number };
