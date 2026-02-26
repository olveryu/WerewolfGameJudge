/**
 * Action Handler - 夜晚行动处理器（Host-only）
 *
 * 职责：
 * - 处理 SUBMIT_ACTION / SUBMIT_WOLF_VOTE / VIEWED_ROLE intent
 * - 调用 resolver 验证行动合法性并计算结果
 * - Nightmare 阻断的统一守卫（single-point guard）
 *
 * 调用 resolver 纯函数并构建 StateAction 列表，不包含 IO（网络 / 音频 / Alert），
 * 不直接修改 state（返回 StateAction 列表由 reducer 执行）。
 */

import { GameStatus } from '../../models/GameStatus';
import type { RevealKind, RoleId } from '../../models/roles';
import { doesRoleParticipateInWolfVote } from '../../models/roles';
import type { SchemaId } from '../../models/roles/spec';
import { BLOCKED_UI_DEFAULTS, NIGHT_STEPS, SCHEMAS } from '../../models/roles/spec';
import type { ProtocolAction } from '../../protocol/types';
import { RESOLVERS } from '../../resolvers';
import type { ActionInput, ResolverContext, ResolverResult } from '../../resolvers/types';
import { newRejectionId } from '../../utils/id';
import { getEngineLogger } from '../../utils/logger';
import type { SubmitActionIntent, SubmitWolfVoteIntent, ViewedRoleIntent } from '../intents/types';
import type {
  ActionRejectedAction,
  ApplyResolverResultAction,
  PlayerViewedRoleAction,
  RecordActionAction,
  StateAction,
} from '../reducer/types';
import type { HandlerContext, HandlerResult } from './types';
import { STANDARD_SIDE_EFFECTS } from './types';

const actionHandlerLog = getEngineLogger().extend('ActionHandler');

/**
 * 非 null 的 state 类型（通过 validation 后使用）
 */
type NonNullState = NonNullable<HandlerContext['state']>;

/**
 * 构建 Resolver 上下文
 */
function buildResolverContext(
  state: NonNullState,
  actorSeat: number,
  actorRoleId: RoleId,
): ResolverContext {
  // 构建 players: seat -> role
  const players = new Map<number, RoleId>();
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.role) {
      players.set(Number.parseInt(seatStr, 10), player.role);
    }
  }

  // FAIL-FAST: currentNightResults must exist when status === GameStatus.Ongoing
  if (!state.currentNightResults) {
    throw new Error('[FAIL-FAST] currentNightResults missing in ongoing state');
  }

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: state.currentNightResults,
    wolfRobotContext: state.wolfRobotContext,
    witchState: state.witchContext,
    gameState: {
      isNight1: true, // Night-1 only
      hypnotizedSeats: state.hypnotizedSeats ?? [],
    },
  };
}

/**
 * 构建 ActionInput
 */
function buildActionInput(
  schemaId: SchemaId,
  target: number | null,
  extra?: Record<string, unknown>,
): ActionInput {
  return {
    schemaId,
    target: target ?? undefined,
    confirmed: extra?.confirmed as boolean | undefined,
    targets: extra?.targets as readonly number[] | undefined,
    stepResults: extra?.stepResults as Record<string, number | null> | undefined,
  };
}

function getActionTimestamp(extra?: Record<string, unknown>): number {
  const maybe = extra?.timestamp;
  return typeof maybe === 'number' ? maybe : Date.now();
}

/**
 * 根据角色获取对应的 SchemaId
 */
