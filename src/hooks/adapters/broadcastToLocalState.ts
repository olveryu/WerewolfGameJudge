/**
 * broadcastToLocalState - 将 v2 BroadcastGameState 转换为 UI 期望的 LocalGameState
 *
 * Phase 1: 适配层，让 UI 可以消费 v2 facade 的状态
 *
 * 职责：
 * - 只做数据格式转换（Record → Map，templateRoles → template）
 * - 不做业务逻辑
 * - 缺失字段用合理默认值
 */

import type { BroadcastGameState, BroadcastPlayer } from '../../services/protocol/types';
import type { LocalGameState, LocalPlayer } from '../../services/types/GameStateTypes';
import { GameStatus } from '../../services/types/GameStateTypes';
import { createTemplateFromRoles } from '../../models/Template';
import type { RoleId } from '../../models/roles';
import type { RoleAction } from '../../models/actions/RoleAction';

/**
 * 将 BroadcastPlayer 转换为 LocalPlayer
 */
function toLocalPlayer(bp: BroadcastPlayer, seatNumber: number): LocalPlayer {
  return {
    uid: bp.uid,
    seatNumber,
    displayName: bp.displayName,
    avatarUrl: bp.avatarUrl,
    role: bp.role ?? null,
    hasViewedRole: bp.hasViewedRole,
  };
}

/**
 * 将 GameStatus 字符串转换为 enum
 */
function toGameStatusEnum(status: BroadcastGameState['status']): GameStatus {
  // BroadcastGameState.status 是 string literal union，与 GameStatus enum 值相同
  return status as GameStatus;
}

/**
 * 将 BroadcastGameState 转换为 LocalGameState
 */
export function broadcastToLocalState(broadcast: BroadcastGameState): LocalGameState {
  // 1. players: Record<number, ...> → Map<number, ...>
  const playersMap = new Map<number, LocalPlayer | null>();
  for (const [seatStr, bp] of Object.entries(broadcast.players)) {
    const seat = Number.parseInt(seatStr, 10);
    playersMap.set(seat, bp ? toLocalPlayer(bp, seat) : null);
  }

  // 2. templateRoles → template (使用 createTemplateFromRoles)
  const template = createTemplateFromRoles(broadcast.templateRoles);

  // 3. actions: ProtocolAction[] → Map<RoleId, RoleAction>
  // Phase 1 只做 seating，actions 可以为空 Map
  // Night-1 时再完善此转换
  const actionsMap = new Map<RoleId, RoleAction>();
  // Note: ProtocolAction[] → Map<RoleId, RoleAction> 转换将在 Night-1 实现

  // 4. wolfVotes: Record<string, number> → Map<number, number>
  const wolfVotesMap = new Map<number, number>();
  if (broadcast.wolfVotes) {
    for (const [voterStr, target] of Object.entries(broadcast.wolfVotes)) {
      wolfVotesMap.set(Number.parseInt(voterStr, 10), target);
    }
  }

  return {
    roomCode: broadcast.roomCode,
    hostUid: broadcast.hostUid,
    status: toGameStatusEnum(broadcast.status),
    template,
    players: playersMap,
    actions: actionsMap,
    wolfVotes: wolfVotesMap,
    currentActionerIndex: broadcast.currentActionerIndex,
    currentStepId: undefined, // Phase 1 不处理 stepId
    isAudioPlaying: broadcast.isAudioPlaying,
    lastNightDeaths: broadcast.lastNightDeaths ?? [],
    nightmareBlockedSeat: broadcast.nightmareBlockedSeat,
    wolfKillDisabled: broadcast.wolfKillDisabled,
    currentNightResults: broadcast.currentNightResults ?? {},
    // Role-specific context (直接透传)
    witchContext: broadcast.witchContext,
    seerReveal: broadcast.seerReveal,
    psychicReveal: broadcast.psychicReveal,
    gargoyleReveal: broadcast.gargoyleReveal,
    wolfRobotReveal: broadcast.wolfRobotReveal,
    confirmStatus: broadcast.confirmStatus,
    actionRejected: broadcast.actionRejected,
  };
}
