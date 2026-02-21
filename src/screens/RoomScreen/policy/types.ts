/**
 * RoomInteractionPolicy Types
 *
 * Defines standard types for the unified interaction policy layer.
 * All user interactions in RoomScreen go through these types.
 *
 * Priority order (contract):
 * 1. Audio Gate (highest) - NOOP when audio is playing
 * 2. No Game State - NOOP when game state is missing
 * 3. Pending Gates - Block when reveal ack or other gates are pending
 * 4. Event Routing - Route to appropriate handler based on event type
 *
 * Only imports types (GameStatus, RoleId, ActionIntent, etc.). Does not import
 * services, navigation, showAlert, or React.
 */

import type { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RevealKind, RoleId } from '@werewolf/game-engine/models/roles';

// =============================================================================
// ActionIntent Types (must be serializable - no callbacks/refs/functions)
// =============================================================================

export type ActionIntentType =
  // Reveal (ANTI-CHEAT: RoomScreen only waits for private reveal + sends ack)
  | 'reveal'

  // Witch (schema-driven)

  // Two-step
  | 'magicianFirst' // Magician first target

  // Vote/Confirm
  | 'wolfVote' // Wolf vote
  | 'actionConfirm' // Normal action confirm
  | 'skip' // Skip action
  | 'confirmTrigger' // Hunter/DarkWolfKing: trigger status check via bottom button

  // WolfRobot hunter gate
  | 'wolfRobotViewHunterStatus' // WolfRobot learned hunter: view status gate

  // Auto-trigger prompt (dismiss → wait for seat tap)
  | 'actionPrompt'; // Generic action prompt for all roles

export interface ActionIntent {
  type: ActionIntentType;
  targetSeat: number;

  // Optional fields (based on type)
  wolfSeat?: number; // for wolfVote
  revealKind?: RevealKind; // for reveal
  message?: string; // for actionConfirm

  /**
   * For compound schemas (e.g. witchAction), this is the key of the active sub-step
   * (e.g., 'save' or 'poison' for witch). Used by RoomScreen to derive confirm copy + payload.
   */
  stepKey?: string;
}

// =============================================================================
// Interaction Events - What the user did
// =============================================================================

/** Seat tap event with optional disabled reason from PlayerGrid */
export interface SeatTapEvent {
  kind: 'SEAT_TAP';
  seat: number;
  /** UX-only disabled reason from SeatViewModel (e.g., "不能选择自己") */
  disabledReason?: string;
}

/** Bottom action button tap (save/poison/skip/confirm etc.) */
export interface BottomActionEvent {
  kind: 'BOTTOM_ACTION';
  /** The ActionIntent from getBottomAction button */
  intent: ActionIntent;
}

/** Host control button tap (start game, restart, etc.) */
export interface HostControlEvent {
  kind: 'HOST_CONTROL';
  action: 'settings' | 'prepareToFlip' | 'startGame' | 'restart';
}

/** View role card button tap */
export interface ViewRoleEvent {
  kind: 'VIEW_ROLE';
}

/** Leave room button tap */
export interface LeaveRoomEvent {
  kind: 'LEAVE_ROOM';
}

/** Reveal ack - user acknowledged the reveal result (seer/psychic/gargoyle/wolfRobot) */
export interface RevealAckEvent {
  kind: 'REVEAL_ACK';
  /** The role that revealed (determines which ack to send) */
  revealRole: RevealKind;
}

/** WolfRobot hunter status viewed - user acknowledged the hunter status */
export interface WolfRobotHunterStatusViewedEvent {
  kind: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED';
}

/** Takeover bot seat - Host wants to control a bot seat (debug mode) */
export interface TakeoverBotSeatEvent {
  kind: 'TAKEOVER_BOT_SEAT';
  seat: number;
}

/** Union of all possible interaction events */
export type InteractionEvent =
  | SeatTapEvent
  | BottomActionEvent
  | HostControlEvent
  | ViewRoleEvent
  | LeaveRoomEvent
  | RevealAckEvent
  | WolfRobotHunterStatusViewedEvent
  | TakeoverBotSeatEvent;