function getSchemaIdForRole(role: RoleId): SchemaId | null {
  for (const step of NIGHT_STEPS) {
    if (step.roleId === role) {
      return step.id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Generic reveal handler factories (DRY)
// ---------------------------------------------------------------------------

/** RevealKind keys that use checkResult (seer family) */
type CheckResultRevealKey = 'seerReveal' | 'mirrorSeerReveal' | 'drunkSeerReveal';

/** RevealKind keys that use identityResult (identity-check family) */
type IdentityResultRevealKey =
  | 'psychicReveal'
  | 'gargoyleReveal'
  | 'pureWhiteReveal'
  | 'wolfWitchReveal';

function makeCheckResultRevealHandler(
  key: CheckResultRevealKey,
): (
  result: ResolverResult,
  targetSeat: number,
) => Pick<ApplyResolverResultAction['payload'], CheckResultRevealKey> {
  return (result, targetSeat) => {
    if (result.result?.checkResult) {
      return { [key]: { targetSeat, result: result.result.checkResult } } as Pick<
        ApplyResolverResultAction['payload'],
        CheckResultRevealKey
      >;
    }
    return {} as Pick<ApplyResolverResultAction['payload'], CheckResultRevealKey>;
  };
}

function makeIdentityResultRevealHandler(
  key: IdentityResultRevealKey,
): (
  result: ResolverResult,
  targetSeat: number,
) => Pick<ApplyResolverResultAction['payload'], IdentityResultRevealKey> {
  return (result, targetSeat) => {
    if (result.result?.identityResult) {
      return { [key]: { targetSeat, result: result.result.identityResult } } as Pick<
        ApplyResolverResultAction['payload'],
        IdentityResultRevealKey
      >;
    }
    return {} as Pick<ApplyResolverResultAction['payload'], IdentityResultRevealKey>;
  };
}

/**
 * 处理 WolfRobot reveal
 */
function handleWolfRobotReveal(
  result: ResolverResult,
  targetSeat: number,
): Pick<
  ApplyResolverResultAction['payload'],
  'wolfRobotReveal' | 'wolfRobotHunterStatusViewed' | 'wolfRobotContext'
> {
  if (!result.result?.identityResult) {
    return {};
  }

  const learnedRoleId = result.result.learnedRoleId;
  // FAIL-FAST: learnedRoleId is REQUIRED when wolfRobotReveal is set
  if (!learnedRoleId) {
    throw new Error(
      '[FAIL-FAST] wolfRobotLearn resolver must return learnedRoleId when identityResult is set',
    );
  }

  const payload: Pick<
    ApplyResolverResultAction['payload'],
    'wolfRobotReveal' | 'wolfRobotHunterStatusViewed' | 'wolfRobotContext'
  > = {
    wolfRobotReveal: {
      targetSeat,
      result: result.result.identityResult,
      learnedRoleId,
      canShootAsHunter: result.result.canShootAsHunter,
    },
  };

  // Gate: if learned hunter, set gate to false (requires viewing before advancing)
  if (learnedRoleId === 'hunter') {
    payload.wolfRobotHunterStatusViewed = false;
  }

  // Write wolfRobotContext for disguise during subsequent checks
  if (result.result.learnTarget !== undefined && learnedRoleId) {
    payload.wolfRobotContext = {
      learnedSeat: result.result.learnTarget,
      disguisedRole: learnedRoleId,
    };
  }

  return payload;
}

/**
 * Reveal handler registry — keyed by RevealKind (SSOT).
 * Adding a new RevealKind to schema.types.ts forces a compile error here.
 */
type RevealHandler = (
  result: ResolverResult,
  targetSeat: number,
) => Partial<ApplyResolverResultAction['payload']>;

const REVEAL_HANDLERS: Record<RevealKind, RevealHandler> = {
  seer: makeCheckResultRevealHandler('seerReveal'),
  mirrorSeer: makeCheckResultRevealHandler('mirrorSeerReveal'),
  drunkSeer: makeCheckResultRevealHandler('drunkSeerReveal'),
  psychic: makeIdentityResultRevealHandler('psychicReveal'),
  gargoyle: makeIdentityResultRevealHandler('gargoyleReveal'),
  pureWhite: makeIdentityResultRevealHandler('pureWhiteReveal'),
  wolfWitch: makeIdentityResultRevealHandler('wolfWitchReveal'),
  wolfRobot: handleWolfRobotReveal,
};

/**
 * 从 resolver result 构建 ApplyResolverResultAction payload
 */
function buildRevealPayload(
  result: ResolverResult,
  schemaId: SchemaId,
  targetSeat: number,
): ApplyResolverResultAction['payload'] {
  const payload: ApplyResolverResultAction['payload'] = {
    updates: result.updates,
  };

  // 从 schema.ui.revealKind 查表设置对应的 reveal（schema 是单一真相）
  const schema = SCHEMAS[schemaId];
  const revealKind = (schema?.ui as { revealKind?: RevealKind } | undefined)?.revealKind;
  if (revealKind) {
    const handler = REVEAL_HANDLERS[revealKind];
    if (handler) {
      Object.assign(payload, handler(result, targetSeat));
    }
  }

  return payload;
}

/**
 * 验证前置条件（PR4 完整 gate）
 *
 * Gate 顺序（必须遵守）：
 * 1. no_state
 * 2. invalid_status (must be ongoing)
 * 3. forbidden_while_audio_playing
 * 4. invalid_step (currentStepId 必须存在且匹配)
 * 5. not_seated (actor seat 必须有玩家)
 * 6. schema constraints (由 resolver 处理)
 */
function validateActionPreconditions(
  context: HandlerContext,
  actorSeat: number,
  role: RoleId,
):
  | { valid: false; result: HandlerResult }
  | { valid: true; schemaId: SchemaId; state: NonNullState; schema: (typeof SCHEMAS)[SchemaId] } {
  const { state } = context;

  // Gate 1: no_state
  if (!state) {
    return {
      valid: false,
      result: { success: false, reason: 'no_state', actions: [] },
    };
  }

  // Gate 2: invalid_status (must be ongoing)
  if (state.status !== GameStatus.Ongoing) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  // Gate 3: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      valid: false,
      result: { success: false, reason: 'forbidden_while_audio_playing', actions: [] },
    };
  }

  // Gate 4: invalid_step (currentStepId 必须存在且能在 SCHEMAS 里找到)
  const currentStepId = state.currentStepId;
  if (!currentStepId) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_step', actions: [] },
    };
  }

  const schema = SCHEMAS[currentStepId];
  if (!schema) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_step', actions: [] },
    };
  }

  // Gate 4b: step mismatch - 提交的 role 必须与当前 step 对应
  const expectedSchemaId = getSchemaIdForRole(role);
  // Special case: wolfKill is a meeting step shared by multiple wolf-team roles
  // (e.g. wolf, spiritKnight, wolfQueen...). For this step we validate participation
  // via ROLE_SPECS[*].wolfMeeting.participatesInWolfVote instead of role->schema mapping.
  if (currentStepId === 'wolfKill' && doesRoleParticipateInWolfVote(role)) {
    // ok
  } else if (expectedSchemaId !== currentStepId) {
    return {
      valid: false,
      result: { success: false, reason: 'step_mismatch', actions: [] },
    };
  }

  // Gate 5: not_seated (actor seat 必须有玩家)
  const player = state.players[actorSeat];
  if (!player) {
    return {
      valid: false,
      result: { success: false, reason: 'not_seated', actions: [] },
    };
  }

  // Gate 5b: 玩家角色必须匹配
  if (player.role !== role) {
    return {
      valid: false,
      result: { success: false, reason: 'role_mismatch', actions: [] },
    };
  }

  // Gate 6: resolver 存在性检查
  if (!RESOLVERS[currentStepId]) {
    return {
      valid: false,
      result: { success: false, reason: 'no_resolver', actions: [] },
    };
  }

  return { valid: true, schemaId: currentStepId, state, schema };
}

