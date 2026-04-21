/**
 * Game Control Handler - 游戏控制处理器（Host-only）
 *
 * 职责：
 * - 处理 ASSIGN_ROLES / START_NIGHT / RESTART_GAME / UPDATE_TEMPLATE intent
 * - 角色分配逻辑（shuffle + 写入 state）
 * - NightPlan 构建（基于 template 生成步骤计划）
 *
 * 导出角色分配、NightPlan 构建及 StateAction 列表构建逻辑，不包含 IO（网络 / 音频 / Alert），
 * 不直接修改 state（返回 StateAction 列表由 reducer 执行）。
 */

import { GameStatus, type RoleId } from '../../models';
import { buildNightPlan, getStepSpec } from '../../models/roles/spec';
import type { RoleSpec } from '../../models/roles/spec/roleSpec.types';
import { WOLF_KILL_OVERRIDE_TEXTS } from '../../models/roles/spec/schema.types';
import { ROLE_SPECS } from '../../models/roles/spec/specs';
import { Faction } from '../../models/roles/spec/types';
import { getBottomCardCount, getBottomCardRoleId, getPlayerCount } from '../../models/Template';
import type { Player, RosterEntry } from '../../protocol/types';
import { resolveSeerAudioKey } from '../../utils/audioKeyOverride';
import { formatSeat } from '../../utils/formatSeat';
import { randomHex } from '../../utils/id';
import { shuffleArray } from '../../utils/shuffle';
import type {
  AssignRolesIntent,
  BoardNominateIntent,
  BoardUpvoteIntent,
  BoardWithdrawIntent,
  FillWithBotsIntent,
  MarkAllBotsViewedIntent,
  RestartGameIntent,
  SetRoleRevealAnimationIntent,
  ShareNightReviewIntent,
  StartNightIntent,
  UpdateTemplateIntent,
} from '../intents/types';
import type {
  AssignRolesAction,
  EndNightAction,
  FillWithBotsAction,
  MarkAllBotsViewedAction,
  RestartGameAction,
  SetBoardNominationAction,
  SetNightReviewAllowedSeatsAction,
  SetRoleRevealAnimationAction,
  SetWolfKillOverrideAction,
  StartNightAction,
  StateAction,
  UpdateTemplateAction,
  UpvoteBoardNominationAction,
  WithdrawBoardNominationAction,
} from '../reducer/types';
import type { GameState } from '../store/types';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import type { HandlerContext, HandlerResult, SideEffect } from './types';
import { handlerError, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';
import { maybeCreateWitchContextAction } from './witchContext';

// ---------------------------------------------------------------------------
// Shared guard: state must exist
// ---------------------------------------------------------------------------
type StateGuardOk = { ok: true; state: GameState };
type StateGuardFail = { ok: false; result: HandlerResult };

function requireState(context: HandlerContext): StateGuardOk | StateGuardFail {
  if (!context.state) {
    return { ok: false, result: handlerError('no_state') };
  }
  return { ok: true, state: context.state };
}

/**
 * 处理分配角色（仅 seated → assigned）
 *
 * - 前置条件：status === GameStatus.Seated
 * - 洗牌分配角色
 * - 设置 hasViewedRole = false
 * - status → GameStatus.Assigned
 * - 广播 STATE_UPDATE
 */
export function handleAssignRoles(
  _intent: AssignRolesIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: game status must be GameStatus.Seated
  if (state.status !== GameStatus.Seated) {
    return handlerError('invalid_status');
  }

  const seatCount = Object.keys(state.players).length;
  const bottomCardRoleId = getBottomCardRoleId(state.templateRoles);
  const bottomCardCount = getBottomCardCount(state.templateRoles);
  const expectedRoleCount = seatCount + bottomCardCount;

  // 验证：模板角色数量与座位数匹配（含底牌）
  if (state.templateRoles.length !== expectedRoleCount) {
    return handlerError('role_count_mismatch');
  }

  let seatedRoles: RoleId[];
  let bottomCards: RoleId[] | undefined;
  let treasureMasterSeat: number | undefined;
  let thiefSeat: number | undefined;
  let cupidSeat: number | undefined;

  if (bottomCardRoleId) {
    // 底牌角色在场：shuffle → 前 seatCount 分配座位 + 后 N 为底牌
    const result = shuffleWithBottomCardConstraints(
      state.templateRoles,
      seatCount,
      bottomCardRoleId,
    );
    seatedRoles = result.seatedRoles;
    bottomCards = result.bottomCards;
  } else {
    seatedRoles = shuffleArray([...state.templateRoles]);
  }

  // Assign seated roles to seats
  const assignments: Record<number, RoleId> = {};
  const seats = Object.keys(state.players).map((s) => Number.parseInt(s, 10));

  for (let i = 0; i < seats.length; i++) {
    assignments[seats[i]] = seatedRoles[i];
  }

  // 记录底牌角色/丘比特座位
  if (bottomCardRoleId) {
    for (const [seatStr, roleId] of Object.entries(assignments)) {
      if (roleId === 'treasureMaster') {
        treasureMasterSeat = Number.parseInt(seatStr, 10);
      } else if (roleId === 'thief') {
        thiefSeat = Number.parseInt(seatStr, 10);
      }
    }
  }
  // 记录丘比特座位（无论是否有底牌角色）
  for (const [seatStr, roleId] of Object.entries(assignments)) {
    if (roleId === 'cupid') {
      cupidSeat = Number.parseInt(seatStr, 10);
      break;
    }
  }

  // 当多个 seerFamily 标签角色同时在场，随机分配编号标签
  // 注意：需要用全部角色（含底牌）来判断 seer 家族
  const allRoles = bottomCards ? [...seatedRoles, ...bottomCards] : seatedRoles;
  const seerLikeRoles = [
    ...new Set(
      allRoles.filter((r) => {
        if (r === 'seer') return true;
        const spec = ROLE_SPECS[r as keyof typeof ROLE_SPECS] as RoleSpec | undefined;
        return spec?.groups?.includes('seerFamily') === true;
      }),
    ),
  ];
  let seerLabelMap: Readonly<Record<string, number>> | undefined;
  if (seerLikeRoles.length >= 2) {
    const labels = shuffleArray(Array.from({ length: seerLikeRoles.length }, (_, i) => i + 1));
    seerLabelMap = Object.fromEntries(seerLikeRoles.map((r, i) => [r, labels[i]]));
  }

  // 只产生 ASSIGN_ROLES action（不产生 START_NIGHT）
  const assignRolesAction: AssignRolesAction = {
    type: 'ASSIGN_ROLES',
    payload: {
      assignments,
      ...(seerLabelMap ? { seerLabelMap } : {}),
      ...(bottomCards ? { bottomCards, treasureMasterSeat, thiefSeat } : {}),
      ...(cupidSeat !== undefined ? { cupidSeat } : {}),
    },
  };

  return handlerSuccess([assignRolesAction], STANDARD_SIDE_EFFECTS);
}

// ---------------------------------------------------------------------------
// Bottom card shuffle with constraints (rejection sampling)
// ---------------------------------------------------------------------------

/** 最大重试次数（底牌约束满足概率极高，几乎不需重试） */
const MAX_SHUFFLE_RETRIES = 100;

/**
 * Shuffle roles and split into seated + bottom cards with constraints.
 *
 * Bottom card constraints vary by role:
 * - treasureMaster: 最多1只普通狼人；不全神；不全民；无技能狼
 * - thief: ≤1张狼队伍牌（含技能狼）；不能2张都是狼队伍牌
 */
function shuffleWithBottomCardConstraints(
  templateRoles: readonly RoleId[],
  seatCount: number,
  bottomCardRoleId: RoleId,
): { seatedRoles: RoleId[]; bottomCards: RoleId[] } {
  for (let attempt = 0; attempt < MAX_SHUFFLE_RETRIES; attempt++) {
    const shuffled = shuffleArray([...templateRoles]);
    const seated = shuffled.slice(0, seatCount);
    const bottom = shuffled.slice(seatCount);

    if (validateBottomCards(bottom, bottomCardRoleId)) {
      return { seatedRoles: seated, bottomCards: bottom };
    }
  }

  // Should never happen given the loose constraints
  throw new Error(
    `[FAIL-FAST] Failed to satisfy bottom card constraints after ${MAX_SHUFFLE_RETRIES} retries`,
  );
}

/**
 * Validate bottom card constraints (parameterized by bottom card role).
 */
function validateBottomCards(cards: RoleId[], bottomCardRoleId: RoleId): boolean {
  // Common: bottom card role itself must not be in bottom cards
  if (cards.includes(bottomCardRoleId)) return false;

  // Common: cupid must not be in bottom cards
  if (cards.includes('cupid' as RoleId)) return false;

  if (bottomCardRoleId === 'treasureMaster') {
    return validateTreasureMasterBottomCards(cards);
  }
  if (bottomCardRoleId === 'thief') {
    return validateThiefBottomCards(cards);
  }
  return true;
}

/** TreasureMaster 底牌约束：S21 严格 1Wolf(普通狼人) + 1God + 1Villager */
function validateTreasureMasterBottomCards(cards: RoleId[]): boolean {
  const factions = cards.map((r) => {
    const spec = ROLE_SPECS[r] as RoleSpec | undefined;
    return spec?.faction;
  });
  const wolfCount = factions.filter((f) => f === Faction.Wolf).length;
  const godCount = factions.filter((f) => f === Faction.God).length;
  const villagerCount = factions.filter((f) => f === Faction.Villager).length;
  if (wolfCount !== 1 || godCount !== 1 || villagerCount !== 1) return false;
  // 狼阵营底牌只能是普通狼人，不含技能狼
  const wolfCard = cards.find(
    (r) => (ROLE_SPECS[r] as RoleSpec | undefined)?.faction === Faction.Wolf,
  );
  return wolfCard === 'wolf';
}

/** Thief 底牌约束 */
function validateThiefBottomCards(cards: RoleId[]): boolean {
  // ≤1 张狼队伍牌（含技能狼）
  const wolfFactionCount = cards.filter((r) => {
    const spec = ROLE_SPECS[r] as RoleSpec | undefined;
    return spec?.faction === Faction.Wolf;
  }).length;
  if (wolfFactionCount > 1) return false;

  return true;
}

/**
 * 处理开始夜晚（ready → ongoing）
 *
 * - 前置条件：status === GameStatus.Ready
 * - 初始化 Night-1 字段
 * - status → GameStatus.Ongoing
 * - 广播 STATE_UPDATE
 *
 * PR3 范围：只做状态初始化，不做音频/advance/action 处理
 */
export function handleStartNight(
  _intent: StartNightIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: status must be GameStatus.Ready
  if (state.status !== GameStatus.Ready) {
    return handlerError('invalid_status');
  }

  // 首步来自 buildNightPlan 表驱动单源（按当前模板角色过滤）
  const nightPlan = buildNightPlan(state.templateRoles, state.seerLabelMap);

  // 无夜晚行动角色（如纯村民板）：跳过夜晚，直接结束，无死亡
  if (nightPlan.steps.length === 0) {
    const endNightAction: EndNightAction = {
      type: 'END_NIGHT',
      payload: { deaths: [] },
    };
    return handlerSuccess([endNightAction], STANDARD_SIDE_EFFECTS);
  }

  const firstStepId = nightPlan.steps[0].stepId;
  const firstStepSpec = getStepSpec(firstStepId);

  // 收集需要返回的 actions
  const actions: StateAction[] = [];

  // Night-1 only: currentStepIndex 从 0 开始（首个步骤）
  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { currentStepIndex: 0, currentStepId: firstStepId },
  };
  actions.push(startNightAction);

  // 使用统一函数检查是否需要设置 witchContext（无狼板子首步为 witchAction 的情况）
  const witchContextAction = maybeCreateWitchContextAction(firstStepId, state);
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // 使用统一函数检查是否需要设置 confirmStatus（首步为 hunterConfirm 的极端情况）
  const confirmStatusAction = maybeCreateConfirmStatusAction(firstStepId, state);
  if (confirmStatusAction) {
    actions.push(confirmStatusAction);
  }

  // 毒师在场：首夜狼人无法袭击（板子级规则）
  if (state.templateRoles.includes('poisoner' as RoleId)) {
    const wolfKillOverrideAction: SetWolfKillOverrideAction = {
      type: 'SET_WOLF_KILL_OVERRIDE',
      payload: {
        override: {
          source: 'poisoner',
          ui: WOLF_KILL_OVERRIDE_TEXTS.poisoner,
        },
      },
    };
    actions.push(wolfKillOverrideAction);
  }

  // 构建 sideEffects：先广播 + 保存，然后播放夜晚开始音频 + 第一步音频
  const sideEffects: SideEffect[] = [
    { type: 'BROADCAST_STATE' },
    { type: 'SAVE_STATE' },
    // 夜晚开始背景音
    { type: 'PLAY_AUDIO', audioKey: 'night', isEndAudio: false },
  ];

  // 添加第一步（通常是狼人）的开始音频
  if (firstStepSpec) {
    sideEffects.push({
      type: 'PLAY_AUDIO',
      audioKey: resolveSeerAudioKey(firstStepSpec.audioKey, state.seerLabelMap),
      isEndAudio: false,
    });
  }

  return handlerSuccess(actions, sideEffects);
}

