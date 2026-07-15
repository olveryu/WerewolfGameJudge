/**
 * toWerewolfLocalState - converts GameState into the LocalGameState expected by the UI
 *
 * Game-owned view projection that lets the UI consume canonical facade state. Only performs pure data
 * format conversion (Record → Map, templateRoles → template) and required UI derivations.
 * No business logic, side effects, or service calls.
 */

import type { RoleAction } from '@werewolf/game-engine/games/werewolf/public';
import type { RoleId } from '@werewolf/game-engine/games/werewolf/public';
import type { GameState, Player } from '@werewolf/game-engine/games/werewolf/public';
import {
  makeActionMagicianSwap,
  makeActionTarget,
  makeActionWitch,
} from '@werewolf/game-engine/games/werewolf/public';
import {
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
} from '@werewolf/game-engine/games/werewolf/public';
import { type GameStatus } from '@werewolf/game-engine/games/werewolf/public';
import { NIGHT_STEPS, SCHEMAS } from '@werewolf/game-engine/games/werewolf/public';
import { createTemplateFromRoles } from '@werewolf/game-engine/games/werewolf/public';
import type { RosterEntry } from '@werewolf/game-engine/platform/room/roster';
import { parseResolvedRoleRevealAnimation } from '@werewolf/game-engine/product/rewards';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';

/**
 * Convert Player + RosterEntry to LocalPlayer
 */
function toLocalPlayer(bp: Player, seat: number, roster?: RosterEntry): LocalPlayer {
  return {
    userId: bp.userId,
    seat,
    displayName: roster?.displayName,
    avatarUrl: roster?.avatarUrl,
    avatarFrame: roster?.avatarFrame,
    seatFlair: roster?.seatFlair,
    seatAnimation: roster?.seatAnimation,
    nameStyle: roster?.nameStyle,
    roleRevealEffect:
      roster?.revealEffect === undefined
        ? undefined
        : parseResolvedRoleRevealAnimation(roster.revealEffect),
    level: roster?.level,
    role: bp.role ?? null,
    hasViewedRole: bp.hasViewedRole,
    isBot: bp.isBot,
  };
}

/**
 * Convert GameStatus string to enum
 */
function toGameStatusEnum(status: GameState['status']): GameStatus {
  // GameState.status is a string literal union whose values match the GameStatus enum
  return status;
}

/**
 * Convert GameState to LocalGameState
 *
 * Passthrough fields are auto-forwarded via object spread.
 * Only fields that need transformation are destructured and re-mapped.
 * Adding a new GameState field is automatically passed through.
 */
export function toWerewolfLocalState(state: GameState): LocalGameState {
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
  const playersMap = new Map<number, LocalPlayer | null>();
  for (const [seatStr, bp] of Object.entries(protocolPlayers)) {
    const seat = Number.parseInt(seatStr, 10);
    playersMap.set(seat, bp ? toLocalPlayer(bp, seat, roster?.[bp.userId]) : null);
  }

  // 2. templateRoles → template (using createTemplateFromRoles)
  const template = createTemplateFromRoles(templateRoles);

  // 3. actions: ProtocolAction[]  Map<RoleId, RoleAction>
  // This game-owned projection maps canonical protocol actions into the role-indexed UI model.
  //
  // NOTE:
  // - Game logic must not depend on this UI projection.
  // - Some schemas are better represented via other broadcast fields:
  //   - magicianSwap: uses currentNightResults.swappedSeats (authoritative resolver output)
  //   - witchAction: uses witchContext + recorded ProtocolAction target
  const actionsMap = new Map<RoleId, RoleAction>();

  const rawActions = protocolActions;
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
  // Representing as "none" is enough because status details come from dedicated broadcast fields.
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
    // Auto-passthrough: all GameState fields not in TransformedKeys
    // (new optional fields are forwarded automatically — no manual sync needed)
    ...passthroughFields,

    // Transformed fields
    status: toGameStatusEnum(status),
    template,
    players: playersMap,
    lastNightDeaths: lastNightDeaths ?? [],
    currentNightResults: nightResults ?? {},

    // Local-only fields (derived from GameState data)
    actions: actionsMap,
    wolfVotes: wolfVotesMap,
  };
}
