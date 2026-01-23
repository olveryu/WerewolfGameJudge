/**
 * Game Reducer - 状态归约器
 *
 * 纯函数：(state, action) => newState
 *
 * 职责：
 * - 根据 StateAction 计算新状态
 * - 不产生副作用（无 IO、无随机、无时间）
 * - 不调用 resolver（resolver 由 handler 调用，结果通过 action 传入）
 */

import type { GameState } from '../store/types';
import type {
  StateAction,
  InitializeGameAction,
  PlayerJoinAction,
  PlayerLeaveAction,
  AssignRolesAction,
  StartNightAction,
  AdvanceToNextActionAction,
  EndNightAction,
  RecordActionAction,
  ApplyResolverResultAction,
  SetWitchContextAction,
  SetConfirmStatusAction,
  SetWolfKillDisabledAction,
  SetAudioPlayingAction,
  PlayerViewedRoleAction,
  ActionRejectedAction,
  AddRevealAckAction,
} from './types';

// =============================================================================
// 子 Reducer 函数（降低认知复杂度）
// =============================================================================

function handleInitializeGame(state: GameState, action: InitializeGameAction): GameState {
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
    status: 'unseated',
    currentActionerIndex: -1,
    isAudioPlaying: false,
  };
}

function handleRestartGame(state: GameState): GameState {
  // PR9: 对齐 v1 行为 - 保留玩家但清除角色
  // v1: 保持 players 不变，仅清除 role/hasViewedRole
  // v1: 状态重置到 'seated'（不是 'unseated'）
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

  return {
    ...state,
    players,
    status: 'seated', // v1: 重置到 seated，不是 unseated
    currentActionerIndex: 0, // v1: 重置到 0
    isAudioPlaying: false,
    currentStepId: undefined, // 清除夜晚步骤
    actions: undefined,
    currentNightResults: undefined,
    lastNightDeaths: undefined,
    witchContext: undefined,
    seerReveal: undefined,
    psychicReveal: undefined,
    gargoyleReveal: undefined,
    wolfRobotReveal: undefined,
    confirmStatus: undefined,
    actionRejected: undefined,
    nightmareBlockedSeat: undefined,
    wolfKillDisabled: undefined,
    pendingRevealAcks: undefined,
  };
}

function handlePlayerJoin(state: GameState, action: PlayerJoinAction): GameState {
  const { seat, player } = action.payload;
  const newPlayers = { ...state.players, [seat]: player };
  const allSeated = Object.values(newPlayers).every((p) => p !== null);
  const newStatus = allSeated ? 'seated' : state.status;

  return {
    ...state,
    players: newPlayers,
    status: newStatus,
  };
}

function handlePlayerLeave(state: GameState, action: PlayerLeaveAction): GameState {
  const { seat } = action.payload;
  return {
    ...state,
    players: { ...state.players, [seat]: null },
    status: state.status === 'seated' ? 'unseated' : state.status,
  };
}

function handleAssignRoles(state: GameState, action: AssignRolesAction): GameState {
  const { assignments } = action.payload;
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
    status: 'assigned',
  };
}

function handleStartNight(state: GameState, action: StartNightAction): GameState {
  const { currentActionerIndex, currentStepId } = action.payload;
  return {
    ...state,
    status: 'ongoing',
    currentActionerIndex,
    currentStepId,
    // 不在 reducer 里设置 isAudioPlaying，由 Host UI 调用 SET_AUDIO_PLAYING 控制
    actions: [],
    currentNightResults: {},
  };
}

function handleAdvanceToNextAction(state: GameState, action: AdvanceToNextActionAction): GameState {
  const { nextActionerIndex, nextStepId } = action.payload;
  return {
    ...state,
    currentActionerIndex: nextActionerIndex,
    // PR6 contract: 推进时同步更新 currentStepId（单一真相）
    currentStepId: nextStepId ?? undefined,
    // 不在 reducer 里设置 isAudioPlaying，由 Host UI 调用 SET_AUDIO_PLAYING 控制
  // 注意：wolf 投票单一真相在 currentNightResults.wolfVotesBySeat（协议已移除 wolfVotes/wolfVoteStatus）。
    // P0-FIX: 不再清空 reveal 字段。reveal 应该保留到整个夜晚结束，
    // 让 UI 有足够时间显示弹窗。只清空 confirmStatus 和 witchContext
    // 因为这些是步骤特定的 context，不是 reveal 结果。
    confirmStatus: undefined,
    witchContext: undefined,
  };
}

function handleEndNight(state: GameState, action: EndNightAction): GameState {
  const { deaths } = action.payload;
  return {
    ...state,
    // Terminal state for this app's scope (Night-1-only): results are ready.
    // This is NOT a winner decision; players decide outcomes offline.
    status: 'ended',
    lastNightDeaths: deaths,
    currentActionerIndex: -1,
    // PR6 contract: 夜晚结束清空 stepId 和 isAudioPlaying
    currentStepId: undefined,
    isAudioPlaying: false,
  };
}

function handleRecordAction(state: GameState, action: RecordActionAction): GameState {
  const { action: newAction } = action.payload;
  const existingActions = state.actions ?? [];
  return {
    ...state,
    actions: [...existingActions, newAction],
  };
}

