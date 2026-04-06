/**
 * Protocol Types - 协议层类型定义（唯一权威）
 *
 * 所有线协议类型的单一真相（Single Source of Truth）。
 * 其他文件必须从此处导入这些类型，禁止从 RealtimeService.ts 导入。
 *
 * ⚠️ 本文件只能包含 type-only imports 和类型定义，禁止任何运行时代码。
 */

// ⚠️ 以现有 repo 导出路径为准
import type { DeathReason } from '../engine/DeathCalculator';
import type { GameStatus, RoleId, SchemaId } from '../models';
import type { WolfKillOverride } from '../models/roles/spec/schema.types';
import type { Team } from '../models/roles/spec/types';
import type { CurrentNightResults } from '../resolvers/types';
import type { ResolvedRoleRevealAnimation, RoleRevealAnimation } from '../types';

// =============================================================================
// Confirm Status (discriminated union, role tag)
// =============================================================================

/** 猎人/狼王：仅被狼人袭击或公投放逐出局时可发动 */
export interface ShootConfirmStatus {
  readonly role: 'hunter' | 'darkWolfKing';
  readonly canShoot: boolean;
}

/** 复仇者：阵营取决于影子模仿目标 */
export interface FactionConfirmStatus {
  readonly role: 'avenger';
  readonly faction: Team;
}

/** Discriminated union (discriminant: role). */
export type ConfirmStatus = ShootConfirmStatus | FactionConfirmStatus;

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
 * 服务端内联推进时产生，写入 `GameState.pendingAudioEffects`。
 * Host 设备消费队列播放音频，播放完成后 POST `/game/night/audio-ack` 清除。
 * Non-Host 设备忽略。
 */
export interface AudioEffect {
  /** 音频资源 key（角色 ID / 'night' / 'night_end'） */
  readonly audioKey: string;
  /** 是否为结束音频（true → audio_end 目录） */
  readonly isEndAudio?: boolean;
}

// =============================================================================
// 玩家（Player）— 线协议
// =============================================================================

export interface Player {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  avatarFrame?: string;
  role?: RoleId | null;
  hasViewedRole: boolean;
  /** Debug mode: true if this is a bot placeholder (not a real player) */
  isBot?: boolean;
}

// =============================================================================
// 游戏状态（GameState）— 线协议
// =============================================================================

export interface GameState {
  // --- 核心字段（现有） ---
  roomCode: string;
  hostUid: string;
  status: GameStatus;
  templateRoles: RoleId[];

  // ⚠️ Phase 1: players 保持 Record<number, ...> 不改，与现有实现一致
  players: Record<number, Player | null>;

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

  /** 上一夜死亡原因（座位 → 死因） */
  deathReasons?: Readonly<Record<number, DeathReason>>;

  // --- 噩梦之影封锁 ---
  nightmareBlockedSeat?: number;

  /**
   * Self-contained wolf kill override (nightmare / poisoner).
   * Presence means wolf kill is disabled; ui field provides all display text.
   */
  wolfKillOverride?: WolfKillOverride;