// =============================================================================
// Interaction Results - What the orchestrator should do
// =============================================================================

/** Do nothing - tap was blocked or has no effect */
export interface InteractionResultNoop {
  kind: 'NOOP';
  reason:
    | 'audio_playing'
    | 'no_game_state'
    | 'not_actioner'
    | 'other_status'
    | 'pending_reveal_ack'
    | 'pending_hunter_gate'
    | 'host_only'
    | 'player_only'
    | 'no_role';
}

/** Show an alert dialog */
export interface InteractionResultAlert {
  kind: 'ALERT';
  title: string;
  message: string;
}

/** Show a dialog (confirm, action prompt, etc.) */
export interface InteractionResultShowDialog {
  kind: 'SHOW_DIALOG';
  dialogType: 'seatingEnter' | 'seatingLeave' | 'roleCard' | 'leaveRoom';
  seat?: number;
}

/** Run seating flow (enter/leave seat) */
export interface InteractionResultSeatingFlow {
  kind: 'SEATING_FLOW';
  seat: number;
}

/** Run action flow (process ActionIntent) */
export interface InteractionResultActionFlow {
  kind: 'ACTION_FLOW';
  seat?: number;
  intent?: ActionIntent;
}

/** Run host control action */
export interface InteractionResultHostControl {
  kind: 'HOST_CONTROL';
  action: 'settings' | 'prepareToFlip' | 'startGame' | 'restart';
}

/** Submit reveal ack (seer/psychic/gargoyle/wolfRobot) */
export interface InteractionResultRevealAck {
  kind: 'REVEAL_ACK';
  revealRole: RevealKind;
}

/** Submit wolf robot hunter status viewed */
export interface InteractionResultHunterStatusViewed {
  kind: 'HUNTER_STATUS_VIEWED';
}

/** Takeover bot seat (debug mode) */
export interface InteractionResultTakeoverBotSeat {
  kind: 'TAKEOVER_BOT_SEAT';
  seat: number;
}

/** Release bot seat control (debug mode) */
export interface InteractionResultReleaseBotSeat {
  kind: 'RELEASE_BOT_SEAT';
}

/** Union of all possible interaction results */
export type InteractionResult =
  | InteractionResultNoop
  | InteractionResultAlert
  | InteractionResultShowDialog
  | InteractionResultSeatingFlow
  | InteractionResultActionFlow
  | InteractionResultHostControl
  | InteractionResultRevealAck
  | InteractionResultHunterStatusViewed
  | InteractionResultTakeoverBotSeat
  | InteractionResultReleaseBotSeat;

// =============================================================================
// Interaction Context - Minimal state needed for policy decisions
// =============================================================================

/**
 * Minimal context required for making interaction decisions.
 * This is a subset of RoomScreen state - only what the policy needs.
 */
export interface InteractionContext {
  // Room/game state
  roomStatus: GameStatus | undefined;
  hasGameState: boolean;

  // Gates (priority order: audio > pending reveal > pending hunter)
  isAudioPlaying: boolean;
  pendingRevealAck: boolean;
  pendingHunterGate: boolean;

  // Player state (real identity - for display only)
  isHost: boolean;
  mySeatNumber: number | null;
  myRole: RoleId | null;

  // Actor identity (for all action-related decisions)
  // When Host controls a bot, these are the bot's seat/role
  actorSeatForUi: number | null;
  actorRoleForUi: RoleId | null;
  imActioner: boolean; // computed from actorSeatForUi

  // Debug mode (required to prevent silent drift)
  isDebugMode: boolean;
  controlledSeat: number | null;
  isDelegating: boolean;
  /** Function to get all bot seat indices (for takeover logic) */
  getBotSeats?: () => number[];
}

// =============================================================================
// Priority Constants (for testing and documentation)
// =============================================================================

/**
 * Priority order for interaction gates.
 * Lower number = higher priority (checked first).
 */
export const INTERACTION_PRIORITY = {
  AUDIO_GATE: 1,
  NO_GAME_STATE: 2,
  PENDING_REVEAL_ACK: 3,
  PENDING_HUNTER_GATE: 4,
  EVENT_ROUTING: 5,
} as const;