// =============================================================================
// Nightmare Block Guard (Single-point guard, schema-aware)
// =============================================================================

/**
 * Schema-aware skip 判断
 *
 * 根据 schema.kind 判断本次提交是否为 skip（无实际行动）
 *
 * @param schema - 当前步骤的 schema 定义
 * @param actionInput - 玩家提交的 action input
 * @returns true 表示是 skip，false 表示是实际行动
 */
function isSkipAction(schema: (typeof SCHEMAS)[SchemaId], actionInput: ActionInput): boolean {
  switch (schema.kind) {
    case 'confirm':
      // confirm 类型：confirmed !== true 视为 skip
      return actionInput.confirmed !== true;

    case 'chooseSeat':
    case 'wolfVote':
      // 选择座位类型：target == null 视为 skip
      return actionInput.target === undefined || actionInput.target === null;

    case 'multiChooseSeat':
      // 多目标选择类型：targets 为空视为 skip
      return !actionInput.targets || actionInput.targets.length === 0;

    case 'swap':
      // 交换类型：targets 为空视为 skip
      return !actionInput.targets || actionInput.targets.length === 0;

    case 'compound': {
      // 复合类型：stepResults 为空或所有 step 都是 null 视为 skip
      if (!actionInput.stepResults) return true;
      const results = Object.values(actionInput.stepResults);
      // empty array is considered skip; all-null is also skip
      if (results.length === 0) return true;
      return results.every((v) => v === null);
    }

    case 'groupConfirm':
      // groupConfirm 类型：确认步骤，永远不是 skip
      return false;

    default:
      // 未知类型：安全策略 - 统一视为 non-skip
      // 被 block 时宁可多 reject，避免漏过非法输入
      return false;
  }
}