  // --- 机械狼人伪装上下文 ---
  /**
   * 机械狼人伪装上下文（用于“查验类”resolver 的身份解析）
   *
   * 职责：这是给 server-only resolvers/engine 用的“计算上下文”，用于统一的
   * `resolveRoleForChecks()`：当某座位的有效身份为 wolfRobot 时，需要把它
   * 解释为 `disguisedRole`，从而影响预言家/通灵师/石像鬼等的查验结果。
   *
   * 注意：
   * - 这是 GameState 的一部分（公开广播），但 UI 一般不直接依赖它；
   *   UI 只从 schema + GameState 渲染，并按 myRole 过滤展示。
   * - 禁止在 engine 之外维护平行的“伪装身份”状态，避免 server/client drift。
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

  /** DrunkSeer reveal result - only display to drunkSeer via UI filter (random) */
  drunkSeerReveal?: {
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
   * 机械狼人学习结果（公开广播的“事实结果”）
   *
   * 职责：描述 wolfRobot 在 wolfRobotLearn 这一步的计算结果（学了谁/学到什么）。
   * 这是单一真相（Single source of truth）：服务端执行 resolver 后写入并广播。
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
   * Gate（流程前置条件）：机械狼人学到猎人后，必须“查看状态”才能推进夜晚
   *
   * 职责：这是 server-authoritative 的流程 gate。
   * - 服务端写入：当 `wolfRobotReveal.learnedRoleId === 'hunter'` 时设置为 false（需要查看）。
   * - 服务端清除：收到玩家确认消息 `WOLF_ROBOT_HUNTER_STATUS_VIEWED` 后设置为 true。
   * - NightFlow：若 gate 未清除，服务端必须拒绝推进（防止 authority split）。
   * - UI：仅根据 schema + GameState 展示底部按钮，不允许 UI 本地状态机自推导。
   */
  wolfRobotHunterStatusViewed?: boolean;

  /**
   * Confirm status (discriminated by role).
   *
   * - hunter / darkWolfKing → ShootConfirmStatus（canShoot：仅被狼人袭击或放逐时可发动）
   * - avenger → FactionConfirmStatus（faction：好人/狼人/绑定）
   *
   * Only display to that role via UI filter.
   */
  confirmStatus?: ConfirmStatus;

  /** Action rejected feedback - only display to the rejected player via UI filter */
  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string;
    /** Unique id for this rejection event (UI uses it for dedupe). */
    rejectionId: string;
  };

  // --- 步骤推进截止时间 ---
  /**
   * 当前步骤的推进截止时间（epoch ms）。
   *
   * 统一的 deadline-gate：到期后 inlineProgression 允许 advance。
   * 用途：
   * - wolfKill 步骤：全投完后 set (now + WOLF_VOTE_COUNTDOWN_MS)，改票/撤回清除
   * - 底牌空步骤：步入时 set (now + random(5000, 10000))
   *
   * 生命周期：
   * - 设置：engine 内部（wolf vote post-action / unchosen step entry）
   * - 检查：evaluateProgression (inlineProgression.ts)
   * - 清除：ADVANCE_TO_NEXT_ACTION reducer
   */
  stepDeadline?: number;

  // --- 待消费音频队列（服务端内联推进产物） ---
  /**
   * 服务端推进时写入的待播放音频列表。
   *
   * Host 设备消费并按序播放，播放完成后 POST `/game/night/audio-ack` 清除。
   * Non-Host 设备忽略。
   *
   * 生命周期：
   * - 写入：服务端内联推进（action → advance/endNight）时从 sideEffects 提取
   * - 消费：Host 设备监听 state 变化 → 检测非空 → 播放 → POST ack 清除
   * - 清除：`/game/night/audio-ack` 清空数组 + 设 isAudioPlaying=false
   */
  pendingAudioEffects?: AudioEffect[];

