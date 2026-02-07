/**
 * GameStateTypes - Pure type definitions for game state
 *
 * This file contains only:
 * - Enums
 * - Interfaces
 * - Type aliases
 * - Pure mapping functions (no side effects)
 *
 * No runtime logic or service dependencies.
 */

import { RoleId } from '../../models/roles';
import type { CurrentNightResults } from '../night/resolvers/types';
import { GameTemplate } from '../../models/Template';
import type { RoleRevealAnimation, ResolvedRoleRevealAnimation } from './RoleRevealAnimation';
import { GameStatus } from '../../models/GameStatus';

// =============================================================================
// Game Status Enum (canonical definition in src/models/GameStatus.ts)
// =============================================================================

export { GameStatus } from '../../models/GameStatus';

// =============================================================================
// Player Types
// =============================================================================

export interface LocalPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role: RoleId | null;
  hasViewedRole: boolean;
  /** Debug mode: true if this is a bot placeholder (not a real player) */
  isBot?: boolean;
}

// =============================================================================
// Game State Types
// =============================================================================

import { RoleAction } from '../../models/actions/RoleAction';

export interface LocalGameState {
  roomCode: string;
  hostUid: string;
  status: GameStatus;
  template: GameTemplate;
  players: Map<number, LocalPlayer | null>; // seat -> player
  actions: Map<RoleId, RoleAction>; // role -> structured action
  wolfVotes: Map<number, number>; // wolf seat -> target
  currentActionerIndex: number;
  /**
   * UI-only: authoritative current stepId broadcast from Host via ROLE_TURN.
   * This is used for schema-driven UI mapping (e.g. NIGHT_STEPS.audioKey display).
   * It must not be used to drive game logic.
   */
  currentStepId?: import('../../models/roles/spec').SchemaId;
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
   */
  roleRevealRandomNonce?: string;
  lastNightDeaths: number[]; // Calculated after night ends
  nightmareBlockedSeat?: number; // Seat blocked by nightmare (skill disabled for this night)
  /**
   * Wolf kill disabled: true if nightmare blocked a wolf.
   * When true, all wolves can only skip during wolf vote phase (no kill this night).
   */
  wolfKillDisabled?: boolean;

  /**
   * Current night's accumulated resolver results.
   * Used to pass resolved results between steps (e.g., nightmare block → wolf kill disabled).
   * Reset at the start of each night.
   */
  currentNightResults: CurrentNightResults;

  // =========================================================================
  // Role-specific context (previously sent via PRIVATE_EFFECT, now public)
  // UI filters what to display based on myRole.
  // =========================================================================

  /** Witch turn context - only display to witch via UI filter */
  witchContext?: {
    killedIndex: number; // seat killed by wolves (-1 = empty kill)
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
    result: string; // specific role name
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
    /**
     * The learned role ID (strict RoleId) - REQUIRED for hunter gate check and disguise.
     * This is never optional when wolfRobotReveal exists.
     */
    learnedRoleId: RoleId;
    canShootAsHunter?: boolean;
  };

  /** Gate: wolfRobot learned hunter and must view status before advancing */
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
    targetUid: string; // which player was rejected
    /** Unique id for this rejection event (UI uses it for dedupe). */
    rejectionId: string;
  };

  // =========================================================================
  // UI Hints（Host 广播驱动，UI 只读展示）
  // =========================================================================

  /**
   * UI hint for current step - Host writes, UI reads only (no derivation).
   *
   * 职责：允许 Host 向特定角色广播"提前提示"（如被封锁/狼刀被禁用）。
   * Host 通过 resolver/handler 判定后写入，进入下一 step 时清空。
   *
   * UI 规则：按 targetRoleIds + myRole 过滤。
   */
  ui?: {
    currentActorHint?: {
      kind: 'blocked_by_nightmare' | 'wolf_kill_disabled';
      targetRoleIds: RoleId[];
      message: string;
      bottomAction?: 'skipOnly' | 'wolfEmptyOnly';
      promptOverride?: { title?: string; text?: string };
    } | null;
  };

  // =========================================================================
  // Debug Mode
  // =========================================================================

  /**
   * Debug mode settings (optional, for development/testing only).
   * When debugMode.botsEnabled is true, bot-related UI and features are enabled.
   */
  debugMode?: {
    /** Whether bot placeholder mode is enabled */
    botsEnabled: boolean;
  };
}

// =============================================================================
// Listener Types
// =============================================================================

export type GameStateListener = (state: LocalGameState) => void;
