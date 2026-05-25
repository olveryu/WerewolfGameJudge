/**
 * Lifecycle sub-reducers — game setup, player management, template & animation config.
 *
 * Pure functions: (state, action) => newState.
 * No IO, no random, no time dependencies.
 *
 * @pre 每个 reducer 假定调用方已通过 handler 层校验。
 *   - handleRestartGame: @pre action.nonce 必须由 handler 预计算提供
 *   - handleAssignRoles: @pre assignments keys 为有效 seat numbers
 *   - handleUpdateTemplate: @pre newTemplateRoles 为合法模板
 *   - handlePlayerViewedRole: @throws '[FAIL-FAST] PLAYER_VIEWED_ROLE: no player at seat X'
 */

import { GameStatus, getPlayerCount } from '../../models';
import type { Complete } from '../state/normalize';
import type { GameState } from '../store/types';
import type {
  AssignRolesAction,
  FillWithBotsAction,
  InitializeGameAction,
  PlayerJoinAction,
  PlayerLeaveAction,
  PlayerViewedRoleAction,
  RestartGameAction,
  SetBoardNominationAction,
  UpdatePlayerProfileAction,
  UpdateTemplateAction,
  UpvoteBoardNominationAction,
  WithdrawBoardNominationAction,
} from './types';

/** 初始化游戏状态（设置房间号、模板、座位数）。 */
export function handleInitializeGame(state: GameState, action: InitializeGameAction): GameState {
  const { roomCode, hostUserId, templateRoles, totalSeats } = action.payload;
  const players: Record<number, null> = {};
  for (let i = 0; i < totalSeats; i++) {
    players[i] = null;
  }
  return {
    ...state,
    roomCode,
    hostUserId,
    templateRoles,
    players,
    status: GameStatus.Unseated,
    currentStepIndex: -1,
    isAudioPlaying: false,
  };
}

/** 重启游戏（保留玩家，清除角色分配，回到 Seated）。 */
export function handleRestartGame(state: GameState, action: RestartGameAction): GameState {
  // PR9: 对齐 v1 行为 - 保留玩家但清除角色
  // v1: 保持 players 不变，仅清除 role/hasViewedRole
  // v1: 状态重置到 GameStatus.Seated（不是 GameStatus.Unseated）
  const players: Record<number, (typeof state.players)[number]> = {};
  const seatCount = Object.keys(state.players).length;

  for (let i = 0; i < seatCount; i++) {
    const existingPlayer = state.players[i];
    if (existingPlayer) {
      // 保留玩家但清除角色
      players[i] = {
        ...existingPlayer,
        role: null,
        hasViewedRole: false,
      };
    } else {
      players[i] = null;
    }
  }

  // 使用 handler 预计算的 nonce（保证 reducer 纯函数性）
  const newNonce = action.nonce;

  return {
    // ── 保留字段（跨局不变） ──────────────────────────────
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    templateRoles: state.templateRoles,
    debugMode: state.debugMode,
    roster: state.roster,

    // ── 重置字段 ─────────────────────────────────────────
    players,
    status: GameStatus.Seated, // v1: 重置到 seated，不是 unseated
    currentStepIndex: -1, // 与 buildInitialGameState 一致
    isAudioPlaying: false,
    currentStepId: undefined, // 清除夜晚步骤
    actions: [],
    currentNightResults: undefined,
    lastNightDeaths: undefined,
    deathReasons: undefined,
    witchContext: undefined,
    seerReveal: undefined,
    mirrorSeerReveal: undefined,
    drunkSeerReveal: undefined,
    psychicReveal: undefined,
    gargoyleReveal: undefined,
    pureWhiteReveal: undefined,
    wolfWitchReveal: undefined,
    wolfRobotReveal: undefined,
    wolfRobotContext: undefined,
    wolfRobotHunterStatusViewed: undefined,
    confirmStatus: undefined,
    actionRejected: undefined,
    nightmareBlockedSeat: undefined,
    wolfKillOverride: undefined,
    pendingRevealAcks: [],
    pendingAudioEffects: undefined,
    stepDeadline: undefined,
    ui: undefined,
    nightReviewAllowedSeats: undefined,
    seerLabelMap: undefined,
    hypnotizedSeats: [],
    piperRevealAcks: [],
    convertedSeat: undefined,
    conversionRevealAcks: [],

    // 盗宝大师
    bottomCards: undefined,
    treasureMasterSeat: undefined,
    treasureMasterChosenCard: undefined,
    effectiveTeam: undefined,
    bottomCardStepRoles: undefined,

    // 盗贼
    thiefSeat: undefined,
    thiefChosenCard: undefined,

    // 丘比特
    loverSeats: undefined,
    cupidSeat: undefined,
    cupidLoversRevealAcks: [],

    // boardNominations: 保留，重开不清空
    boardNominations: state.boardNominations,

    // ── 重开时更新 nonce ─────────────────────────
    roleRevealRandomNonce: newNonce,
  } satisfies Complete<GameState>;
}

