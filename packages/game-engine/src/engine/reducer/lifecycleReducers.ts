/**
 * Lifecycle sub-reducers — game setup, player management, template & animation config.
 *
 * Pure functions: (state, action) => newState.
 * No IO, no random, no time dependencies.
 */

import { GameStatus, getPlayerCount } from '../../models';
import { type ResolvedRoleRevealAnimation, resolveRandomAnimation } from '../../types';
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
  SetRoleRevealAnimationAction,
  UpdatePlayerProfileAction,
  UpdateTemplateAction,
} from './types';

export function handleInitializeGame(state: GameState, action: InitializeGameAction): GameState {
  const { roomCode, hostUid, templateRoles, totalSeats } = action.payload;
  const players: Record<number, null> = {};
  for (let i = 0; i < totalSeats; i++) {
    players[i] = null;
  }
  return {
    ...state,
    roomCode,
    hostUid,
    templateRoles,
    players,
    status: GameStatus.Unseated,
    currentStepIndex: -1,
    isAudioPlaying: false,
  };
}

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
    hostUid: state.hostUid,
    templateRoles: state.templateRoles,
    roleRevealAnimation: state.roleRevealAnimation,
    debugMode: state.debugMode,

    // ── 重置字段 ─────────────────────────────────────────
    players,
    status: GameStatus.Seated, // v1: 重置到 seated，不是 unseated
    currentStepIndex: -1, // 与 buildInitialGameState 一致
    isAudioPlaying: false,
    currentStepId: undefined, // 清除夜晚步骤
    actions: [],
    currentNightResults: undefined,
    lastNightDeaths: undefined,
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
    wolfVoteDeadline: undefined,
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
    autoSkipDeadline: undefined,

    // ── 重开时更新 nonce 和 resolved 动画 ─────────────────
    roleRevealRandomNonce: newNonce,
    resolvedRoleRevealAnimation: resolvedAnimation,
  } satisfies Complete<GameState>;
}

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
  };
}

export function handleSetRoleRevealAnimation(
  state: GameState,
  action: SetRoleRevealAnimationAction,
): GameState {
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

export function handlePlayerJoin(state: GameState, action: PlayerJoinAction): GameState {
  const { seat, player } = action.payload;
  const newPlayers = { ...state.players, [seat]: player };
  const allSeated = Object.values(newPlayers).every((p) => p !== null);
  const newStatus = allSeated ? GameStatus.Seated : state.status;

  return {
    ...state,
    players: newPlayers,
    status: newStatus,
  };
}

export function handlePlayerLeave(state: GameState, action: PlayerLeaveAction): GameState {
  const { seat } = action.payload;
  return {
    ...state,
    players: { ...state.players, [seat]: null },
    status: state.status === GameStatus.Seated ? GameStatus.Unseated : state.status,
  };
}

export function handleUpdatePlayerProfile(
  state: GameState,
  action: UpdatePlayerProfileAction,
): GameState {
  const { seat, displayName, avatarUrl, avatarFrame } = action.payload;
  const player = state.players[seat];
  if (!player) return state; // no-op if seat is empty (defensive)

  return {
    ...state,
    players: {
      ...state.players,
      [seat]: {
        ...player,
        ...(displayName !== undefined && { displayName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(avatarFrame !== undefined && { avatarFrame }),
      },
    },
  };
}

export function handleAssignRoles(state: GameState, action: AssignRolesAction): GameState {
  const { assignments, seerLabelMap, bottomCards, treasureMasterSeat } = action.payload;
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
  };
}

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

export function handleFillWithBots(state: GameState, action: FillWithBotsAction): GameState {
  const { bots } = action.payload;

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
    status: allSeated ? GameStatus.Seated : state.status,
    debugMode: { botsEnabled: true },
  };
}

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