/**
 * 统一的 nightmare block 校验（单点 guard，schema-aware）
 *
 * 规则（MUST follow）：
 *
 * 1. 被梦魇封锁 = 规则禁止输入，只能跳过
 *    - 被 block 时：只有 skip 是 valid，任何非 skip 行动都必须 reject
 *
 * 2. confirm 类（hunter/darkWolfKing）的 skip 规则：
 *    - 未被 block 时：不允许 skip（confirmed 不是 true 就是非法输入 → reject）
 *    - 被 block 时：只允许 skip（confirmed===true 也要 reject；只有"跳过"才 valid）
 *
 * 3. 其他类（chooseSeat/wolfVote/swap/compound）：
 *    - 被 block 时：只允许 skip
 *    - 未被 block 时：不做额外限制
 *
 * @param seat - 行动者座位
 * @param schema - 当前步骤的 schema 定义
 * @param actionInput - 构建好的 ActionInput（包含所有 payload 字段）
 * @param blockedSeat - 被梦魇封锁的座位
 * @returns rejectReason if rejected, undefined if allowed
 */
function checkNightmareBlockGuard(
  seat: number,
  schema: (typeof SCHEMAS)[SchemaId],
  actionInput: ActionInput,
  blockedSeat: number | undefined,
): string | undefined {
  const isBlocked = blockedSeat === seat;
  const isSkip = isSkipAction(schema, actionInput);

  // confirm 类的特殊规则：未被 block 时不允许 skip
  if (schema.kind === 'confirm') {
    if (!isBlocked && isSkip) {
      return '当前无法跳过，请执行行动';
    }
    if (isBlocked && !isSkip) {
      return BLOCKED_UI_DEFAULTS.message;
    }
    return undefined;
  }

  // 其他 schema：被 block 时只允许 skip
  if (isBlocked && !isSkip) {
    return BLOCKED_UI_DEFAULTS.message;
  }

  return undefined;
}

export { checkNightmareBlockGuard, isSkipAction };

/**
 * 处理提交行动（PR4: SUBMIT_ACTION）
 *
 * Resolver-first：所有业务校验由 resolver 完成
 * Reject 也 broadcast：防 UI pending 卡死
 */
export function handleSubmitAction(
  intent: SubmitActionIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat, role, target, extra } = intent.payload;

  // 验证前置条件（完整 gate 链）
  const validation = validateActionPreconditions(context, seat, role);
  if (!validation.valid) {
    return (validation as { valid: false; result: HandlerResult }).result;
  }
  const { schemaId, state, schema } = validation;

  // 构建 ActionInput（先构建，用于 nightmare guard 和 resolver）
  const actionInput = buildActionInput(
    schemaId,
    target,
    extra as Record<string, unknown> | undefined,
  );

  // Nightmare block guard (single-point guard, schema-aware)
  const blockRejectReason = checkNightmareBlockGuard(
    seat,
    schema,
    actionInput,
    state.currentNightResults?.blockedSeat,
  );
  if (blockRejectReason) {
    return buildRejectionResult(schemaId, blockRejectReason, state, seat);
  }

  // 获取 resolver
  const resolver = RESOLVERS[schemaId]!;

  // 构建上下文
  const resolverContext = buildResolverContext(state, seat, role);

  // 调用 resolver（resolver-first）
  const result = resolver(resolverContext, actionInput);

  if (!result.valid) {
    return buildRejectionResult(schemaId, result.rejectReason, state, seat);
  }

  // 构建成功结果
  return buildSuccessResult(
    schemaId,
    seat,
    target,
    role,
    result,
    extra as Record<string, unknown> | undefined,
  );
}

/**
 * 构建拒绝结果
 */
