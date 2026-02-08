/**
 * Resolver Types (HOST-ONLY)
 *
 * 职责：定义 Resolver 系统的核心类型（ResolverFn / ResolverContext / ResolverResult / CurrentNightResults）
 *       以及 resolveRoleForChecks 等纯函数工具
 *
 * ✅ 允许：类型定义 + 纯函数工具
 * ❌ 禁止：被 UI 代码 import（import boundary test 强制）
 * ❌ 禁止：携带跨夜字段（previousActions / lastNightTarget 等）
 *
 * ⚠️ WARNING: These types and the resolver implementations MUST NOT be imported by UI code.
 * Use the import boundary test in __tests__/import-boundary.test.ts to enforce this.
 */

import type { RoleId } from '@/models/roles';
import type { SchemaId } from '@/models/roles/spec/schemas';

/**
 * Current night's accumulated results.
 * Used to pass resolved results between steps (e.g., nightmare block → wolf kill).
 */
export interface CurrentNightResults {
  /**
   * Wolf votes during the wolf meeting (seat -> target seat).
   *
   * This is the single source of truth for wolf vote tracking.
   * BroadcastGameState MUST include currentNightResults, so this data is public
   * and UI should filter by role.
   */
  readonly wolfVotesBySeat?: Readonly<Record<string, number>>;

  /** Seat blocked by nightmare (skill is disabled) */
  readonly blockedSeat?: number;

  /**
   * Whether wolf kill is disabled for this night.
   * Set to true if nightmare blocks a wolf.
   */
  readonly wolfKillDisabled?: boolean;

  /** Seat protected by guard */
  readonly guardedSeat?: number;

  /** Seat saved by witch */
  readonly savedSeat?: number;

  /** Seat poisoned by witch */
  readonly poisonedSeat?: number;

  /** Seat dreaming (protected by dreamcatcher) */
  readonly dreamingSeat?: number;

  /** Seats swapped by magician */
  readonly swappedSeats?: readonly [number, number];
}

/** Context passed to resolvers */
export interface ResolverContext {
  /** Current player's seat (0-based) */
  readonly actorSeat: number;

  /** Player's role ID */
  readonly actorRoleId: RoleId;

  /** All players (seat -> roleId) */
  readonly players: ReadonlyMap<number, RoleId>;

  /** Current night's resolved results so far */
  readonly currentNightResults: CurrentNightResults;

  /** WolfRobot disguise context (if wolfRobot has learned) */
  readonly wolfRobotContext?: WolfRobotContext;

  /** Game state flags */
  readonly gameState?: {
    readonly witchHasAntidote?: boolean;
    readonly witchHasPoison?: boolean;
    readonly isNight1?: boolean;
  };
}

/** Action input from player */
export interface ActionInput {
  readonly schemaId: SchemaId;
  readonly target?: number; // For chooseSeat, wolfVote
  readonly targets?: readonly number[]; // For swap
  readonly stepResults?: Record<string, number | null>; // For compound
  readonly confirmed?: boolean; // For confirm
}

/** Resolver result - role action outcome */
export interface ResolverResult {
  readonly valid: boolean;
  readonly rejectReason?: string;

  /**
   * Updates to CurrentNightResults after this action.
   * Host will merge these updates into the accumulated results.
   */
  readonly updates?: Partial<CurrentNightResults>;

  /** Computed results (role-specific, for feedback to Host/UI) */
  readonly result?: {
    readonly checkResult?: '好人' | '狼人'; // seer
    readonly identityResult?: RoleId; // psychic, gargoyle, wolfRobot (display only)
    readonly savedTarget?: number; // witch save
    readonly poisonedTarget?: number; // witch poison
    readonly guardedTarget?: number; // guard
    readonly blockedTarget?: number; // nightmare
    readonly dreamTarget?: number; // dreamcatcher
    readonly charmTarget?: number; // wolfQueen
    readonly swapTargets?: readonly [number, number]; // magician
    readonly learnTarget?: number; // wolfRobot - target seat
    readonly learnedRoleId?: RoleId; // wolfRobot - learned role (see WolfRobotLearnSuccessResult for strong typing)
    readonly canShootAsHunter?: boolean; // wolfRobot - can shoot as hunter (only set when learned hunter)
    readonly idolTarget?: number; // slacker
  };
}

// =============================================================================
// WolfRobot Resolver 专用类型（编译期强类型保证）
// =============================================================================

/**
 * WolfRobot 成功学习时的 result 类型（learnedRoleId 编译期必填）
 *
 * 这是 wolfRobotLearnResolver 成功学习时必须返回的类型。
 * learnTarget 和 learnedRoleId 在编译期就必须同时存在。
 */
export interface WolfRobotLearnResultPayload {
  readonly learnTarget: number;
  readonly learnedRoleId: RoleId; // 编译期必填
  readonly identityResult: RoleId; // for UI display
  readonly canShootAsHunter?: boolean; // only set when learned hunter
}

/**
 * WolfRobot Resolver 的专用返回类型
 *
 * 为了向后兼容现有测试代码（不先检查 valid），
 * 此类型继承 ResolverResult，所有字段都是可选的。
 *
 * 真正的编译期类型安全由 resolver 内部 overload 保证。
 */