  // --- UI Hints（服务端广播驱动，UI 只读展示） ---
  /**
   * UI hint for current step - Server writes, UI reads only (no derivation).
   *
   * 职责：允许 Host 向特定角色广播“提前提示”（如被封锁/袭击被禁用）。
   * Host 通过 resolver/handler 判定后写入，进入下一 step 或阻断解除时清空。
   *
   * UI 规则：
   * - targetRoleIds 决定"谁能看到"这个 hint（UI 按 myRole 过滤）
   * - bottomAction === 'skipOnly' → 底部只显示 skip
   * - bottomAction === 'wolfEmptyOnly' → 底部只显示放弃袭击
   * - promptOverride 存在 → 替换 actionPrompt 文案
   * - message 用于 banner/提示/按钮文案
   */
  ui?: {
    currentActorHint?: {
      kind: 'blocked_by_nightmare' | 'wolf_kill_disabled' | 'wolf_unanimity_required';
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

  /**
   * Host 分享「详细信息」给指定座位的玩家。
   * ended 阶段 Host 选择座位后写入，restart 时清除。
   * UI 判断：若 effectiveSeat 在此列表中，显示「详细信息」按钮。
   */
  nightReviewAllowedSeats?: readonly number[];

  // --- 吹笛者（Piper）---
  /**
   * 被催眠的座位列表（Night-1 only）。
   * 服务端在 piperHypnotize resolver 执行后写入。
   * UI 在 piperHypnotizedReveal 步骤按 mySeat 过滤，显示催眠/未催眠信息。
   */
  hypnotizedSeats?: readonly number[];

  /**
   * piperHypnotizedReveal 步骤中已确认（ack）的座位列表。
   * 所有存活玩家 ack 后，服务端推进到下一步骤。
   * 进入下一夜时重置为空。
   */
  piperRevealAcks?: readonly number[];

  // --- 觉醒石像鬼（Awakened Gargoyle）---
  /**
   * 被转化的座位（Night-1 only）。
   * 服务端在 awakenedGargoyleConvert resolver 执行后写入。
   * UI 在 awakenedGargoyleConvertReveal 步骤按 mySeat 过滤，显示转化/未转化信息。
   */
  convertedSeat?: number;

  /**
   * awakenedGargoyleConvertReveal 步骤中已确认（ack）的座位列表。
   * 所有存活玩家 ack 后，服务端推进到下一步骤。
   * 进入下一夜时重置为空。
   */
  conversionRevealAcks?: readonly number[];

  // --- 盗宝大师（TreasureMaster）---
  /**
   * 底牌（3 张身份牌），发牌时从 15 张模板角色中分出。
   * 仅盗宝大师在场时存在。发牌后不变。
   */
  bottomCards?: readonly RoleId[];

  /**
   * 盗宝大师所在座位号。
   * 发牌时写入，用于 resolver actor 路由和查验伪装。
   */
  treasureMasterSeat?: number;

  /**
   * 盗宝大师选中的底牌身份。
   * treasureMasterChoose resolver 写入。
   * 查验 treasureMasterSeat 时返回此身份。
   */
  treasureMasterChosenCard?: RoleId;

  /**
   * 盗宝大师选卡后的动态阵营。
   * 由底牌组成决定（含狼→Wolf，≥2神→Good，≥2民→Good）。
   * 查验 treasureMasterSeat 的 team 时使用此值。
   */
  effectiveTeam?: Team;

  /**
   * 底牌中有夜晚步骤、但未被盗宝大师选中的角色列表。
   * 这些角色的步骤保留在 nightPlan 中但无人操作（auto-skip）。
   * handleStartNight / treasureMasterChoose resolver 写入。
   */
  bottomCardStepRoles?: readonly RoleId[];

  // --- 盗贼（Thief）---
  /**
   * 盗贼所在座位号。
   * 发牌时写入，用于 resolver actor 路由和查验伪装。
   */
  thiefSeat?: number;

  /**
   * 盗贼选中的底牌身份。
   * thiefChoose resolver 写入。
   * 查验 thiefSeat 时返回此身份。
   */
  thiefChosenCard?: RoleId;

  // --- 丘比特（Cupid）---
  /**
   * 情侣座位对（sorted ascending）。
   * cupidChooseLovers resolver 写入。
   */
  loverSeats?: readonly [number, number];

  /**
   * 丘比特所在座位号。
   * 发牌时写入。
   */
  cupidSeat?: number;

  /**
   * cupidLoversReveal 步骤中已确认（ack）的座位列表。
   * 所有存活玩家 ack 后，服务端推进到下一步骤。
   */
  cupidLoversRevealAcks?: readonly number[];
}

// =============================================================================
// 玩家消息（PlayerMessage）— 仅 integration test 使用
// =============================================================================

/**
 * Integration test 专用 — 模拟 player→server intent 的消息类型
 *
 * 生产环境中玩家通过 HTTP API 提交操作，不使用此类型。
 * 保留供 board integration tests（hostGameContext / hostGameFactory）使用。
 */
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