/** 更新游戏模板（调整座位数、保留已入座玩家）。 */
export function handleUpdateTemplate(state: GameState, action: UpdateTemplateAction): GameState {
  const newTemplateRoles = action.payload.templateRoles;
  const newCount = getPlayerCount(newTemplateRoles);
  const oldPlayers = state.players;

  const newPlayers: GameState['players'] = {};

  for (let i = 0; i < newCount; i++) {
    const existingPlayer = oldPlayers[i];
    if (existingPlayer) {
      // 保留玩家，但清除 role（安全兜底，理论上此时不应有 role）
      newPlayers[i] = {
        ...existingPlayer,
        role: null,
        hasViewedRole: false,
      };
    } else {
      // 空座位或扩容新增的座位
      newPlayers[i] = null;
    }
  }
  // 注意：超出 newCount 的座位（缩容）自动不复制，即被踢掉

  // 判断是否全部入座
  const allSeated = Object.values(newPlayers).every((p) => p !== null);

  return {
    ...state,
    templateRoles: newTemplateRoles,
    players: newPlayers,
    status: allSeated ? GameStatus.Seated : GameStatus.Unseated,
    // boardNominations: 保留，采纳不清空
  };
}

/** 玩家入座。 */
export function handlePlayerJoin(state: GameState, action: PlayerJoinAction): GameState {
  const { seat, player, rosterEntry } = action.payload;
  const newPlayers = { ...state.players, [seat]: player };
  const allSeated = Object.values(newPlayers).every((p) => p !== null);
  const newStatus = allSeated ? GameStatus.Seated : state.status;

  return {
    ...state,
    players: newPlayers,
    roster: { ...state.roster, [player.userId]: rosterEntry },
    status: newStatus,
  };
}

/** 玩家离座。 */
export function handlePlayerLeave(state: GameState, action: PlayerLeaveAction): GameState {
  const { seat } = action.payload;
  const leavingPlayer = state.players[seat];
  const newRoster = { ...state.roster };
  if (leavingPlayer) {
    delete newRoster[leavingPlayer.userId];
  }
  return {
    ...state,
    players: { ...state.players, [seat]: null },
    roster: newRoster,
    status: state.status === GameStatus.Seated ? GameStatus.Unseated : state.status,
  };
}

