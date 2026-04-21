/**
 * Lifecycle sub-reducers — game setup, player management, template & animation config.
 *
 * Pure functions: (state, action) => newState.
 * No IO, no random, no time dependencies.
 */

import { GameStatus, getPlayerCount } from '../../models';
import { type ResolvedRoleRevealAnimation, resolveRandomAnimation } from '../../types';
import type { Complete } from '../state/normalize';
import type { GameStatePayload } from '../store/types';
import type {
  AssignRolesAction,
  FillWithBotsAction,
  InitializeGameAction,
  PlayerJoinAction,
  PlayerLeaveAction,
  PlayerViewedRoleAction,
  RestartGameAction,
  SetBoardNominationAction,
  SetRoleRevealAnimationAction,
  UpdatePlayerProfileAction,
  UpdateTemplateAction,
  UpvoteBoardNominationAction,
  WithdrawBoardNominationAction,
} from './types';

export function handleInitializeGame(
  state: GameStatePayload,
  action: InitializeGameAction,
): GameStatePayload {
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

export function handleRestartGame(
  state: GameStatePayload,
  action: RestartGameAction,
): GameStatePayload {
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

  // 如果当前是 random，重新解析
  let resolvedAnimation = state.resolvedRoleRevealAnimation;
  if (state.roleRevealAnimation === 'random') {
    const seed = `${state.roomCode}:${newNonce}`;
    const previous =
      state.resolvedRoleRevealAnimation !== 'none'
        ? (state.resolvedRoleRevealAnimation as import('../../types/RoleRevealAnimation').RandomizableAnimation)
        : undefined;
    resolvedAnimation = resolveRandomAnimation(seed, previous);
  }

  return {
    // ── 保留字段（跨局不变） ──────────────────────────────
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    templateRoles: state.templateRoles,
    roleRevealAnimation: state.roleRevealAnimation,
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
    hypnotizedSeats: undefined,
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

    // ── 重开时更新 nonce 和 resolved 动画 ─────────────────
    roleRevealRandomNonce: newNonce,
    resolvedRoleRevealAnimation: resolvedAnimation,
  } satisfies Complete<GameStatePayload>;
}

export function handleUpdateTemplate(
  state: GameStatePayload,
  action: UpdateTemplateAction,
): GameStatePayload {
  const newTemplateRoles = action.payload.templateRoles;
  const newCount = getPlayerCount(newTemplateRoles);
  const oldPlayers = state.players;

  const newPlayers: GameStatePayload['players'] = {};

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

export function handleSetRoleRevealAnimation(
  state: GameStatePayload,
  action: SetRoleRevealAnimationAction,
): GameStatePayload {
  const animation = action.animation;
  let resolved: ResolvedRoleRevealAnimation;
  const nonce = action.nonce ?? state.roleRevealRandomNonce;

  if (animation === 'random') {
    if (!nonce) {
      throw new Error('SET_ROLE_REVEAL_ANIMATION: nonce required when animation is random');
    }
    // seed = roomCode + ':' + nonce，确保同一房间同一局同一动画
    const seed = `${state.roomCode ?? 'default'}:${nonce}`;
    const previous =
      state.resolvedRoleRevealAnimation !== 'none'
        ? (state.resolvedRoleRevealAnimation as import('../../types/RoleRevealAnimation').RandomizableAnimation)
        : undefined;
    resolved = resolveRandomAnimation(seed, previous);
  } else {
    resolved = animation;
  }

  return {
    ...state,
    roleRevealAnimation: animation,
    resolvedRoleRevealAnimation: resolved,
    roleRevealRandomNonce: nonce,
  };
}

export function handlePlayerJoin(
  state: GameStatePayload,
  action: PlayerJoinAction,
): GameStatePayload {
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

export function handlePlayerLeave(
  state: GameStatePayload,
  action: PlayerLeaveAction,
): GameStatePayload {
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

export function handleUpdatePlayerProfile(
  state: GameStatePayload,
  action: UpdatePlayerProfileAction,
): GameStatePayload {
  const { userId, displayName, avatarUrl, avatarFrame, seatFlair, nameStyle } = action.payload;
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
      },
    },
  };
}

export function handleAssignRoles(
  state: GameStatePayload,
  action: AssignRolesAction,
): GameStatePayload {
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

export function handlePlayerViewedRole(
  state: GameStatePayload,
  action: PlayerViewedRoleAction,
): GameStatePayload {
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

export function handleFillWithBots(
  state: GameStatePayload,
  action: FillWithBotsAction,
): GameStatePayload {
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

export function handleMarkAllBotsViewed(state: GameStatePayload): GameStatePayload {
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

export function handleSetBoardNomination(
  state: GameStatePayload,
  action: SetBoardNominationAction,
): GameStatePayload {
  const { nomination } = action.payload;
  return {
    ...state,
    boardNominations: {
      ...state.boardNominations,
      [nomination.userId]: nomination,
    },
  };
}

export function handleUpvoteBoardNomination(
  state: GameStatePayload,
  action: UpvoteBoardNominationAction,
): GameStatePayload {
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

export function handleWithdrawBoardNomination(
  state: GameStatePayload,
  action: WithdrawBoardNominationAction,
): GameStatePayload {
  const { userId } = action.payload;
  const nominations = state.boardNominations;
  if (!nominations?.[userId]) return state;

  const { [userId]: _, ...rest } = nominations;
  return {
    ...state,
    boardNominations: Object.keys(rest).length > 0 ? rest : undefined,
  };
}
