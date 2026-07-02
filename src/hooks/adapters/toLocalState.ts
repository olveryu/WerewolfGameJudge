/**
 * toLocalState - converts WerewolfState into the LocalWerewolfState expected by the UI
 *
 * Phase 1 adapter layer that lets the UI consume facade state. Only performs pure data format conversion
 * (Record → Map, templateRoles → template) and fills in default values for missing fields.
 * No business logic, side effects, or service calls.
 */

import type { RoleAction } from '@werewolf/game-engine/werewolf/models/actions/RoleAction';
import {
  makeActionMagicianSwap,
  makeActionTarget,
  makeActionWitch,
} from '@werewolf/game-engine/werewolf/models/actions/RoleAction';
import {
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
} from '@werewolf/game-engine/werewolf/models/actions/WitchAction';
import { type GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { NIGHT_STEPS, SCHEMAS } from '@werewolf/game-engine/werewolf/models/roles/spec';
import { createTemplateFromRoles } from '@werewolf/game-engine/werewolf/models/Template';
import type {
  Player,
  RosterEntry,
  WerewolfState,
} from '@werewolf/game-engine/werewolf/protocol/types';

import type { LocalWerewolfPlayer, LocalWerewolfState } from '@/hooks/adapters/werewolfStateTypes';

/**
 * Convert Player + RosterEntry to LocalWerewolfPlayer
 */
function toLocalWerewolfPlayer(
  bp: Player,
  seat: number,
  roster?: RosterEntry,
): LocalWerewolfPlayer {
  return {
    userId: bp.userId,
    seat,
    displayName: roster?.displayName,
    avatarUrl: roster?.avatarUrl,
    avatarFrame: roster?.avatarFrame,
    seatFlair: roster?.seatFlair,
    seatAnimation: roster?.seatAnimation,
    nameStyle: roster?.nameStyle,
    roleRevealEffect: roster?.roleRevealEffect,
    level: roster?.level,
    role: bp.role ?? null,
    hasViewedRole: bp.hasViewedRole,
    isBot: bp.isBot,
  };
}

/**
 * Convert GameStatus string to enum
 */
function toGameStatusEnum(status: WerewolfState['status']): GameStatus {
  // WerewolfState.status is a string literal union whose values match the GameStatus enum
  return status;
}

/**
 * Convert WerewolfState to LocalWerewolfState
 *
 * Passthrough fields are auto-forwarded via object spread.
 * Only fields that need transformation are destructured and re-mapped.
 * Adding a new WerewolfState field is automatically passed through.
 */
export function toLocalState(state: WerewolfState): LocalWerewolfState {
  // =========================================================================
  // Destructure fields that need transformation; rest auto-passthrough.
  // =========================================================================
  const {
    players: protocolPlayers,
    templateRoles,
    actions: protocolActions,
    currentNightResults: nightResults,
    lastNightDeaths,
    status,
    roster,
    ...passthroughFields
  } = state;

  // 1. players: Record<number, ...> → Map<number, ...>
  const playersMap = new Map<number, LocalWerewolfPlayer | null>();
  for (const [seatStr, bp] of Object.entries(protocolPlayers)) {
    const seat = Number.parseInt(seatStr, 10);
    playersMap.set(seat, bp ? toLocalWerewolfPlayer(bp, seat, roster?.[bp.userId]) : null);
  }

  // 2. templateRoles → template (using createTemplateFromRoles)
  const template = createTemplateFromRoles(templateRoles);

  // 3. actions: ProtocolAction[]  Map<RoleId, RoleAction>
  // This is an adapter-only mapping so the local UI can read
  // LocalWerewolfState.actions while the on-wire source of truth remains
  // WerewolfState.actions.
  //
  // NOTE:
  // - This mapping is adapter-only. Game logic must NOT depend on it.
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
  // Representing as "none" is enough for the local UI adapter.
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
  // Use currentNightResults.savedSeat / poisonedSeat (resolver output) as the
  // authoritative source for save vs poison disambiguation, matching the
  // server-side extractWitchAction pattern in stepTransitionHandler.ts.
  // ---------------------------------------------------------------------------
  if (nightResults?.savedSeat !== undefined) {
    actionsMap.set('witch', makeActionWitch(makeWitchSave(nightResults.savedSeat)));
  } else if (nightResults?.poisonedSeat !== undefined) {
    actionsMap.set('witch', makeActionWitch(makeWitchPoison(nightResults.poisonedSeat)));
  } else if (findBySchemaId('witchAction')) {
    actionsMap.set('witch', makeActionWitch(makeWitchNone()));
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
    // Auto-passthrough: all WerewolfState fields not in TransformedKeys
    // (new optional fields are forwarded automatically — no manual sync needed)
    ...passthroughFields,

    // Transformed fields
    status: toGameStatusEnum(status),
    template,
    players: playersMap,
    lastNightDeaths: lastNightDeaths ?? [],
    currentNightResults: nightResults ?? {},

    // Local-only fields (derived from WerewolfState data)
    actions: actionsMap,
    wolfVotes: wolfVotesMap,
  };
}