/** 玩家离座。 */
export function handleUpdatePlayerProfile(
  state: GameState,
  action: UpdatePlayerProfileAction,
): GameState {
  const {
    userId,
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  } = action.payload;
  const existing = state.roster[userId];
  if (!existing) return state; // no-op if userId not in roster

  return {
    ...state,
    roster: {
      ...state.roster,
      [userId]: {
        ...existing,
        ...(displayName !== undefined && { displayName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(avatarFrame !== undefined && { avatarFrame }),
        ...(seatFlair !== undefined && { seatFlair }),
        ...(nameStyle !== undefined && { nameStyle }),
        ...(roleRevealEffect !== undefined && { roleRevealEffect }),
        ...(seatAnimation !== undefined && { seatAnimation }),
      },
    },
  };
}

/** 分配角色（将 assignments 写入 players，状态转 Assigned）。 */
export function handleAssignRoles(state: GameState, action: AssignRolesAction): GameState {
  const { assignments, seerLabelMap, bottomCards, treasureMasterSeat, thiefSeat, cupidSeat } =
    action.payload;
  const newPlayers = { ...state.players };

  for (const [seatStr, role] of Object.entries(assignments)) {
    const seat = Number.parseInt(seatStr, 10);
    const player = newPlayers[seat];
    if (player) {
      newPlayers[seat] = { ...player, role, hasViewedRole: false };
    }
  }

  return {
    ...state,
    players: newPlayers,
    status: GameStatus.Assigned,
    seerLabelMap,
    bottomCards,
    treasureMasterSeat,
    thiefSeat,
    cupidSeat,
  };
}

/** 标记玩家已查看角色（全部查看后状态转 Ready）。 */
export function handlePlayerViewedRole(
  state: GameState,
  action: PlayerViewedRoleAction,
): GameState {
  const { seat } = action.payload;
  const player = state.players[seat];
  if (!player) {
    throw new Error(`[FAIL-FAST] PLAYER_VIEWED_ROLE: no player at seat ${seat}`);
  }

  // 更新当前玩家的 hasViewedRole
  const newPlayers = {
    ...state.players,
    [seat]: { ...player, hasViewedRole: true },
  };

  // 检查是否所有已入座玩家都已查看角色
  const allViewed = Object.values(newPlayers).every((p) => p === null || p.hasViewedRole === true);

  // 仅当 status === GameStatus.Assigned 且 all viewed 时才推进到 GameStatus.Ready
  const newStatus =
    state.status === GameStatus.Assigned && allViewed ? GameStatus.Ready : state.status;

  return {
    ...state,
    players: newPlayers,
    status: newStatus,
  };
}

/** 用 bot 填充空座位。 */
export function handleFillWithBots(state: GameState, action: FillWithBotsAction): GameState {
  const { bots, botRoster } = action.payload;

  // 合并现有玩家和 bot
  const newPlayers = { ...state.players };
  for (const [seatStr, bot] of Object.entries(bots)) {
    const seat = Number.parseInt(seatStr, 10);
    newPlayers[seat] = bot;
  }

  // 判断是否全部入座
  const allSeated = Object.values(newPlayers).every((p) => p !== null);

  return {
    ...state,
    players: newPlayers,
    roster: { ...state.roster, ...botRoster },
    status: allSeated ? GameStatus.Seated : state.status,
    debugMode: { botsEnabled: true },
  };
}

/** 标记所有 bot 已查看角色。 */
export function handleMarkAllBotsViewed(state: GameState): GameState {
  const newPlayers = { ...state.players };

  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.isBot) {
      const seat = Number.parseInt(seatStr, 10);
      newPlayers[seat] = {
        ...player,
        hasViewedRole: true,
      };
    }
  }

  // 检查是否所有玩家都已查看角色（null 座位视为已查看，与 handlePlayerViewedRole 一致）
  const allViewed = Object.values(newPlayers).every((p) => p === null || p.hasViewedRole === true);
  const newStatus =
    state.status === GameStatus.Assigned && allViewed ? GameStatus.Ready : state.status;

  return {
    ...state,
    players: newPlayers,
    status: newStatus,
  };
}

// =============================================================================
// 板子建议 Reducers
// =============================================================================

/** 设置板子建议。 */
export function handleSetBoardNomination(
  state: GameState,
  action: SetBoardNominationAction,
): GameState {
  const { nomination } = action.payload;
  return {
    ...state,
    boardNominations: {
      ...state.boardNominations,
      [nomination.userId]: nomination,
    },
  };
}

/** 对板子建议投票（toggle，单选）。 */
export function handleUpvoteBoardNomination(
  state: GameState,
  action: UpvoteBoardNominationAction,
): GameState {
  const { targetUserId, voterUid } = action.payload;
  const nominations = state.boardNominations;
  const target = nominations?.[targetUserId];
  if (!target) return state;

  // Toggle：已点赞则取消，未点赞则添加（每人全局只能投一条）
  const alreadyVoted = target.upvoters.includes(voterUid);
  const updatedUpvoters = alreadyVoted
    ? target.upvoters.filter((userId) => userId !== voterUid)
    : [...target.upvoters, voterUid];

  // 投新票时，从其他建议中撤回旧票（单选）
  let updatedNominations = {
    ...nominations,
    [targetUserId]: { ...target, upvoters: updatedUpvoters },
  };
  if (!alreadyVoted) {
    for (const [userId, nom] of Object.entries(updatedNominations)) {
      if (userId !== targetUserId && nom.upvoters.includes(voterUid)) {
        updatedNominations = {
          ...updatedNominations,
          [userId]: { ...nom, upvoters: nom.upvoters.filter((u) => u !== voterUid) },
        };
      }
    }
  }

  return {
    ...state,
    boardNominations: updatedNominations,
  };
}

/** 撤回板子建议。 */
export function handleWithdrawBoardNomination(
  state: GameState,
  action: WithdrawBoardNominationAction,
): GameState {
  const { userId } = action.payload;
  const nominations = state.boardNominations;
  if (!nominations?.[userId]) return state;

  const { [userId]: _, ...rest } = nominations;
  return {
    ...state,
    boardNominations: Object.keys(rest).length > 0 ? rest : undefined,
  };
}
