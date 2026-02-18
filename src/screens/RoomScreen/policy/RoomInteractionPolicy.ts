/**
 * RoomInteractionPolicy.ts - Unified pure function strategy for all RoomScreen interactions
 *
 * This module is the single entry point for all user interaction decisions.
 * It enforces a strict priority order and returns instructions for the orchestrator.
 *
 * Priority order (contract - MUST be tested):
 * 1. Audio Gate (highest) - NOOP when audio is playing during ongoing game
 * 2. No Game State - NOOP when game state is missing
 * 3. Pending Gates - NOOP/ALERT when reveal ack or hunter gate is pending
 * 4. Event Routing - Route to appropriate handler based on event type
 *
 * Only imports types and SeatTapPolicy (pure). Does not import services,
 * navigation, showAlert, React, or any IO.
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RevealKind } from '@werewolf/game-engine/models/roles';

import { getSeatTapResult } from '@/screens/RoomScreen/seatTap/SeatTapPolicy';

import type { InteractionContext, InteractionEvent, InteractionResult } from './types';

// =============================================================================
// Gate Checks (Priority 1-4)
// =============================================================================

/**
 * Check audio gate - highest priority.
 * Returns NOOP if audio is playing during ongoing game.
 *
 * NOTE: Leave room is exempt from this gate (safety exit).
 */
function checkAudioGate(
  ctx: InteractionContext,
  event: InteractionEvent,
): InteractionResult | null {
  // Leave room is always allowed (safety exit)
  if (event.kind === 'LEAVE_ROOM') return null;

  if (ctx.roomStatus === GameStatus.ongoing && ctx.isAudioPlaying) {
    return { kind: 'NOOP', reason: 'audio_playing' };
  }
  return null;
}

/**
 * Check game state gate.
 * Returns NOOP if game state is missing.
 */
function checkGameStateGate(ctx: InteractionContext): InteractionResult | null {
  if (!ctx.hasGameState) {
    return { kind: 'NOOP', reason: 'no_game_state' };
  }
  return null;
}

/**
 * Check pending reveal ack gate.
 * Returns NOOP if reveal ack is pending (during ongoing phase only).
 */
function checkPendingRevealGate(
  ctx: InteractionContext,
  event: InteractionEvent,
): InteractionResult | null {
  // Only block during ongoing phase
  if (ctx.roomStatus !== GameStatus.ongoing) return null;

  // Pending reveal ack blocks all interactions except leave room
  if (ctx.pendingRevealAck && event.kind !== 'LEAVE_ROOM') {
    return { kind: 'NOOP', reason: 'pending_reveal_ack' };
  }
  return null;
}

/**
 * Check pending hunter gate.
 * Returns NOOP if wolf robot hunter status viewing is pending.
 */
function checkPendingHunterGate(
  ctx: InteractionContext,
  event: InteractionEvent,
): InteractionResult | null {
  // Only block during ongoing phase
  if (ctx.roomStatus !== GameStatus.ongoing) return null;

  // Pending hunter gate blocks all interactions except leave room
  if (ctx.pendingHunterGate && event.kind !== 'LEAVE_ROOM') {
    return { kind: 'NOOP', reason: 'pending_hunter_gate' };
  }
  return null;
}

// =============================================================================
// Event Handlers (Priority 5)
// =============================================================================

/**
 * Handle seat tap event.
 * Delegates to SeatTapPolicy and maps result to InteractionResult.
 */
function handleSeatTap(
  ctx: InteractionContext,
  event: { seat: number; disabledReason?: string },
): InteractionResult {
  const seatResult = getSeatTapResult({
    roomStatus: ctx.roomStatus,
    isAudioPlaying: ctx.isAudioPlaying,
    seat: event.seat,
    disabledReason: event.disabledReason,
    imActioner: ctx.imActioner,
    hasGameState: ctx.hasGameState,
  });

  // Map SeatTapResult to InteractionResult
  switch (seatResult.kind) {
    case 'NOOP':
      return { kind: 'NOOP', reason: seatResult.reason };
    case 'ALERT':
      return { kind: 'ALERT', title: seatResult.title, message: seatResult.message };
    case 'SEATING_FLOW':
      return { kind: 'SEATING_FLOW', seat: seatResult.seat };
    case 'ACTION_FLOW':
      return { kind: 'ACTION_FLOW', seat: seatResult.seat };
  }
}

/**
 * Handle bottom action event.
 * Validates actioner status and returns action flow result.
 */
function handleBottomAction(
  ctx: InteractionContext,
  event: { intent: import('../hooks/useRoomActions').ActionIntent },
): InteractionResult {
  // Only actioner can use bottom actions during ongoing phase
  if (ctx.roomStatus === GameStatus.ongoing && !ctx.imActioner) {
    return { kind: 'NOOP', reason: 'not_actioner' };
  }

  return { kind: 'ACTION_FLOW', intent: event.intent };
}

/**
 * Handle host control event.
 * Validates host status and returns host control result.
 */