/**
 * 处理重新开始游戏
 */
export function handleRestartGame(
  _intent: RestartGameIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;

  const action: RestartGameAction = {
    type: 'RESTART_GAME',
    nonce: randomHex(8),
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 处理更新模板（仅“分配角色前”：unseated | seated）
 *
 * Host 编辑房间配置时调用。
 */
export function handleUpdateTemplate(
  intent: UpdateTemplateIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // 验证：仅允许“分配角色前”修改（unseated/seated）。
  // 一旦进入 assigned/ready/ongoing/ended，修改会造成状态机与玩家认知漂移，因此强制要求先 RESTART_GAME。
  const canUpdateTemplateBeforeView =
    state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canUpdateTemplateBeforeView) {
    return handlerError(
      '只能在"分配角色"前修改设置（未入座/已入座阶段）。如果已经不是该阶段，请先点击"重新开始"回到准备阶段再修改。',
    );
  }

  const action: UpdateTemplateAction = {
    type: 'UPDATE_TEMPLATE',
    payload: { templateRoles: intent.payload.templateRoles },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 处理设置开牌动画（Host-only）
 *
 * Host 在房间内选择开牌动画时调用。
 * 前置条件：仅 Host 可操作（无状态阶段限制）
 */
export function handleSetRoleRevealAnimation(
  intent: SetRoleRevealAnimationIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;

  const action: SetRoleRevealAnimationAction = {
    type: 'SET_ROLE_REVEAL_ANIMATION',
    animation: intent.animation,
    nonce: intent.animation === 'random' ? randomHex(8) : undefined,
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 处理填充机器人（Debug-only, Host-only）
 *
 * 前置条件：
 * - status === GameStatus.Unseated
 *
 * 结果：
 * - 为所有空座位创建 bot player（isBot: true）
 * - 设置 debugMode.botsEnabled = true
 */
export function handleFillWithBots(
  _intent: FillWithBotsIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: 只允许在 unseated 阶段填充 bot
  if (state.status !== GameStatus.Unseated) {
    return handlerError('invalid_status');
  }

  // 计算空座位并生成 bot players
  const seatCount = getPlayerCount(state.templateRoles);
  // 只有 player !== null 的座位才算已占用
  const occupiedSeats = new Set(
    Object.entries(state.players)
      .filter(([, player]) => player !== null)
      .map(([seat]) => Number.parseInt(seat, 10)),
  );
  const bots: Record<number, Player> = {};
  const botRoster: Record<string, RosterEntry> = {};

  for (let seat = 0; seat < seatCount; seat++) {
    if (!occupiedSeats.has(seat)) {
      const userId = `bot-${seat}`;
      bots[seat] = {
        userId,
        seat: seat,
        hasViewedRole: false,
        isBot: true,
      };
      botRoster[userId] = {
        displayName: `机器人${formatSeat(seat)}`,
      };
    }
  }

  const action: FillWithBotsAction = {
    type: 'FILL_WITH_BOTS',
    payload: { bots, botRoster },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 处理标记所有机器人已查看角色（Debug-only, Host-only）
 *
 * 前置条件：
 * - debugMode.botsEnabled === true
 * - status === GameStatus.Assigned
 *
 * 结果：仅对 isBot === true 的玩家设置 hasViewedRole = true
 */
export function handleMarkAllBotsViewed(
  _intent: MarkAllBotsViewedIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: debugMode.botsEnabled 必须为 true
  if (!state.debugMode?.botsEnabled) {
    return handlerError('debug_not_enabled');
  }

  // Gate: status 必须是 assigned
  if (state.status !== GameStatus.Assigned) {
    return handlerError('invalid_status');
  }

  const action: MarkAllBotsViewedAction = {
    type: 'MARK_ALL_BOTS_VIEWED',
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 处理分享详细信息（Host-only, ended 阶段）
 *
 * Host 选择允许查看「详细信息」的座位列表，写入 state 后广播。
 * 前置条件：仅 Host 可操作 + status === GameStatus.Ended
 */
export function handleShareNightReview(
  intent: ShareNightReviewIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  if (state.status !== GameStatus.Ended) {
    return handlerError('invalid_status');
  }

  const action: SetNightReviewAllowedSeatsAction = {
    type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS',
    allowedSeats: intent.allowedSeats,
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

// =============================================================================
// 板子建议 Handlers（任意已连接玩家）
// =============================================================================

/**
 * 提交板子建议
 *
 * 任何已连接玩家可提交，每人最多一条（后覆盖前）。
 * 前置条件：status === Unseated | Seated
 */
export function handleBoardNominate(
  intent: BoardNominateIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  const canNominate = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canNominate) {
    return handlerError('invalid_status');
  }

  if (intent.payload.roles.length === 0) {
    return handlerError('角色列表不能为空');
  }

  // ── 去重：排序后比较已有 nomination 的 roles ──
  const sortedRoles = [...intent.payload.roles].sort();
  const nominations = state.boardNominations;
  if (nominations) {
    for (const [existingUid, nom] of Object.entries(nominations)) {
      // 同用户 → 走覆盖逻辑（现有行为）
      if (existingUid === intent.payload.userId) continue;
      const existingSorted = [...nom.roles].sort();
      if (
        existingSorted.length === sortedRoles.length &&
        existingSorted.every((r, i) => r === sortedRoles[i])
      ) {
        // 角色完全相同 → 自动投票已有建议
        const action: UpvoteBoardNominationAction = {
          type: 'UPVOTE_BOARD_NOMINATION',
          payload: { targetUserId: existingUid, voterUid: intent.payload.userId },
        };
        return handlerSuccess([action], STANDARD_SIDE_EFFECTS, 'DEDUPLICATED');
      }
    }
  }

  const action: SetBoardNominationAction = {
    type: 'SET_BOARD_NOMINATION',
    payload: {
      nomination: {
        userId: intent.payload.userId,
        displayName: intent.payload.displayName,
        roles: intent.payload.roles,
        upvoters: [],
      },
    },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 点赞板子建议
 *
 * 前置条件：
 * - status === Unseated | Seated
 * - 不能给自己点赞
 * - 目标建议必须存在
 */
export function handleBoardUpvote(
  intent: BoardUpvoteIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  const canVote = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canVote) {
    return handlerError('invalid_status');
  }

  const { targetUserId, voterUid } = intent.payload;

  if (!state.boardNominations?.[targetUserId]) {
    return handlerError('目标建议不存在');
  }

  const action: UpvoteBoardNominationAction = {
    type: 'UPVOTE_BOARD_NOMINATION',
    payload: { targetUserId, voterUid },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 撤回板子建议
 *
 * 仅建议提交者本人可撤回。
 * 前置条件：status === Unseated | Seated + 建议存在
 */
export function handleBoardWithdraw(
  intent: BoardWithdrawIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  const canWithdraw = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canWithdraw) {
    return handlerError('invalid_status');
  }

  if (!state.boardNominations?.[intent.payload.userId]) {
    return handlerError('建议不存在或已被撤回');
  }

  const action: WithdrawBoardNominationAction = {
    type: 'WITHDRAW_BOARD_NOMINATION',
    payload: { userId: intent.payload.userId },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}