function handleApplyResolverResult(state: GameState, action: ApplyResolverResultAction): GameState {
  const { updates, seerReveal, psychicReveal, gargoyleReveal, wolfRobotReveal } = action.payload;

  const currentNightResults = updates
    ? {
        ...state.currentNightResults,
        ...updates,
      }
    : state.currentNightResults;

  return {
    ...state,
    currentNightResults,
    seerReveal: seerReveal ?? state.seerReveal,
    psychicReveal: psychicReveal ?? state.psychicReveal,
    gargoyleReveal: gargoyleReveal ?? state.gargoyleReveal,
    wolfRobotReveal: wolfRobotReveal ?? state.wolfRobotReveal,
  };
}

function handleSetWitchContext(state: GameState, action: SetWitchContextAction): GameState {
  return {
    ...state,
    witchContext: action.payload,
  };
}

function handleSetConfirmStatus(state: GameState, action: SetConfirmStatusAction): GameState {
  return {
    ...state,
    confirmStatus: action.payload,
  };
}

function handleSetWolfKillDisabled(state: GameState, action: SetWolfKillDisabledAction): GameState {
  const { disabled, blockedSeat } = action.payload;
  return {
    ...state,
    wolfKillDisabled: disabled,
    nightmareBlockedSeat: blockedSeat,
  };
}

function handleSetAudioPlaying(state: GameState, action: SetAudioPlayingAction): GameState {
  return {
    ...state,
    isAudioPlaying: action.payload.isPlaying,
  };
}

function handlePlayerViewedRole(state: GameState, action: PlayerViewedRoleAction): GameState {
  const { seat } = action.payload;
  const player = state.players[seat];
  if (!player) return state;

  // 更新当前玩家的 hasViewedRole
  const newPlayers = {
    ...state.players,
    [seat]: { ...player, hasViewedRole: true },
  };

  // 检查是否所有已入座玩家都已查看角色
  const allViewed = Object.values(newPlayers).every((p) => p === null || p.hasViewedRole === true);

  // 仅当 status === 'assigned' 且 all viewed 时才推进到 'ready'
  const newStatus = state.status === 'assigned' && allViewed ? 'ready' : state.status;

  return {
    ...state,
    players: newPlayers,
    status: newStatus,
  };
}

function handleActionRejected(state: GameState, action: ActionRejectedAction): GameState {
  return {
    ...state,
    actionRejected: action.payload,
  };
}

function handleAddRevealAck(state: GameState, action: AddRevealAckAction): GameState {
  const { ackKey } = action.payload;
  const existing = state.pendingRevealAcks ?? [];
  return {
    ...state,
    pendingRevealAcks: [...existing, ackKey],
  };
}

// =============================================================================
// 主 Reducer
// =============================================================================

/**
 * 游戏状态归约器
 */
export function gameReducer(state: GameState, action: StateAction): GameState {
  switch (action.type) {
    case 'INITIALIZE_GAME':
      return handleInitializeGame(state, action);

    case 'RESTART_GAME':
      return handleRestartGame(state);

    case 'UPDATE_TEMPLATE': {
      // 更新模板（仅在 unseated 状态允许）
      const newTemplateRoles = action.payload.templateRoles;
      const newPlayers: GameState['players'] = {};
      for (let i = 0; i < newTemplateRoles.length; i++) {
        newPlayers[i] = null;
      }
      return {
        ...state,
        templateRoles: newTemplateRoles,
        players: newPlayers,
        status: 'unseated',
      };
    }

    case 'PLAYER_JOIN':
      return handlePlayerJoin(state, action);

    case 'PLAYER_LEAVE':
      return handlePlayerLeave(state, action);

    case 'ASSIGN_ROLES':
      return handleAssignRoles(state, action);

    case 'START_NIGHT':
      return handleStartNight(state, action);

    case 'ADVANCE_TO_NEXT_ACTION':
      return handleAdvanceToNextAction(state, action);

    case 'END_NIGHT':
      return handleEndNight(state, action);

    case 'RECORD_ACTION':
      return handleRecordAction(state, action);

    case 'APPLY_RESOLVER_RESULT':
      return handleApplyResolverResult(state, action);

    case 'SET_WITCH_CONTEXT':
      return handleSetWitchContext(state, action);

    case 'SET_CONFIRM_STATUS':
      return handleSetConfirmStatus(state, action);

    case 'CLEAR_REVEAL_STATE':
      return {
        ...state,
        seerReveal: undefined,
        psychicReveal: undefined,
        gargoyleReveal: undefined,
        wolfRobotReveal: undefined,
        confirmStatus: undefined,
        witchContext: undefined,
      };

    case 'SET_WOLF_KILL_DISABLED':
      return handleSetWolfKillDisabled(state, action);

    case 'SET_AUDIO_PLAYING':
      return handleSetAudioPlaying(state, action);

    case 'PLAYER_VIEWED_ROLE':
      return handlePlayerViewedRole(state, action);

    case 'ACTION_REJECTED':
      return handleActionRejected(state, action);

    case 'CLEAR_ACTION_REJECTED':
      return {
        ...state,
        actionRejected: undefined,
      };

    case 'ADD_REVEAL_ACK':
      return handleAddRevealAck(state, action);

    case 'CLEAR_REVEAL_ACKS':
      return {
        ...state,
        pendingRevealAcks: undefined,
      };

    case 'SET_CURRENT_STEP':
      // 当前 BroadcastGameState 没有 currentStepId 字段，预留
      return state;

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