function handleHostControl(ctx: InteractionContext, event: { action: string }): InteractionResult {
  if (!ctx.isHost) {
    return { kind: 'NOOP', reason: 'host_only' };
  }

  // Type narrowing for action
  const validActions = [
    'settings',
    'prepareToFlip',
    'startGame',
    'lastNightInfo',
    'restart',
  ] as const;

  if (!validActions.includes(event.action as (typeof validActions)[number])) {
    return { kind: 'NOOP', reason: 'other_status' };
  }

  return {
    kind: 'HOST_CONTROL',
    action: event.action as (typeof validActions)[number],
  };
}

/**
 * Handle view role event.
 * Validates player has a role and returns show dialog result.
 */
function handleViewRole(ctx: InteractionContext): InteractionResult {
  // When Host is controlling a bot seat, actorRoleForUi is the bot's role.
  // Fall back to myRole for the normal (non-delegating) case.
  const roleToView = ctx.actorRoleForUi ?? ctx.myRole;
  if (!roleToView) {
    return { kind: 'NOOP', reason: 'no_role' };
  }

  return { kind: 'SHOW_DIALOG', dialogType: 'roleCard' };
}

/**
 * Handle leave room event.
 * Always allowed (highest priority for this event type).
 */
function handleLeaveRoom(): InteractionResult {
  return { kind: 'SHOW_DIALOG', dialogType: 'leaveRoom' };
}

/**
 * Handle reveal ack event.
 * Simply returns the ack instruction to be executed by the orchestrator.
 */
function handleRevealAck(event: { revealRole: RevealKind }): InteractionResult {
  return { kind: 'REVEAL_ACK', revealRole: event.revealRole };
}

/**
 * Handle wolf robot hunter status viewed event.
 * Simply returns the instruction to be executed by the orchestrator.
 */
function handleHunterStatusViewed(): InteractionResult {
  return { kind: 'HUNTER_STATUS_VIEWED' };
}

/**
 * Handle takeover bot seat event (debug mode).
 * Validates debug mode and bot seat, then returns takeover/release instruction.
 */
function handleTakeoverBotSeat(
  ctx: InteractionContext,
  event: { seat: number },
): InteractionResult {
  // Must be Host
  if (!ctx.isHost) {
    return { kind: 'NOOP', reason: 'host_only' };
  }

  // Must be in debug mode
  if (!ctx.isDebugMode) {
    return { kind: 'NOOP', reason: 'other_status' };
  }

  // Check if seat is a bot
  const botSeats = ctx.getBotSeats?.() ?? [];
  if (!botSeats.includes(event.seat)) {
    return { kind: 'ALERT', title: '无法接管', message: '只能接管机器人座位' };
  }

  // Toggle: if already controlling this seat, release it
  if (ctx.controlledSeat === event.seat) {
    return { kind: 'RELEASE_BOT_SEAT' };
  }

  return { kind: 'TAKEOVER_BOT_SEAT', seat: event.seat };
}

// =============================================================================
// Main Policy Function
// =============================================================================

/**
 * Main policy function - determines what action to take for any interaction.
 *
 * This is a pure function with no side effects.
 * The caller (RoomScreen) is responsible for executing the result.
 *
 * @param ctx - Minimal context needed for the decision
 * @param event - The interaction event from the user
 * @returns An instruction telling the caller what to do
 */
export function getInteractionResult(
  ctx: InteractionContext,
  event: InteractionEvent,
): InteractionResult {
  // ─────────────────────────────────────────────────────────────────────────
  // Priority 1: Audio Gate (highest priority)
  // ─────────────────────────────────────────────────────────────────────────
  const audioGate = checkAudioGate(ctx, event);
  if (audioGate) return audioGate;

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 2: No Game State
  // ─────────────────────────────────────────────────────────────────────────
  const gameStateGate = checkGameStateGate(ctx);
  if (gameStateGate) return gameStateGate;

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 3: Pending Reveal Ack Gate
  // ─────────────────────────────────────────────────────────────────────────
  const revealGate = checkPendingRevealGate(ctx, event);
  if (revealGate) return revealGate;

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 4: Pending Hunter Gate
  // ─────────────────────────────────────────────────────────────────────────
  const hunterGate = checkPendingHunterGate(ctx, event);
  if (hunterGate) return hunterGate;

  // ─────────────────────────────────────────────────────────────────────────
  // Priority 5: Event Routing
  // ─────────────────────────────────────────────────────────────────────────
  switch (event.kind) {
    case 'SEAT_TAP':
      return handleSeatTap(ctx, event);
    case 'BOTTOM_ACTION':
      return handleBottomAction(ctx, event);
    case 'HOST_CONTROL':
      return handleHostControl(ctx, event);
    case 'VIEW_ROLE':
      return handleViewRole(ctx);
    case 'LEAVE_ROOM':
      return handleLeaveRoom();
    case 'REVEAL_ACK':
      return handleRevealAck(event);
    case 'WOLF_ROBOT_HUNTER_STATUS_VIEWED':
      return handleHunterStatusViewed();
    case 'TAKEOVER_BOT_SEAT':
      return handleTakeoverBotSeat(ctx, event);
    default: {
      // Exhaustive check
      const _exhaustive: never = event;
      return { kind: 'NOOP', reason: 'other_status' };
    }
  }
}