export interface WolfRobotResolverResult extends ResolverResult {
  // 继承 ResolverResult，向后兼容
  // 编译期保证由 resolver 内部实现
}

/**
 * WolfRobot 成功学习时的 result 类型（向后兼容别名）
 */
export interface WolfRobotLearnResult {
  readonly learnTarget: number;
  readonly learnedRoleId: RoleId; // 必须存在
  readonly identityResult?: RoleId;
  readonly canShootAsHunter?: boolean;
}

/**
 * 类型守卫：检查 resolver result 是否包含有效的 wolfRobot 学习结果
 *
 * 合约：当 learnTarget 存在时，learnedRoleId 必须存在
 */
export function isWolfRobotLearnResult(
  result: ResolverResult['result'] | undefined,
): result is WolfRobotLearnResult {
  if (!result) return false;
  return typeof result.learnTarget === 'number' && typeof result.learnedRoleId === 'string';
}

/**
 * 断言 wolfRobot resolver result 包含 learnedRoleId
 *
 * 用于 Host 层：当确定是 wolfRobot 成功学习时，断言 learnedRoleId 存在
 * @throws TypeError 如果 learnedRoleId 缺失（违反合约）
 *
 * NOTE: 由于 WolfRobotResolverResult 类型设计，编译期应该已经保证不会缺字段。
 * 此函数保留作为 runtime 防线。
 */
export function assertWolfRobotLearnedRoleId(
  result: ResolverResult['result'] | undefined,
  context: string,
): asserts result is WolfRobotLearnResult {
  if (!result) {
    throw new TypeError(`[${context}] wolfRobot result is undefined`);
  }
  if (typeof result.learnTarget !== 'number') {
    throw new TypeError(`[${context}] wolfRobot result missing learnTarget`);
  }
  if (typeof result.learnedRoleId !== 'string') {
    throw new TypeError(
      `[${context}] wolfRobot result missing learnedRoleId - type contract violation`,
    );
  }
}

/** Resolver function signature */
export type ResolverFn = (context: ResolverContext, input: ActionInput) => ResolverResult;

/** Resolver registry type */
export type ResolverRegistry = Partial<Record<SchemaId, ResolverFn>>;

// =============================================================================
// Magician Swap Helpers (HOST-ONLY)
// =============================================================================

/**
 * Get the effective role at a seat after magician swap.
 *
 * If magician swapped seats A and B, checking seat A returns B's role and vice versa.
 * This is for "check" actions (seer, psychic, gargoyle) that reveal identity.
 *
 * NOTE: Does NOT affect physical seat or death calculation - only identity checks.
 *
 * @param seat - The seat to check
 * @param players - Original seat->roleId map
 * @param swappedSeats - [seatA, seatB] if magician swapped, undefined otherwise
 * @returns The role at the effective seat (after swap if applicable)
 */
export function getRoleAfterSwap(
  seat: number,
  players: ReadonlyMap<number, RoleId>,
  swappedSeats?: readonly [number, number],
): RoleId | undefined {
  if (!swappedSeats) {
    return players.get(seat);
  }

  const [a, b] = swappedSeats;
  if (seat === a) {
    return players.get(b);
  }
  if (seat === b) {
    return players.get(a);
  }
  return players.get(seat);
}

// =============================================================================
// WolfRobot Disguise Context (for resolveRoleForChecks)
// =============================================================================

/**
 * WolfRobot disguise context from BroadcastGameState.
 * Passed to resolvers for disguise-aware identity checks.
 */
export interface WolfRobotContext {
  readonly learnedSeat: number;
  readonly disguisedRole: RoleId;
}

// =============================================================================
// Unified Role Resolution for Checks (HOST-ONLY, Single Source of Truth)
// =============================================================================

/**
 * Resolve the effective role at a seat for check/reveal actions.
 *
 * This is the SINGLE SOURCE OF TRUTH for identity resolution during checks.
 * All resolvers (seer, psychic, gargoyle) MUST use this function.
 *
 * Resolution order:
 * 1. Apply magician swap (if any)
 * 2. If the effective role is 'wolfRobot' AND wolfRobotContext.disguisedRole exists,
 *    return the disguised role instead.
 * 3. Otherwise return the effective role.
 *
 * @param context - The resolver context (contains players, currentNightResults, wolfRobotContext)
 * @param seat - The seat to check
 * @returns The role to use for checks (after swap and disguise)
 */
export function resolveRoleForChecks(context: ResolverContext, seat: number): RoleId | undefined {
  const { players, currentNightResults, wolfRobotContext } = context;

  // Step 1: Get role after magician swap
  const effectiveRole = getRoleAfterSwap(seat, players, currentNightResults.swappedSeats);
  if (!effectiveRole) {
    return undefined;
  }

  // Step 2: Apply wolfRobot disguise if applicable
  // If the effective role at this seat is wolfRobot and has learned a role, return disguised role
  if (wolfRobotContext && effectiveRole === 'wolfRobot') {
    // WolfRobot at this seat should appear as disguised role
    return wolfRobotContext.disguisedRole;
  }

  return effectiveRole;
}
