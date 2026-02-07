/**
 * broadcastToLocalState - 将 BroadcastGameState 转换为 UI 期望的 LocalGameState
 *
 * Phase 1: 适配层，让 UI 可以消费 facade 的状态
 *
 * 职责：
 * - 只做数据格式转换（Record → Map，templateRoles → template）
 * - 不做业务逻辑
 * - 缺失字段用合理默认值
 */

import type { BroadcastGameState, BroadcastPlayer } from '../../services/protocol/types';
import type { LocalGameState, LocalPlayer } from '../../services/types/GameStateTypes';
import { GameStatus } from '../../models/GameStatus';
import { createTemplateFromRoles } from '../../models/Template';
import type { RoleId } from '../../models/roles';
import type { RoleAction } from '../../models/actions/RoleAction';
import {
  makeActionMagicianSwap,
  makeActionTarget,
  makeActionWitch,
} from '../../models/actions/RoleAction';
import { makeWitchNone, makeWitchPoison, makeWitchSave } from '../../models/actions/WitchAction';

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
    isBot: bp.isBot,
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

  // 3. actions: ProtocolAction[]  Map<RoleId, RoleAction>
  // This is an adapter-only mapping so the existing UI can keep reading
  // LocalGameState.actions (legacy-compatible) while the on-wire source of truth
  // remains BroadcastGameState.actions.
  //
  // NOTE:
  // - This mapping is adapter-only (UI compatibility). Game logic must NOT depend on it.
  // - Some schemas are better represented via other broadcast fields:
  //   - magicianSwap: uses currentNightResults.swappedSeats (authoritative resolver output)
  //   - witchAction: uses witchContext + recorded ProtocolAction target
  const actionsMap = new Map<RoleId, RoleAction>();

  const actions = broadcast.actions ?? [];
  const findBySchemaId = (schemaId: string) => actions.find((a) => a.schemaId === schemaId);

  // ---------------------------------------------------------------------------
  // Target-based chooseSeat schemas
  // ---------------------------------------------------------------------------
  const schemaToRoleTarget: Array<{ schemaId: string; roleId: RoleId }> = [
    { schemaId: 'seerCheck', roleId: 'seer' },
    { schemaId: 'guardProtect', roleId: 'guard' },
    { schemaId: 'psychicCheck', roleId: 'psychic' },
    { schemaId: 'dreamcatcherDream', roleId: 'dreamcatcher' },
    { schemaId: 'wolfQueenCharm', roleId: 'wolfQueen' },
    { schemaId: 'nightmareBlock', roleId: 'nightmare' },
    { schemaId: 'gargoyleCheck', roleId: 'gargoyle' },
    { schemaId: 'wolfRobotLearn', roleId: 'wolfRobot' },
    { schemaId: 'slackerChooseIdol', roleId: 'slacker' },
  ];

  for (const { schemaId, roleId } of schemaToRoleTarget) {
    const a = findBySchemaId(schemaId);
    if (typeof a?.targetSeat === 'number') {
      actionsMap.set(roleId, makeActionTarget(a.targetSeat));
    }
  }

  // ---------------------------------------------------------------------------
  // Confirm schemas - representing as "none" is enough for most UI compatibility.
  // (The actual effect is provided via confirmStatus broadcast fields.)
  // ---------------------------------------------------------------------------
  if (findBySchemaId('hunterConfirm')) {
    actionsMap.set('hunter', { kind: 'none' });
  }
  if (findBySchemaId('darkWolfKingConfirm')) {
    actionsMap.set('darkWolfKing', { kind: 'none' });
  }

  // ---------------------------------------------------------------------------
  // magicianSwap - prefer resolver output (swappedSeats) over encoded targets.
  // ---------------------------------------------------------------------------
  if (Array.isArray(broadcast.currentNightResults?.swappedSeats)) {
    const [firstSeat, secondSeat] = broadcast.currentNightResults.swappedSeats;
    if (typeof firstSeat === 'number' && typeof secondSeat === 'number') {
      actionsMap.set('magician', makeActionMagicianSwap(firstSeat, secondSeat));
    }
  } else {
    // Fallback: if action exists but swappedSeats not present, do nothing.
    // (We avoid fabricating swap targets in adapter.)
  }

  // ---------------------------------------------------------------------------
  // witchAction (compound)
  // stores a single ProtocolAction with targetSeat (either save target or poison target).
  // We need witchContext to disambiguate save vs poison.
  // ---------------------------------------------------------------------------
  const witchAction = findBySchemaId('witchAction');
  if (witchAction) {
    const ctx = broadcast.witchContext;
    const targetSeat = witchAction.targetSeat;

    if (typeof targetSeat !== 'number') {
      actionsMap.set('witch', makeActionWitch(makeWitchNone()));
    } else if (ctx && targetSeat === ctx.killedIndex && ctx.canSave) {
      actionsMap.set('witch', makeActionWitch(makeWitchSave(targetSeat)));
    } else {
      actionsMap.set('witch', makeActionWitch(makeWitchPoison(targetSeat)));
    }
  }

  // ---------------------------------------------------------------------------
  // wolfKill (wolfVote)
  // single source of truth: broadcast.currentNightResults.wolfVotesBySeat
  // ---------------------------------------------------------------------------
  const wolfVotesMap = new Map<number, number>();
  const wolfVotes = broadcast.currentNightResults?.wolfVotesBySeat;
  if (wolfVotes) {
    for (const [voterStr, target] of Object.entries(wolfVotes)) {
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
    currentStepId: broadcast.currentStepId, // PR9: 透传 currentStepId
    isAudioPlaying: broadcast.isAudioPlaying,
    roleRevealAnimation: broadcast.roleRevealAnimation,
    resolvedRoleRevealAnimation: broadcast.resolvedRoleRevealAnimation,
    roleRevealRandomNonce: broadcast.roleRevealRandomNonce,
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
    wolfRobotHunterStatusViewed: broadcast.wolfRobotHunterStatusViewed,
    confirmStatus: broadcast.confirmStatus,
    actionRejected: broadcast.actionRejected,
    // UI Hints (Host 广播驱动，直接透传)
    ui: broadcast.ui,
    // Debug mode (直接透传)
    debugMode: broadcast.debugMode,
  };
}