function buildRejectionResult(
  schemaId: SchemaId,
  rejectReason: string | undefined,
  state: NonNullState,
  seat: number,
): HandlerResult {
  const rejectAction: ActionRejectedAction = {
    type: 'ACTION_REJECTED',
    payload: {
      action: schemaId,
      reason: rejectReason ?? 'invalid_action',
      targetUid:
        state.players[seat]?.uid ??
        (() => {
          throw new Error(`[FAIL-FAST] ACTION_REJECTED: no player at seat ${seat}`);
        })(),
      rejectionId: newRejectionId(),
    },
  };

  return {
    success: false,
    reason: rejectReason,
    actions: [rejectAction],
    sideEffects: [{ type: 'BROADCAST_STATE' }],
  };
}

/**
 * 构建成功结果
 */
function buildSuccessResult(
  schemaId: SchemaId,
  seat: number,
  target: number | null,
  role: RoleId,
  result: ResolverResult,
  extra?: Record<string, unknown>,
): HandlerResult {
  const protocolAction: ProtocolAction = {
    schemaId,
    actorSeat: seat,
    targetSeat: target ?? undefined,
    timestamp: getActionTimestamp(extra),
  };

  const recordAction: RecordActionAction = {
    type: 'RECORD_ACTION',
    payload: { action: protocolAction },
  };

  const actions: StateAction[] = [recordAction];

  // Only attach reveal payload when we have a concrete target.
  // (Avoid fabricating seat=0 when target is null.)
  if (target !== null && (result.updates || result.result)) {
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: buildRevealPayload(result, schemaId, target),
    });

    // 如果 schema 定义了 revealKind，需要弹窗确认，添加 pending ack 阻塞推进
    // ackKey 使用 schemaId 作为稳定标识符（避免 revealKind 文案变更导致问题）
    const schema = SCHEMAS[schemaId];
    const revealKind = (schema?.ui as { revealKind?: string } | undefined)?.revealKind;
    if (revealKind) {
      actions.push({
        type: 'ADD_REVEAL_ACK',
        payload: { ackKey: schemaId }, // 使用 schemaId 而不是 revealKind 字符串
      });
    }
  } else if (result.updates) {
    // Updates can exist without a target (e.g. skip/blocked); keep them.
    actions.push({
      type: 'APPLY_RESOLVER_RESULT',
      payload: { updates: result.updates },
    });
  }

  return {
    success: true,
    actions,
    sideEffects: STANDARD_SIDE_EFFECTS,
  };
}

/**
 * 处理狼人投票
 *
 * PR5: WOLF_VOTE (Night-1 only)
 * 完整 gate 链：
 * 1. host_only
 * 2. no_state
 * 3. invalid_status (must be ongoing)
 * 4. forbidden_while_audio_playing
 * 5. invalid_step (currentStepId 必须存在且对应 wolfVote schema)
 * 6. not_seated (voter seat 必须有玩家)
 * 7. not_wolf_participant (voter 必须参与 wolf vote)
 * 8. invalid_target (target 必须在 players 范围内)
 * 9. target_not_seated (target seat 必须有玩家)
 *
 * 注意：不做 notSelf/notWolf 限制（中立裁判规则）
 */
