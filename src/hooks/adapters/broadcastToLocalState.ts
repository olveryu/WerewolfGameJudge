/**
 * broadcastToLocalState - 将 BroadcastGameState 转换为 UI 期望的 LocalGameState
 *
 * Phase 1: 适配层，让 UI 可以消费 facade 的状态
 *
 * 职责：
 * - 只做数据格式转换（Record → Map，templateRoles → template）
 * - 不做业务逻辑
 * - 缺失字段用合理默认值
 *
 * ✅ 允许：纯数据格式转换、默认值填充
 * ❌ 禁止：业务逻辑、副作用、调用 service
 */

import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import {
  makeActionMagicianSwap,
  makeActionTarget,
  makeActionWitch,
} from '@werewolf/game-engine/models/actions/RoleAction';
import {
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
} from '@werewolf/game-engine/models/actions/WitchAction';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { NIGHT_STEPS, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';
import { createTemplateFromRoles } from '@werewolf/game-engine/models/Template';
import type { BroadcastGameState, BroadcastPlayer } from '@werewolf/game-engine/protocol/types';

import type { LocalGameState, LocalPlayer } from '@/types/GameStateTypes';

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
 *
 * Passthrough fields are auto-forwarded via object spread.
 * Only fields that need transformation are destructured and re-mapped.
 * ✅ Adding a new BroadcastGameState field: automatically passed through.
 */
export function broadcastToLocalState(broadcast: BroadcastGameState): LocalGameState {
  // =========================================================================
  // Destructure fields that need transformation; rest auto-passthrough.
  // =========================================================================
  const {
    players: broadcastPlayers,
    templateRoles,
    actions: protocolActions,
    currentNightResults: nightResults,
    lastNightDeaths,
    status,
    ...passthroughFields
  } = broadcast;

  // 1. players: Record<number, ...> → Map<number, ...>
  const playersMap = new Map<number, LocalPlayer | null>();
  for (const [seatStr, bp] of Object.entries(broadcastPlayers)) {
    const seat = Number.parseInt(seatStr, 10);
    playersMap.set(seat, bp ? toLocalPlayer(bp, seat) : null);
  }

  // 2. templateRoles → template (使用 createTemplateFromRoles)
  const template = createTemplateFromRoles(templateRoles);

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

  const rawActions = protocolActions ?? [];
  const findBySchemaId = (schemaId: string) => rawActions.find((a) => a.schemaId === schemaId);

  // ---------------------------------------------------------------------------
  // Target-based chooseSeat schemas (derived from NIGHT_STEPS + SCHEMAS SSOT)
  // ---------------------------------------------------------------------------
  const schemaToRoleTarget = NIGHT_STEPS.filter(
    (step) => SCHEMAS[step.id]?.kind === 'chooseSeat',
  ).map((step) => ({ schemaId: step.id, roleId: step.roleId }));

  for (const { schemaId, roleId } of schemaToRoleTarget) {
    const a = findBySchemaId(schemaId);
    if (typeof a?.targetSeat === 'number') {
      actionsMap.set(roleId, makeActionTarget(a.targetSeat));
    }
  }

  // ---------------------------------------------------------------------------
  // Confirm schemas - derived from NIGHT_STEPS + SCHEMAS SSOT.
  // Representing as "none" is enough for most UI compatibility.
  // (The actual effect is provided via confirmStatus broadcast fields.)
  // ---------------------------------------------------------------------------
  for (const step of NIGHT_STEPS) {
    if (SCHEMAS[step.id]?.kind === 'confirm' && findBySchemaId(step.id)) {
      actionsMap.set(step.roleId, { kind: 'none' });
    }
  }

  // ---------------------------------------------------------------------------
  // magicianSwap - prefer resolver output (swappedSeats) over encoded targets.
  // ---------------------------------------------------------------------------
  if (nightResults && Array.isArray(nightResults.swappedSeats)) {
    const [firstSeat, secondSeat] = nightResults.swappedSeats;
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
    const ctx = passthroughFields.witchContext;
    const targetSeat = witchAction.targetSeat;

    if (typeof targetSeat !== 'number') {
      actionsMap.set('witch', makeActionWitch(makeWitchNone()));
    } else if (ctx && targetSeat === ctx.killedSeat && ctx.canSave) {
      actionsMap.set('witch', makeActionWitch(makeWitchSave(targetSeat)));
    } else {
      actionsMap.set('witch', makeActionWitch(makeWitchPoison(targetSeat)));
    }
  }

  // ---------------------------------------------------------------------------
  // wolfKill (wolfVote)
  // single source of truth: currentNightResults.wolfVotesBySeat
  // ---------------------------------------------------------------------------
  const wolfVotesMap = new Map<number, number>();
  const wolfVotes = nightResults?.wolfVotesBySeat;
  if (wolfVotes) {
    for (const [voterStr, target] of Object.entries(wolfVotes)) {
      wolfVotesMap.set(Number.parseInt(voterStr, 10), target);
    }
  }

  return {
    // Auto-passthrough: all BroadcastGameState fields not in BroadcastTransformedKeys
    // (new optional fields are forwarded automatically — no manual sync needed)
    ...passthroughFields,

    // Transformed fields
    status: toGameStatusEnum(status),
    template,
    players: playersMap,
    lastNightDeaths: lastNightDeaths ?? [],
    currentNightResults: nightResults ?? {},

    // Local-only fields (derived from BroadcastGameState data)
    actions: actionsMap,
    wolfVotes: wolfVotesMap,
  };
}
