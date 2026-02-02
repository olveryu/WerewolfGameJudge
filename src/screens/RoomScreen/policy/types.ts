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
 * ❌ Do NOT import: services, navigation, showAlert, React
 * ✅ Allowed imports: types only (GameStatus, RoleId, ActionIntent, etc.)
 */

import type { GameStatus } from '../../../models/Room';
import type { RoleId } from '../../../models/roles';
import type { ActionIntent } from '../hooks/useRoomActions';

// =============================================================================
// Interaction Events - What the user did
// =============================================================================

/** Seat tap event with optional disabled reason from PlayerGrid */
export interface SeatTapEvent {
  kind: 'SEAT_TAP';
  seatIndex: number;
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
  action:
    | 'settings'
    | 'prepareToFlip'
    | 'startGame'
    | 'lastNightInfo'
    | 'restart'
    | 'bgmToggle';
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
  revealRole: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot';
}

/** WolfRobot hunter status viewed - user acknowledged the hunter status */
export interface WolfRobotHunterStatusViewedEvent {
  kind: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED';
}

/** Union of all possible interaction events */
export type InteractionEvent =
  | SeatTapEvent
  | BottomActionEvent
  | HostControlEvent
  | ViewRoleEvent
  | LeaveRoomEvent
  | RevealAckEvent
  | WolfRobotHunterStatusViewedEvent;

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
  seatIndex?: number;
}

/** Run seating flow (enter/leave seat) */
export interface InteractionResultSeatingFlow {
  kind: 'SEATING_FLOW';
  seatIndex: number;
}

/** Run action flow (process ActionIntent) */
export interface InteractionResultActionFlow {
  kind: 'ACTION_FLOW';
  seatIndex?: number;
  intent?: ActionIntent;
}

/** Run host control action */
export interface InteractionResultHostControl {
  kind: 'HOST_CONTROL';
  action:
    | 'settings'
    | 'prepareToFlip'
    | 'startGame'
    | 'lastNightInfo'
    | 'restart'
    | 'bgmToggle';
}

/** Submit reveal ack (seer/psychic/gargoyle/wolfRobot) */
export interface InteractionResultRevealAck {
  kind: 'REVEAL_ACK';
  revealRole: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot';
}

/** Submit wolf robot hunter status viewed */
export interface InteractionResultHunterStatusViewed {
  kind: 'HUNTER_STATUS_VIEWED';
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
  | InteractionResultHunterStatusViewed;

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

  // Player state
  isHost: boolean;
  imActioner: boolean;
  mySeatNumber: number | null;
  myRole: RoleId | null;
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