export function handleSubmitWolfVote(
  intent: SubmitWolfVoteIntent,
  context: HandlerContext,
): HandlerResult {
  const { seat, target } = intent.payload;

  const normalizeWolfVoteRejection = (
    result: HandlerResult,
    mappedReason?: string,
  ): HandlerResult => {
    if (result.success) return result;

    const state = context.state;
    const voterUid = state?.players?.[seat]?.uid;
    if (!state || !voterUid) return result;

    const reason = mappedReason ?? result.reason ?? 'invalid_action';

    const rejectAction: ActionRejectedAction = {
      type: 'ACTION_REJECTED',
      payload: {
        // Use the stable schemaId for wolf vote (single source of truth)
        // so UI dedupe and logs key off a consistent identifier.
        action: 'wolfKill',
        reason,
        targetUid: voterUid,
        rejectionId: newRejectionId(),
      },
    };

    return {
      success: false,
      reason,
      actions: [rejectAction],
      sideEffects: [{ type: 'BROADCAST_STATE' }],
    };
  };

  // NOTE: "Delete the custom path" big step (without changing wire protocol):
  // We keep SUBMIT_WOLF_VOTE intent on-wire, but validate it through the existing
  // schema-first resolver pipeline by delegating to `wolfKillResolver`.
  // This reduces drift risk: immune / empty knife / other invariants now live in one place.
  //
  // IMPORTANT: We still keep one extra gate here:
  // - not_wolf_participant (meeting-specific rule)
  // Everything else is validated by `handleSubmitAction` (state/status/audio/step/seat/role).

  // Guards needed to safely resolve voterRole (gates 1-3 duplicated from
  // validateActionPreconditions — acceptable since they're trivial checks
  // and keeping the canonical gate order avoids confusing rejection reasons).
  if (!context.state) {
    return normalizeWolfVoteRejection({ success: false, reason: 'no_state', actions: [] });
  }
  if (context.state.status !== GameStatus.Ongoing) {
    return normalizeWolfVoteRejection({ success: false, reason: 'invalid_status', actions: [] });
  }
  if (context.state.isAudioPlaying) {
    return normalizeWolfVoteRejection({
      success: false,
      reason: 'forbidden_while_audio_playing',
      actions: [],
    });
  }

  // Early return: voter seat must have a player with a role.
  const voterRole = context.state.players[seat]?.role;
  if (!voterRole) {
    return normalizeWolfVoteRejection({ success: false, reason: 'not_seated', actions: [] });
  }

  // Remaining preconditions (step → seat → role match).
  const validation = validateActionPreconditions(context, seat, voterRole);
  if (!validation.valid) {
    return normalizeWolfVoteRejection(
      (validation as { valid: false; result: HandlerResult }).result,
    );
  }

  // Meeting-specific gate: voter must participate in wolf vote.
  if (!doesRoleParticipateInWolfVote(voterRole)) {
    actionHandlerLog.warn('[wolfVote] not_wolf_participant', {
      seat,
      voterRole,
      currentStepId: context.state?.currentStepId ?? null,
    });
    return normalizeWolfVoteRejection({
      success: false,
      reason: 'not_wolf_participant',
      actions: [],
    });
  }

  // Delegate to the unified action pipeline with the voter's *actual* role.
  const delegateIntent: SubmitActionIntent = {
    type: 'SUBMIT_ACTION',
    payload: {
      seat,
      role: voterRole,
      // wolfKill supports empty knife via target = null.
      // Map target=-1 to null for empty knife.
      target: target === -1 ? null : target,
    },
  };

  const delegated = handleSubmitAction(delegateIntent, context);
  if (!delegated.success) {
    // Broadcast whatever the unified pipeline produced.
    return normalizeWolfVoteRejection(delegated);
  }

  // IMPORTANT:
  // Do NOT write wolfVotesBySeat here.
  // The single source of truth for wolf vote results is the resolver pipeline
  // (wolfKillResolver -> APPLY_RESOLVER_RESULT(updates)).
  // If we "optimistically" write wolfVotesBySeat here, a later resolver rejection
  // (e.g. immuneToWolfKill target) would still lock the UI as "already voted".
  return delegated;
}

/**
 * 处理查看角色
 *
 * PR2: VIEWED_ROLE (assigned → ready)
 * - 前置条件：state != null、status === GameStatus.Assigned
 * - 标记 seat 的 hasViewedRole = true
 * - 当所有玩家都 viewed 时，reducer 会将 status → GameStatus.Ready
 */
export function handleViewedRole(intent: ViewedRoleIntent, context: HandlerContext): HandlerResult {
  const { seat } = intent.payload;
  const { state, mySeat } = context;

  // 验证：座位所有权（Host 可标记任意座位用于 bot 控制；非 Host 只能标记自己的座位）
  if (state?.hostUid !== context.myUid && mySeat !== seat) {
    return {
      success: false,
      reason: 'not_my_seat',
      actions: [],
    };
  }

  // 验证：state 必须存在
  if (!state) {
    return {
      success: false,
      reason: 'no_state',
      actions: [],
    };
  }

  // 验证：status 必须是 GameStatus.Assigned
  if (state.status !== GameStatus.Assigned) {
    return {
      success: false,
      reason: 'invalid_status',
      actions: [],
    };
  }

  // 验证座位有玩家
  if (!state.players[seat]) {
    return {
      success: false,
      reason: 'not_seated',
      actions: [],
    };
  }

  const action: PlayerViewedRoleAction = {
    type: 'PLAYER_VIEWED_ROLE',
    payload: { seat },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: STANDARD_SIDE_EFFECTS,
  };
}
